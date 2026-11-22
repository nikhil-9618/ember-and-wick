import { allRows, firstRow, getDb } from "../db";
import { randomId, sha256Hex } from "../crypto";
import { ApiError, badRequest, notFound } from "../errors";
import { getPaymentConfig } from "../config";
import {
  createRazorpayOrder,
  verifyPaymentSignature,
  verifyWebhookSignature,
} from "../payments/razorpay";
import { releaseOrder } from "./checkout";
import { notificationStatement } from "./notify";
import type { D1PreparedStatement } from "../types-d1";

interface OrderRow {
  id: string;
  number: string;
  user_id: string | null;
  status: string;
  payment_status: string;
  total: number;
  coupon_code: string | null;
  email: string;
}

async function loadOrderByNumber(number: string): Promise<OrderRow | null> {
  return firstRow<OrderRow>(
    "SELECT id, number, user_id, status, payment_status, total, coupon_code, email FROM orders WHERE number = ?",
    [number],
  );
}

async function loadOrderById(id: string): Promise<OrderRow | null> {
  return firstRow<OrderRow>(
    "SELECT id, number, user_id, status, payment_status, total, coupon_code, email FROM orders WHERE id = ?",
    [id],
  );
}

/**
 * Marks an order paid exactly once. Safe to call from both the client-side
 * verification route and the webhook, in either order: the status guard and the
 * UNIQUE provider_payment_id index make double-processing impossible.
 */
export async function markOrderPaid(
  orderId: string,
  payment: { providerPaymentId: string | null; method?: string | null },
): Promise<{ changed: boolean }> {
  const db = await getDb();
  const order = await loadOrderById(orderId);
  if (!order) throw notFound("Order not found.");

  if (order.payment_status === "paid") return { changed: false };
  if (order.status === "cancelled") {
    throw new ApiError("conflict", "This order was cancelled before payment completed.", 409);
  }

  const now = new Date().toISOString();
  const statements: D1PreparedStatement[] = [
    db
      .prepare(
        "UPDATE orders SET status = 'paid', payment_status = 'paid', paid_at = ?, updated_at = ? WHERE id = ? AND payment_status != 'paid'",
      )
      .bind(now, now, orderId),
  ];

  if (payment.providerPaymentId) {
    statements.push(
      db
        .prepare(
          "UPDATE payments SET provider_payment_id = ?, status = 'captured', method = ?, updated_at = ? WHERE order_id = ? AND status IN ('created','authorized','failed')",
        )
        .bind(payment.providerPaymentId, payment.method ?? null, now, orderId),
    );
  } else {
    statements.push(
      db
        .prepare("UPDATE payments SET status = 'captured', updated_at = ? WHERE order_id = ? AND status != 'refunded'")
        .bind(now, orderId),
    );
  }

  if (order.user_id) {
    statements.push(
      notificationStatement(db, {
        userId: order.user_id,
        type: "order_paid",
        title: `Payment received for ${order.number}`,
        body: "We're getting your candles ready. You'll get another update when your order ships.",
        data: { orderNumber: order.number },
      }),
    );
  }

  try {
    await db.batch(statements);
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    if (/UNIQUE constraint failed/i.test(message)) {
      // The same payment id was already attached to another order: refuse it.
      throw new ApiError("payment_error", "This payment has already been used for another order.", 409);
    }
    throw error;
  }

  return { changed: true };
}

export async function markPaymentFailed(
  orderId: string,
  detail: { code?: string | null; description?: string | null },
): Promise<void> {
  const db = await getDb();
  const order = await loadOrderById(orderId);
  if (!order || order.payment_status === "paid" || order.status === "cancelled") return;
  const now = new Date().toISOString();
  await db.batch([
    db
      .prepare(
        "UPDATE orders SET status = 'payment_failed', payment_status = 'failed', updated_at = ? WHERE id = ? AND payment_status = 'unpaid'",
      )
      .bind(now, orderId),
    db
      .prepare(
        "UPDATE payments SET status = 'failed', error_code = ?, error_description = ?, updated_at = ? WHERE order_id = ? AND status = 'created'",
      )
      .bind(detail.code ?? null, detail.description ?? null, now, orderId),
  ]);
}

