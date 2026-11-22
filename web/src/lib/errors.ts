export type ErrorCode =
  | "validation_error"
  | "unauthenticated"
  | "forbidden"
  | "not_found"
  | "conflict"
  | "rate_limited"
  | "out_of_stock"
  | "payment_error"
  | "payment_not_configured"
  | "internal_error";

export class ApiError extends Error {
  readonly code: ErrorCode;
  readonly status: number;
  readonly details?: unknown;

  constructor(code: ErrorCode, message: string, status: number, details?: unknown) {
    super(message);
    this.name = "ApiError";
    this.code = code;
    this.status = status;
    this.details = details;
  }
}

export const badRequest = (message: string, details?: unknown) =>
  new ApiError("validation_error", message, 422, details);

export const unauthenticated = (message = "Sign in to continue.") =>
  new ApiError("unauthenticated", message, 401);

export const forbidden = (message = "You do not have access to this resource.") =>
  new ApiError("forbidden", message, 403);

export const notFound = (message = "Not found.") => new ApiError("not_found", message, 404);

export const conflict = (message: string) => new ApiError("conflict", message, 409);

export const outOfStock = (message: string) => new ApiError("out_of_stock", message, 409);

export const rateLimited = (message = "Too many attempts. Please try again later.") =>
  new ApiError("rate_limited", message, 429);
