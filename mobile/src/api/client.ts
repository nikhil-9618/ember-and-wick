import Constants from "expo-constants";

const configured = process.env.EXPO_PUBLIC_API_URL ?? (Constants.expoConfig?.extra?.apiUrl as string | undefined);

/**
 * Production builds must never fall back to localhost. In development, fall back
 * to the Expo dev host so a physical device can reach the API.
 */
function resolveBaseUrl(): string {
  if (configured) return configured.replace(/\/$/, "");
  if (__DEV__) {
    const host = Constants.expoConfig?.hostUri?.split(":")[0];
    if (host) return `http://${host}:3000`;
    return "http://localhost:3000";
  }
  throw new Error("EXPO_PUBLIC_API_URL is not configured for this build.");
}

export const API_BASE_URL = resolveBaseUrl();

export class MobileApiError extends Error {
  readonly code: string;
  readonly status: number;

  constructor(status: number, code: string, message: string) {
    super(message);
    this.name = "MobileApiError";
    this.code = code;
    this.status = status;
  }
}

let authToken: string | null = null;
export function setAuthToken(token: string | null): void {
  authToken = token;
}

interface RequestOptions {
  method?: "GET" | "POST" | "PATCH" | "DELETE";
  body?: unknown;
  timeoutMs?: number;
  signal?: AbortSignal;
}

export async function api<T>(path: string, options: RequestOptions = {}): Promise<T> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), options.timeoutMs ?? 15000);
  if (options.signal) {
    options.signal.addEventListener("abort", () => controller.abort(), { once: true });
  }

  try {
    const headers: Record<string, string> = { Accept: "application/json" };
    if (options.body !== undefined) headers["Content-Type"] = "application/json";
    if (authToken) headers.Authorization = `Bearer ${authToken}`;

    const response = await fetch(`${API_BASE_URL}${path}`, {
      method: options.method ?? "GET",
      headers,
      body: options.body === undefined ? undefined : JSON.stringify(options.body),
      signal: controller.signal,
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
      const error = (payload as { error?: { code?: string; message?: string } } | null)?.error;
      throw new MobileApiError(
        response.status,
        error?.code ?? "request_failed",
        error?.message ?? "Something went wrong. Please try again.",
      );
    }

    return payload as T;
  } catch (error) {
    if (error instanceof MobileApiError) throw error;
    if (error instanceof Error && error.name === "AbortError") {
      throw new MobileApiError(0, "timeout", "The request timed out. Check your connection and try again.");
    }
    throw new MobileApiError(0, "network_error", "You appear to be offline. Check your connection and retry.");
  } finally {
    clearTimeout(timeout);
  }
}

export function errorText(error: unknown): string {
  if (error instanceof MobileApiError) return error.message;
  if (error instanceof Error) return error.message;
  return "Something went wrong. Please try again.";
}

export function money(paise: number): string {
  return new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: "INR",
    minimumFractionDigits: paise % 100 === 0 ? 0 : 2,
    maximumFractionDigits: 2,
  }).format(paise / 100);
}
