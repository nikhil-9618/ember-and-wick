import { withTransaction, isDuplicateKeyError } from "../db";
import { randomId, sha256Hex } from "../crypto";
import { ApiError, badRequest, notFound } from "../errors";
import { getPaymentConfig } from "../config";
import { createRazorpayOrder, verifyPaymentSignature, verifyWebhookSignature } from "../payments/razorpay";
import { releaseOrder } from "./checkout";
import { insertNotification } from "./notify";
import { insertStatusHistory } from "../history";
import type { StatusActor } from "../history";

interface OrderRow {
  _id: string;
  number: string;
  user_id: string | null;
  status: string;
  payment_status: string;
  total: number;
  coupon_code: string | null;
  email: string;
}

async function loadOrderByNumber(number: string): Promise<OrderRow | null> {
  const db = await (await import("../db")).getDb();
  const row = await db.orders.findOne({ number });
  return row ? mapOrder(row) : null;
}

async function loadOrderById(id: string): Promise<OrderRow | null> {
  const db = await (await import("../db")).getDb();
  const row = await db.orders.findOne({ _id: id });
  return row ? mapOrder(row) : null;
}

function mapOrder(row: any): OrderRow {
  return {
    _id: row._id,
    number: row.number,
    user_id: row.user_id,
    status: row.status,
    payment_status: row.payment_status,
    total: row.total,
    coupon_code: row.coupon_code,
    email: row.email,
  };
}

