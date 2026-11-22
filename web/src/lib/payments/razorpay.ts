import { hmacSha256Hex, timingSafeEqual } from "../crypto";
import { ApiError } from "../errors";

const RAZORPAY_API = "https://api.razorpay.com/v1";

export function verifyPaymentSignature(input: {
  orderId: string;
  paymentId: string;
  signature: string;
  secret: string;
}): Promise<boolean> {
  return hmacSha256Hex(`${input.orderId}|${input.paymentId}`, input.secret).then((expected) =>
    timingSafeEqual(expected, input.signature),
  );
}

export function verifyWebhookSignature(input: {
  rawBody: string;
  signature: string;
  secret: string;
}): Promise<boolean> {
  return hmacSha256Hex(input.rawBody, input.secret).then((expected) =>
    timingSafeEqual(expected, input.signature),
  );
}

function authHeader(keyId: string, keySecret: string): string {
  return `Basic ${btoa(`${keyId}:${keySecret}`)}`;
}

async function razorpayFetch<T>(path: string, keyId: string, keySecret: string, body?: unknown): Promise<T> {
  const response = await fetch(`${RAZORPAY_API}${path}`, {
    method: body ? "POST" : "GET",
    headers: {
      Authorization: authHeader(keyId, keySecret),
      "Content-Type": "application/json",
    },
    body: body ? JSON.stringify(body) : undefined,
  });

  const text = await response.text();
  let payload: unknown = null;
  try {
    payload = text ? JSON.parse(text) : null;
  } catch {
    payload = { message: text.slice(0, 200) };
  }

  if (!response.ok) {
    const description =
      payload && typeof payload === "object" && "error" in payload
        ? String((payload as { error?: { description?: string } }).error?.description ?? "Payment provider error")
        : "Payment provider error";
    throw new ApiError(
      "payment_error",
      description,
      response.status >= 500 ? 502 : 400,
      { providerStatus: response.status },
    );
  }
  return payload as T;
}

export interface RazorpayOrder {
  id: string;
  amount: number;
  currency: string;
  status: string;
}

export async function createRazorpayOrder(input: {
  amount: number;
  currency: string;
  receipt: string;
  notes?: Record<string, string>;
  keyId: string;
  keySecret: string;
}): Promise<RazorpayOrder> {
  return razorpayFetch<RazorpayOrder>("/orders", input.keyId, input.keySecret, {
    amount: input.amount,
    currency: input.currency,
    receipt: input.receipt,
    payment_capture: 1,
    notes: input.notes ?? {},
  });
}

export interface RazorpayRefund {
  id: string;
  amount: number;
  status: string;
}

export async function createRazorpayRefund(input: {
  paymentId: string;
  amount: number;
  notes?: Record<string, string>;
  keyId: string;
  keySecret: string;
}): Promise<RazorpayRefund> {
  return razorpayFetch<RazorpayRefund>(`/payments/${input.paymentId}/refund`, input.keyId, input.keySecret, {
    amount: input.amount,
    notes: input.notes ?? {},
  });
}