export async function confirmPayment(input: {
  userId: string;
  orderNumber: string;
  providerOrderId: string;
  providerPaymentId: string;
  signature: string;
}): Promise<{ orderNumber: string; status: string; alreadyProcessed: boolean }> {
  const config = await getPaymentConfig();
  if (config.mode !== "razorpay" || !config.keySecret) {
    throw new ApiError("payment_error", "Payments are not configured for verification.", 503);
  }

  const order = await loadOrderByNumber(input.orderNumber);
  if (!order || order.user_id !== input.userId) throw notFound("Order not found.");
  if (order.payment_status === "paid") {
    return { orderNumber: order.number, status: "paid", alreadyProcessed: true };
  }

  const paymentRow = await firstRow<{ id: string; provider_order_id: string | null; amount: number }>(
    "SELECT id, provider_order_id, amount FROM payments WHERE order_id = ? ORDER BY created_at DESC LIMIT 1",
    [order.id],
  );
  if (!paymentRow) throw notFound("No payment is attached to this order.");
  if (paymentRow.provider_order_id !== input.providerOrderId) {
    throw badRequest("This payment does not belong to the order.");
  }
  if (paymentRow.amount !== order.total) {
    throw new ApiError("payment_error", "The paid amount does not match the order total.", 409);
  }

  const valid = await verifyPaymentSignature({
    orderId: input.providerOrderId,
    paymentId: input.providerPaymentId,
    signature: input.signature,
    secret: config.keySecret,
  });
  if (!valid) {
    throw new ApiError("payment_error", "Payment signature verification failed. Nothing was confirmed.", 400);
  }

  const result = await markOrderPaid(order.id, { providerPaymentId: input.providerPaymentId });
  return { orderNumber: order.number, status: "paid", alreadyProcessed: !result.changed };
}

/** Creates a fresh provider order so a failed payment can be retried. */
export async function retryPaymentIntent(
  userId: string,
  orderNumber: string,
): Promise<{ provider: string; keyId: string | null; providerOrderId: string; amount: number; currency: string }> {
  const config = await getPaymentConfig();
  if (config.mode === "unconfigured") {
    throw new ApiError("payment_not_configured", "Payments are not configured yet.", 503);
  }
  const order = await loadOrderByNumber(orderNumber);
  if (!order || order.user_id !== userId) throw notFound("Order not found.");
  if (order.payment_status === "paid") throw badRequest("This order is already paid.");
  if (order.status === "cancelled") throw badRequest("This order was cancelled.");
  if (!["pending_payment", "payment_failed"].includes(order.status)) {
    throw badRequest("This order can no longer be paid online.");
  }

  const db = await getDb();
  const now = new Date().toISOString();

  if (config.mode === "test") {
    const providerOrderId = `test_${order.id}_${randomId("rt").slice(-6)}`;
    await db
      .prepare(
        `INSERT INTO payments (id, order_id, provider, provider_order_id, amount, currency, status, created_at, updated_at)
         VALUES (?, ?, 'test', ?, ?, 'INR', 'created', ?, ?)`,
      )
      .bind(randomId("pay"), order.id, providerOrderId, order.total, now, now)
      .run();
    await db
      .prepare("UPDATE orders SET status = 'pending_payment', payment_status = 'unpaid', updated_at = ? WHERE id = ?")
      .bind(now, order.id)
      .run();
    return { provider: "test", keyId: null, providerOrderId, amount: order.total, currency: "INR" };
  }

  const rzp = await createRazorpayOrder({
    amount: order.total,
    currency: "INR",
    receipt: order.number,
    notes: { orderId: order.id, retry: "true" },
    keyId: config.keyId!,
    keySecret: config.keySecret!,
  });
  await db.batch([
    db
      .prepare(
        `INSERT INTO payments (id, order_id, provider, provider_order_id, amount, currency, status, created_at, updated_at)
         VALUES (?, ?, 'razorpay', ?, ?, 'INR', 'created', ?, ?)`,
      )
      .bind(randomId("pay"), order.id, rzp.id, order.total, now, now),
    db
      .prepare("UPDATE orders SET status = 'pending_payment', payment_status = 'unpaid', updated_at = ? WHERE id = ?")
      .bind(now, order.id),
  ]);
  return { provider: "razorpay", keyId: config.keyId, providerOrderId: rzp.id, amount: order.total, currency: "INR" };
}

/** Test-provider confirmation. Only reachable when payment mode is `test` (never in production). */
export async function confirmTestPayment(userId: string, orderNumber: string): Promise<void> {
  const config = await getPaymentConfig();
  if (config.mode !== "test") {
    throw new ApiError("forbidden", "Test payments are disabled.", 403);
  }
  const order = await loadOrderByNumber(orderNumber);
  if (!order || order.user_id !== userId) throw notFound("Order not found.");
  await markOrderPaid(order.id, { providerPaymentId: `test_payment_${order.id}`, method: "test" });
}