export async function markOrderPaid(
  orderId: string,
  payment: { providerPaymentId: string | null; method?: string | null },
  actor: StatusActor = { type: "system", label: "Ember & Wick" },
): Promise<{ changed: boolean }> {
  const db = await (await import("../db")).getDb();
  const order = await loadOrderById(orderId);
  if (!order) throw notFound("Order not found.");

  if (order.payment_status === "paid") return { changed: false };
  if (order.status === "cancelled") {
    throw new ApiError("conflict", "This order was cancelled before payment completed.", 409);
  }

  const now = new Date().toISOString();
  try {
    await withTransaction(async (tx) => {
      const res = await tx.orders.updateOne(
        { _id: orderId, payment_status: { $ne: "paid" } },
        { $set: { status: "paid", payment_status: "paid", paid_at: now, updated_at: now } },
      );
      if ((res as any).modifiedCount === 0) return;

      if (payment.providerPaymentId) {
        // stamp the newest created/authorized/failed payment
        const pays = await tx.payments
          .find({ order_id: orderId, status: { $in: ["created", "authorized", "failed"] } })
          .sort({ created_at: -1, _id: -1 })
          .limit(1)
          .toArray();
        const pay = (pays as any[])[0];
        if (pay) {
          await tx.payments.updateOne(
            { _id: pay._id },
            { $set: { provider_payment_id: payment.providerPaymentId, status: "captured", method: payment.method ?? null, updated_at: now } },
          );
        }
      } else {
        await tx.payments.updateMany(
          { order_id: orderId, status: { $ne: "refunded" } },
          { $set: { status: "captured", updated_at: now } },
        );
      }

      await insertStatusHistory(tx, {
        orderId,
        fromStatus: order.status,
        toStatus: "paid",
        actor,
        reason: "Payment captured",
        at: now,
      });

      if (order.user_id) {
        await insertNotification(tx, {
          userId: order.user_id,
          type: "order_paid",
          title: `Payment received for ${order.number}`,
          body: "We're getting your candles ready. You'll get another update when your order ships.",
          data: { orderNumber: order.number },
        });
      }
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    if (/duplicate key|E11000/i.test(message)) {
      throw new ApiError("payment_error", "This payment has already been used for another order.", 409);
    }
    throw error;
  }

  return { changed: true };
}

export async function markPaymentFailed(
  orderId: string,
  detail: { code?: string | null; description?: string | null },
  actor: StatusActor = { type: "system", label: "Ember & Wick" },
): Promise<void> {
  const db = await (await import("../db")).getDb();
  const order = await loadOrderById(orderId);
  if (!order || order.payment_status === "paid" || order.status === "cancelled") return;
  const now = new Date().toISOString();
  await withTransaction(async (tx) => {
    await tx.orders.updateOne(
      { _id: orderId, payment_status: "unpaid" },
      { $set: { status: "payment_failed", payment_status: "failed", updated_at: now } },
    );
    await tx.payments.updateMany(
      { order_id: orderId, status: "created" },
      { $set: { status: "failed", error_code: detail.code ?? null, error_description: detail.description ?? null, updated_at: now } },
    );
    await insertStatusHistory(tx, {
      orderId,
      fromStatus: order.status,
      toStatus: "payment_failed",
      actor,
      reason: detail.description ? detail.description.slice(0, 300) : "Payment failed",
      at: now,
    });
  });
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

  const db = await (await import("../db")).getDb();
  const paymentRow = await db.payments
    .find({ order_id: order._id })
    .sort({ created_at: -1 })
    .limit(1)
    .toArray();
  const prow = (paymentRow as any[])[0];
  if (!prow) throw notFound("No payment is attached to this order.");
  if (prow.provider_order_id !== input.providerOrderId) {
    throw badRequest("This payment does not belong to the order.");
  }
  if (prow.amount !== order.total) {
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

  const result = await markOrderPaid(order._id, { providerPaymentId: input.providerPaymentId }, {
    type: "customer",
    id: input.userId,
    label: order.email,
  });
  return { orderNumber: order.number, status: "paid", alreadyProcessed: !result.changed };
}

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

  const db = await (await import("../db")).getDb();
  const now = new Date().toISOString();

  if (config.mode === "test") {
    const provider = "test";
    const providerOrderId = `${provider}_${order._id}_${randomId("rt").slice(-6)}`;
    await withTransaction(async (tx) => {
      await tx.payments.insertOne({
        _id: randomId("pay"),
        order_id: order._id,
        provider,
        provider_order_id: providerOrderId,
        provider_payment_id: null,
        amount: order.total,
        currency: "INR",
        status: "created",
        method: null,
        error_code: null,
        error_description: null,
        created_at: now,
        updated_at: now,
      } as any);
      await tx.orders.updateOne(
        { _id: order._id },
        { $set: { status: "pending_payment", payment_status: "unpaid", updated_at: now } },
      );
      if (order.status !== "pending_payment") {
        await insertStatusHistory(tx, {
          orderId: order._id,
          fromStatus: order.status,
          toStatus: "pending_payment",
          actor: { type: "customer", id: userId, label: order.email },
          reason: "Payment retried",
          at: now,
        });
      }
    });
    return { provider, keyId: null, providerOrderId, amount: order.total, currency: "INR" };
  }

  const rzp = await createRazorpayOrder({
    amount: order.total,
    currency: "INR",
    receipt: order.number,
    notes: { orderId: order._id, retry: "true" },
    keyId: config.keyId!,
    keySecret: config.keySecret!,
  });
  await withTransaction(async (tx) => {
    await tx.payments.insertOne({
      _id: randomId("pay"),
      order_id: order._id,
      provider: "razorpay",
      provider_order_id: rzp.id,
      provider_payment_id: null,
      amount: order.total,
      currency: "INR",
      status: "created",
      method: null,
      error_code: null,
      error_description: null,
      created_at: now,
      updated_at: now,
    } as any);
    await tx.orders.updateOne(
      { _id: order._id },
      { $set: { status: "pending_payment", payment_status: "unpaid", updated_at: now } },
    );
    if (order.status !== "pending_payment") {
      await insertStatusHistory(tx, {
        orderId: order._id,
        fromStatus: order.status,
        toStatus: "pending_payment",
        actor: { type: "customer", id: userId, label: order.email },
        reason: "Payment retried",
        at: now,
      });
    }
  });
  return { provider: "razorpay", keyId: config.keyId, providerOrderId: rzp.id, amount: order.total, currency: "INR" };
}

export async function confirmTestPayment(userId: string, orderNumber: string): Promise<void> {
  const config = await getPaymentConfig();
  if (config.mode !== "test") {
    throw new ApiError("forbidden", "Simulated payments are disabled.", 403);
  }
  const order = await loadOrderByNumber(orderNumber);
  if (!order || order.user_id !== userId) throw notFound("Order not found.");
  await markOrderPaid(
    order._id,
    { providerPaymentId: `test_payment_${order._id}`, method: "test" },
    { type: "customer", id: userId, label: order.email },
  );
}

export interface WebhookOutcome {
  status: number;
  body: { received: boolean; outcome: string };
}

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

  const valid = await verifyWebhookSignature({ rawBody, signature, secret: config.webhookSecret });
  if (!valid) throw new ApiError("forbidden", "Invalid webhook signature.", 401);

  let event: any;
  try {
    event = JSON.parse(rawBody);
  } catch {
    throw badRequest("Invalid webhook payload.");
  }

  const eventType = event.event ?? "unknown";
  const eventId = eventIdHeader ?? (await sha256Hex(rawBody));
  const db = await (await import("../db")).getDb();
  const now = new Date().toISOString();

  try {
    await db.webhook_events.insertOne({
      _id: randomId("wh"),
      provider: "razorpay",
      event_id: eventId,
      event_type: eventType,
      status: "received",
      error: null,
      created_at: now,
      processed_at: null,
    } as any);
  } catch (error) {
    if (isDuplicateKeyError(error)) {
      return { status: 200, body: { received: true, outcome: "duplicate_ignored" } };
    }
    throw error;
  }

  let outcome = "ignored";
  try {
    const payment = event.payload?.payment?.entity;
    if (payment?.order_id && (eventType === "payment.captured" || eventType === "order.paid")) {
      const row = await db.payments.findOne({ provider_order_id: payment.order_id });
      if (row) {
        const result = await markOrderPaid(
          row.order_id,
          { providerPaymentId: payment.id ?? null, method: payment.method ?? null },
          { type: "webhook", label: "Razorpay webhook" },
        );
        outcome = result.changed ? "order_marked_paid" : "already_paid";
      }
    } else if (payment?.order_id && eventType === "payment.failed") {
      const row = await db.payments.findOne({ provider_order_id: payment.order_id });
      if (row) {
        await markPaymentFailed(
          row.order_id,
          { code: payment.error_code ?? null, description: payment.error_description ?? null },
          { type: "webhook", label: "Razorpay webhook" },
        );
        outcome = "payment_marked_failed";
      }
    } else if (eventType.startsWith("refund.") && event.payload?.refund?.entity?.id) {
      const refundId = event.payload.refund.entity.id;
      await db.refunds.updateOne(
        { provider_refund_id: refundId },
        { $set: { status: "completed", provider_refund_id: refundId, processed_at: now, updated_at: now } },
      );
      outcome = "refund_updated";
    }

    await db.webhook_events.updateOne(
      { provider: "razorpay", event_id: eventId },
      { $set: { status: outcome === "ignored" ? "ignored" : "processed", processed_at: new Date().toISOString() } },
    );
  } catch (error) {
    await db.webhook_events.updateOne(
      { provider: "razorpay", event_id: eventId },
      { $set: { status: "failed", error: error instanceof Error ? error.message.slice(0, 300) : "unknown" } },
    );
    throw error;
  }

  return { status: 200, body: { received: true, outcome } };
}

export async function orderItemsForTracking(orderId: string) {
  const db = await (await import("../db")).getDb();
  const rows = await db.order_items.find({ order_id: orderId }).toArray();
  return (rows as any[]).map((r) => ({
    product_name: r.product_name,
    variant_name: r.variant_name,
    quantity: r.quantity,
    line_total: r.line_total,
  }));
}

export { releaseOrder };
