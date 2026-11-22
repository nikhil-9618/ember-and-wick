import { allRows, firstRow, getDb } from "@/lib/db";
import { randomId } from "@/lib/crypto";
import { assertSameOrigin, apiRoute, json, readJson } from "@/lib/http";
import { refundSchema } from "@/lib/validation";
import { ApiError, badRequest, notFound } from "@/lib/errors";
import { requireAdmin } from "@/lib/auth";
import { getPaymentConfig } from "@/lib/config";
import { createRazorpayRefund } from "@/lib/payments/razorpay";
import { notify } from "@/lib/services/notify";

export const GET = apiRoute(async (request) => {
  await requireAdmin(request);
  const refunds = await allRows(
    `SELECT r.id, r.order_id, r.amount, r.reason, r.status, r.provider_refund_id, r.created_at, r.processed_at,
            o.number AS order_number, o.email
       FROM refunds r JOIN orders o ON o.id = r.order_id
      ORDER BY r.created_at DESC LIMIT 100`,
  );
  return json({ refunds });
});

export const POST = apiRoute(async (request) => {
  assertSameOrigin(request);
  await requireAdmin(request);
  const input = await readJson(request, refundSchema);
  const db = await getDb();
  const config = await getPaymentConfig();

  const order = await firstRow<{
    id: string;
    number: string;
    user_id: string | null;
    total: number;
    payment_status: string;
  }>("SELECT id, number, user_id, total, payment_status FROM orders WHERE number = ?", [input.orderId]);
  if (!order) throw notFound("Order not found.");
  if (order.payment_status !== "paid" && order.payment_status !== "partially_refunded") {
    throw badRequest("Only paid orders can be refunded.");
  }

  const paidPayment = await firstRow<{
    id: string;
    provider: string;
    provider_payment_id: string | null;
    status: string;
  }>(
    "SELECT id, provider, provider_payment_id, status FROM payments WHERE order_id = ? AND status IN ('captured','refunded') ORDER BY created_at DESC LIMIT 1",
    [order.id],
  );
  if (!paidPayment) throw badRequest("There is no captured payment to refund.");

  const refundedRow = await firstRow<{ total: number }>(
    "SELECT COALESCE(SUM(amount), 0) AS total FROM refunds WHERE order_id = ? AND status IN ('requested','processing','completed')",
    [order.id],
  );
  const alreadyRefunded = refundedRow?.total ?? 0;
  const refundable = order.total - alreadyRefunded;
  if (input.amount > refundable) throw badRequest(`You can refund at most ₹${(refundable / 100).toFixed(2)} on this order.`);

  const refundId = randomId("ref");
  const now = new Date().toISOString();
  await db
    .prepare(
      `INSERT INTO refunds (id, order_id, payment_id, amount, reason, status, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, 'processing', ?, ?)`,
    )
    .bind(refundId, order.id, paidPayment.id, input.amount, input.reason, now, now)
    .run();

  let providerRefundId: string | null = null;
  try {
    if (config.mode === "razorpay") {
      if (!paidPayment.provider_payment_id) throw new ApiError("payment_error", "This payment has no provider id.", 409);
      const refund = await createRazorpayRefund({
        paymentId: paidPayment.provider_payment_id,
        amount: input.amount,
        notes: { orderId: order.id, reason: input.reason },
        keyId: config.keyId!,
        keySecret: config.keySecret!,
      });
      providerRefundId = refund.id;
    } else if (config.mode === "test") {
      providerRefundId = `test_refund_${refundId}`;
    } else {
      throw new ApiError("payment_not_configured", "Payments are not configured, so refunds cannot be processed.", 503);
    }
  } catch (error) {
    await db
      .prepare("UPDATE refunds SET status = 'failed', updated_at = ? WHERE id = ?")
      .bind(new Date().toISOString(), refundId)
      .run();
    throw error;
  }

  const fullyRefunded = alreadyRefunded + input.amount >= order.total;
  const completedNow = config.mode === "test";
  const doneAt = new Date().toISOString();
  await db.batch([
    db
      .prepare(
        "UPDATE refunds SET status = ?, provider_refund_id = ?, processed_at = ?, updated_at = ? WHERE id = ?",
      )
      .bind(completedNow ? "completed" : "processing", providerRefundId, completedNow ? doneAt : null, doneAt, refundId),
    db
      .prepare("UPDATE orders SET payment_status = ?, status = ?, updated_at = ? WHERE id = ?")
      .bind(fullyRefunded ? "refunded" : "partially_refunded", fullyRefunded ? "refunded" : "paid", doneAt, order.id),
  ]);

  if (order.user_id) {
    await notify(db, {
      userId: order.user_id,
      type: "refund",
      title: `Refund started for ${order.number}`,
      body: `We've initiated a refund of ₹${(input.amount / 100).toFixed(2)}. Bank timelines are typically 5-7 business days.`,
      data: { orderNumber: order.number, amount: input.amount, refundId },
    });
  }

  return json({ id: refundId, status: completedNow ? "completed" : "processing", providerRefundId }, { status: 201 });
});