export interface WebhookOutcome {
  status: number;
  body: { received: boolean; outcome: string };
}

/**
 * Razorpay webhook receiver. The raw body is verified with HMAC-SHA256 before a
 * single byte is trusted. Events are deduplicated by (provider, event id) so
 * Razorpay's at-least-once delivery cannot double-apply a payment or refund.
 */
export async function handleRazorpayWebhook(
  rawBody: string,
  signature: string | null,
  eventIdHeader: string | null,
): Promise<WebhookOutcome> {
  const config = await getPaymentConfig();
  if (!config.webhookSecret) {
    throw new ApiError("payment_not_configured", "Webhook secret is not configured.", 503);
  }
  if (!signature) throw new ApiError("forbidden", "Missing webhook signature.", 401);

  const valid = await verifyWebhookSignature({
    rawBody,
    signature,
    secret: config.webhookSecret,
  });
  if (!valid) throw new ApiError("forbidden", "Invalid webhook signature.", 401);

  let event: {
    event?: string;
    payload?: {
      payment?: { entity?: { id?: string; order_id?: string; method?: string; error_code?: string; error_description?: string; amount?: number } };
      refund?: { entity?: { id?: string; payment_id?: string; amount?: number } };
    };
  };
  try {
    event = JSON.parse(rawBody);
  } catch {
    throw badRequest("Invalid webhook payload.");
  }

  const eventType = event.event ?? "unknown";
  const eventId = eventIdHeader ?? (await sha256Hex(rawBody));
  const db = await getDb();

  const inserted = await db
    .prepare(
      `INSERT INTO webhook_events (id, provider, event_id, event_type, status, created_at)
       VALUES (?, 'razorpay', ?, ?, 'received', ?)
       ON CONFLICT(provider, event_id) DO NOTHING`,
    )
    .bind(randomId("wh"), eventId, eventType, new Date().toISOString())
    .run();

  if ((inserted.meta.changes ?? 0) === 0) {
    return { status: 200, body: { received: true, outcome: "duplicate_ignored" } };
  }

  let outcome = "ignored";
  try {
    const payment = event.payload?.payment?.entity;
    if (payment?.order_id && (eventType === "payment.captured" || eventType === "order.paid")) {
      const row = await firstRow<{ order_id: string }>(
        "SELECT order_id FROM payments WHERE provider_order_id = ?",
        [payment.order_id],
      );
      if (row) {
        const result = await markOrderPaid(row.order_id, {
          providerPaymentId: payment.id ?? null,
          method: payment.method ?? null,
        });
        outcome = result.changed ? "order_marked_paid" : "already_paid";
      }
    } else if (payment?.order_id && eventType === "payment.failed") {
      const row = await firstRow<{ order_id: string }>(
        "SELECT order_id FROM payments WHERE provider_order_id = ?",
        [payment.order_id],
      );
      if (row) {
        await markPaymentFailed(row.order_id, {
          code: payment.error_code ?? null,
          description: payment.error_description ?? null,
        });
        outcome = "payment_marked_failed";
      }
    } else if (eventType.startsWith("refund.") && event.payload?.refund?.entity?.id) {
      const refundId = event.payload.refund.entity.id;
      await db
        .prepare(
          "UPDATE refunds SET status = 'completed', provider_refund_id = ?, processed_at = ?, updated_at = ? WHERE provider_refund_id = ?",
        )
        .bind(refundId, new Date().toISOString(), new Date().toISOString(), refundId)
        .run();
      outcome = "refund_updated";
    }

    await db
      .prepare("UPDATE webhook_events SET status = ?, processed_at = ? WHERE provider = 'razorpay' AND event_id = ?")
      .bind(outcome === "ignored" ? "ignored" : "processed", new Date().toISOString(), eventId)
      .run();
  } catch (error) {
    await db
      .prepare("UPDATE webhook_events SET status = 'failed', error = ? WHERE provider = 'razorpay' AND event_id = ?")
      .bind(error instanceof Error ? error.message.slice(0, 300) : "unknown", eventId)
      .run();
    throw error;
  }

  return { status: 200, body: { received: true, outcome } };
}

export async function orderItemsForTracking(orderId: string) {
  return allRows<{ product_name: string; variant_name: string; quantity: number; line_total: number }>(
    "SELECT product_name, variant_name, quantity, line_total FROM order_items WHERE order_id = ?",
    [orderId],
  );
}

export { releaseOrder };
