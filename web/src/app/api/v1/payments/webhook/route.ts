import { apiRoute, json } from "@/lib/http";
import { handleRazorpayWebhook } from "@/lib/services/payments";

/**
 * Razorpay webhook. The raw body is required for HMAC verification, so this
 * route deliberately does not use readJson().
 */
export const POST = apiRoute(async (request) => {
  const rawBody = await request.text();
  const outcome = await handleRazorpayWebhook(
    rawBody,
    request.headers.get("x-razorpay-signature"),
    request.headers.get("x-razorpay-event-id"),
  );
  return json(outcome.body, { status: outcome.status });
});
