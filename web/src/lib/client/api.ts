export interface ApiErrorBody {
  code: string;
  message: string;
  details?: { path: string; message: string }[] | null;
}

export class ApiClientError extends Error {
  readonly code: string;
  readonly status: number;
  readonly details: { path: string; message: string }[] | null;

  constructor(status: number, body: ApiErrorBody) {
    super(body.message);
    this.name = "ApiClientError";
    this.code = body.code;
    this.status = status;
    this.details = body.details ?? null;
  }
}

export interface RequestOptions {
  method?: "GET" | "POST" | "PATCH" | "DELETE";
  body?: unknown;
  signal?: AbortSignal;
}

/**
 * Calls the shared /api/v1 surface. Works in the browser (cookie session) and
 * can be pointed at a bearer token by the mobile client.
 */
export async function api<T>(path: string, options: RequestOptions = {}): Promise<T> {
  const headers: Record<string, string> = { Accept: "application/json" };
  if (options.body !== undefined) headers["Content-Type"] = "application/json";

  const response = await fetch(path, {
    method: options.method ?? "GET",
    headers,
    body: options.body === undefined ? undefined : JSON.stringify(options.body),
    credentials: "same-origin",
    signal: options.signal,
    cache: "no-store",
  });

  const text = await response.text();
  let payload: unknown = null;
  if (text) {
    try {
      payload = JSON.parse(text);
    } catch {
      payload = null;
    }
  }

  if (!response.ok) {
    const body = (payload as { error?: ApiErrorBody } | null)?.error;
    throw new ApiClientError(
      response.status,
      body ?? { code: "internal_error", message: "Something went wrong. Please try again." },
    );
  }

  return payload as T;
}

export function errorMessage(error: unknown): string {
  if (error instanceof ApiClientError) return error.message;
  if (error instanceof Error) return error.message;
  return "Something went wrong. Please try again.";
}
