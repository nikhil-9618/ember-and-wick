import { ZodError, type ZodSchema } from "zod";
import { ApiError, badRequest, forbidden } from "./errors";

export interface JsonOptions {
  status?: number;
  headers?: Record<string, string>;
  cache?: "no-store" | "public";
}

export function json(data: unknown, options: JsonOptions = {}): Response {
  const headers: Record<string, string> = {
    "Content-Type": "application/json; charset=utf-8",
    ...(options.cache === "public"
      ? { "Cache-Control": "public, max-age=30, stale-while-revalidate=60" }
      : { "Cache-Control": "no-store", Vary: "Authorization, Cookie" }),
    ...options.headers,
  };
  return new Response(JSON.stringify(data), { status: options.status ?? 200, headers });
}

export function errorResponse(error: unknown): Response {
  if (error instanceof ApiError) {
    return json(
      { error: { code: error.code, message: error.message, details: error.details ?? null } },
      { status: error.status },
    );
  }
  if (error instanceof ZodError) {
    return json(
      {
        error: {
          code: "validation_error",
          message: "Some fields need attention.",
          details: error.issues.map((issue) => ({ path: issue.path.join("."), message: issue.message })),
        },
      },
      { status: 422 },
    );
  }
  // Never leak internals or customer data to the client.
  console.error("[api] unhandled error:", error instanceof Error ? error.message : "unknown");
  return json({ error: { code: "internal_error", message: "Something went wrong. Please try again." } }, { status: 500 });
}

type Handler<C> = (request: Request, context: C) => Promise<Response>;

/** Wraps a route handler so every thrown error becomes a consistent JSON error. */
export function apiRoute<C>(handler: Handler<C>): Handler<C> {
  return async (request, context) => {
    try {
      return await handler(request, context);
    } catch (error) {
      return errorResponse(error);
    }
  };
}

const MAX_BODY_BYTES = 100 * 1024;

export async function readJson<T>(request: Request, schema: ZodSchema<T>): Promise<T> {
  const contentLength = Number(request.headers.get("content-length") ?? "0");
  if (contentLength > MAX_BODY_BYTES) throw badRequest("Request body is too large.");
  const text = await request.text();
  if (text.length > MAX_BODY_BYTES) throw badRequest("Request body is too large.");
  if (!text.trim()) throw badRequest("A JSON body is required.");
  let parsed: unknown;
  try {
    parsed = JSON.parse(text);
  } catch {
    throw badRequest("Request body must be valid JSON.");
  }
  return schema.parse(parsed);
}

/**
 * CSRF defence for cookie-authenticated mutations. Browser requests always send
 * Origin for POST/PATCH/DELETE; native app requests use bearer tokens and are
 * exempt because the browser cannot attach a cookie on their behalf.
 */
export function assertSameOrigin(request: Request): void {
  const origin = request.headers.get("origin");
  if (!origin) return;
  const host = request.headers.get("host");
  let originHost: string;
  try {
    originHost = new URL(origin).host;
  } catch {
    throw forbidden("Invalid request origin.");
  }
  if (!host || originHost !== host) throw forbidden("Cross-origin request blocked.");
}

export function clientIp(request: Request): string {
  const forwarded = request.headers.get("cf-connecting-ip") ?? request.headers.get("x-forwarded-for");
  if (forwarded) return forwarded.split(",")[0]!.trim();
  return "unknown";
}

export function getSearchParams(url: string): URLSearchParams {
  return new URL(url).searchParams;
}
