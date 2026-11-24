import type { D1PreparedStatement } from "../types-d1";
import { firstRow, getDb } from "../db";
import { ApiError, badRequest, notFound } from "../errors";
import { getPaymentConfig } from "../config";
import { createRazorpayRefund } from "../payments/razorpay";
import { notify } from "./notify";
import { auditStatement, type AuditActor } from "./audit";
import { statusHistoryStatement } from "../history";

export interface RefundableOrder {
  id: string;
  number: string;
  user_id: string | null;
  total: number;
  status: string;
  payment_status: string;
}

export interface CapturedPayment {
  id: string;
  provider: string;
  provider_payment_id: string | null;
  status: string;
}

export interface RefundToExecute {
  id: string;
  amount: number;
  reason: string;
  order: RefundableOrder;
  payment: CapturedPayment;
}

/** Refunds counted against the order total: approved, in flight, or done. */
export async function reservedRefundTotal(orderId: string, excludeRefundId?: string): Promise<number> {
  const row = await firstRow<{ total: number }>(
    `SELECT COALESCE(SUM(amount), 0) AS total FROM refunds
      WHERE order_id = ? AND id != ? AND status IN ('requested', 'processing', 'completed')`,
    [orderId, excludeRefundId ?? ""],
  );
  return row?.total ?? 0;
}

export async function loadRefundableOrder(number: string): Promise<RefundableOrder> {
  const order = await firstRow<RefundableOrder>(
    "SELECT id, number, user_id, total, status, payment_status FROM orders WHERE number = ?",
    [number],
  );
  if (!order) throw notFound("Order not found.");
  if (order.payment_status !== "paid" && order.payment_status !== "partially_refunded") {
    throw badRequest("Only paid orders can be refunded.");
  }
  return order;
}

export async function loadCapturedPayment(orderId: string): Promise<CapturedPayment> {
  const payment = await firstRow<CapturedPayment>(
    "SELECT id, provider, provider_payment_id, status FROM payments WHERE order_id = ? AND status IN ('captured','refunded') ORDER BY created_at DESC LIMIT 1",
    [orderId],
  );
  if (!payment) throw badRequest("There is no captured payment to refund.");
  return payment;
}

/**
 * Sends one refund to the provider and records the outcome.
 *
 * Duplicate execution is prevented in three places: callers claim the refund row
 * with a status-guarded UPDATE first, `refunds.provider_refund_id` is UNIQUE, and
 * every write here happens in a single batch with the order update.
 */
export async function executeRefund(input: {
  refund: RefundToExecute;
  actor: AuditActor;
  action: "refund.created" | "refund.approved";
}): Promise<{ status: "completed" | "processing"; providerRefundId: string | null }> {
  const { refund, actor, action } = input;
  const db = await getDb();
  const config = await getPaymentConfig();
  const amountLabel = `₹${(refund.amount / 100).toFixed(2)}`;

  let providerRefundId: string | null = null;
  try {
    if (config.mode === "razorpay") {
      if (!refund.payment.provider_payment_id) {
        throw new ApiError("payment_error", "This payment has no provider id.", 409);
      }
      const providerRefund = await createRazorpayRefund({
        paymentId: refund.payment.provider_payment_id,
        amount: refund.amount,
        notes: { orderId: refund.order.id, reason: refund.reason },
        keyId: config.keyId!,
        keySecret: config.keySecret!,
      });
      providerRefundId = providerRefund.id;
    } else if (config.mode === "test" || config.mode === "demo") {
      providerRefundId = `${config.mode}_refund_${refund.id}`;
    } else {
      throw new ApiError("payment_not_configured", "Payments are not configured, so refunds cannot be processed.", 503);
    }
  } catch (error) {
    const failedAt = new Date().toISOString();
    await db.batch([
      db.prepare("UPDATE refunds SET status = 'failed', updated_at = ? WHERE id = ?").bind(failedAt, refund.id),
      auditStatement(db, {
        actor,
        action: "refund.failed",
        entityType: "refund",
        entityId: refund.id,
        summary: `Refund of ${amountLabel} for ${refund.order.number} failed at the provider`,
        detail: { orderId: refund.order.id, amount: refund.amount, error: error instanceof Error ? error.message : "unknown" },
        at: failedAt,
      }),
    ]);
    throw error;
  }

  const alreadyRefunded = await reservedRefundTotal(refund.order.id, refund.id);
  const fullyRefunded = alreadyRefunded + refund.amount >= refund.order.total;
  const completedNow = config.mode === "test" || config.mode === "demo";
  const doneAt = new Date().toISOString();

  const statements: D1PreparedStatement[] = [
    db
      .prepare("UPDATE refunds SET status = ?, provider_refund_id = ?, processed_at = ?, updated_at = ? WHERE id = ?")
      .bind(completedNow ? "completed" : "processing", providerRefundId, completedNow ? doneAt : null, doneAt, refund.id),
    db
      .prepare("UPDATE orders SET payment_status = ?, status = ?, updated_at = ? WHERE id = ?")
      .bind(
        fullyRefunded ? "refunded" : "partially_refunded",
        // A partial refund must not drag a shipped/delivered order back to `paid`.
        fullyRefunded ? "refunded" : refund.order.status,
        doneAt,
        refund.order.id,
      ),
    auditStatement(db, {
      actor,
      action: "refund.completed",
      entityType: "refund",
      entityId: refund.id,
      summary: `${action === "refund.approved" ? "Approved" : "Issued"} refund of ${amountLabel} for ${refund.order.number}`,
      detail: {
        orderId: refund.order.id,
        amount: refund.amount,
        reason: refund.reason,
        fullyRefunded,
        providerRefundId,
        mode: config.mode,
      },
      at: doneAt,
    }),
  ];

  if (fullyRefunded) {
    statements.push(
      statusHistoryStatement(db, {
        orderId: refund.order.id,
        fromStatus: refund.order.status,
        toStatus: "refunded",
        actor: { type: "admin", id: actor.id, label: actor.email },
        reason: `Full refund of ${amountLabel}: ${refund.reason}`,
        at: doneAt,
      }),
    );
  }

  await db.batch(statements);

  if (refund.order.user_id) {
    await notify(db, {
      userId: refund.order.user_id,
      type: "refund",
      title: `Refund started for ${refund.order.number}`,
      body: `We've initiated a refund of ${amountLabel}. Bank timelines are typically 5-7 business days.`,
      data: { orderNumber: refund.order.number, amount: refund.amount, refundId: refund.id },
    });
  }

  return { status: completedNow ? "completed" : "processing", providerRefundId };
}
