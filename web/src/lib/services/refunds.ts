import { withTransaction } from "../db";
import { ApiError, badRequest, notFound } from "../errors";
import { getPaymentConfig } from "../config";
import { createRazorpayRefund } from "../payments/razorpay";
import { notify } from "./notify";
import { insertAuditLog } from "./audit";
import { insertStatusHistory } from "../history";
import type { AuditActor } from "./audit";

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

export async function reservedRefundTotal(orderId: string, excludeRefundId?: string): Promise<number> {
  const db = await (await import("../db")).getDb();
  const match: Record<string, unknown> = {
    order_id: orderId,
    status: { $in: ["requested", "processing", "completed"] },
  };
  if (excludeRefundId) match._id = { $ne: excludeRefundId };
  const agg = await db.refunds
    .aggregate<{ total: number }>([{ $match: match }, { $group: { _id: null, total: { $sum: "$amount" } } }])
    .toArray();
  return (agg[0]?.total ?? 0) as number;
}

export async function loadRefundableOrder(number: string): Promise<RefundableOrder> {
  const db = await (await import("../db")).getDb();
  const order = await db.orders.findOne({ number });
  if (!order) throw notFound("Order not found.");
  const o = order as any;
  if (o.payment_status !== "paid" && o.payment_status !== "partially_refunded") {
    throw badRequest("Only paid orders can be refunded.");
  }
  return {
    id: o._id,
    number: o.number,
    user_id: o.user_id,
    total: o.total,
    status: o.status,
    payment_status: o.payment_status,
  };
}

export async function loadCapturedPayment(orderId: string): Promise<CapturedPayment> {
  const db = await (await import("../db")).getDb();
  const payment = await db.payments
    .find({ order_id: orderId, status: { $in: ["captured", "refunded"] } })
    .sort({ created_at: -1 })
    .limit(1)
    .toArray();
  const p = (payment as any[])[0];
  if (!p) throw badRequest("There is no captured payment to refund.");
  return { id: p._id, provider: p.provider, provider_payment_id: p.provider_payment_id, status: p.status };
}

export async function executeRefund(input: {
  refund: RefundToExecute;
  actor: AuditActor;
  action: "refund.created" | "refund.approved";
}): Promise<{ status: "completed" | "processing"; providerRefundId: string | null }> {
  const { refund, actor, action } = input;
  const db = await (await import("../db")).getDb();
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
    } else if (config.mode === "test") {
      providerRefundId = `test_refund_${refund.id}`;
    } else {
      throw new ApiError("payment_not_configured", "Payments are not configured, so refunds cannot be processed.", 503);
    }
  } catch (error) {
    const failedAt = new Date().toISOString();
    await db.refunds.updateOne({ _id: refund.id }, { $set: { status: "failed", updated_at: failedAt } });
    await insertAuditLog(db, {
      actor,
      action: "refund.failed",
      entityType: "refund",
      entityId: refund.id,
      summary: `Refund of ${amountLabel} for ${refund.order.number} failed at the provider`,
      detail: { orderId: refund.order.id, amount: refund.amount, error: error instanceof Error ? error.message : "unknown" },
      at: failedAt,
    });
    throw error;
  }

  const alreadyRefunded = await reservedRefundTotal(refund.order.id, refund.id);
  const fullyRefunded = alreadyRefunded + refund.amount >= refund.order.total;
  const completedNow = config.mode === "test";
  const doneAt = new Date().toISOString();

  await withTransaction(async (tx) => {
    await tx.refunds.updateOne(
      { _id: refund.id },
      { $set: { status: completedNow ? "completed" : "processing", provider_refund_id: providerRefundId, processed_at: completedNow ? doneAt : null, updated_at: doneAt } },
    );
    await tx.orders.updateOne(
      { _id: refund.order.id },
      { $set: { payment_status: fullyRefunded ? "refunded" : "partially_refunded", status: fullyRefunded ? "refunded" : refund.order.status, updated_at: doneAt } },
    );
    await insertAuditLog(tx, {
      actor,
      action: "refund.completed",
      entityType: "refund",
      entityId: refund.id,
      summary: `${action === "refund.approved" ? "Approved" : "Issued"} refund of ${amountLabel} for ${refund.order.number}`,
      detail: { orderId: refund.order.id, amount: refund.amount, reason: refund.reason, fullyRefunded, providerRefundId, mode: config.mode },
      at: doneAt,
    });
    if (fullyRefunded) {
      await insertStatusHistory(tx, {
        orderId: refund.order.id,
        fromStatus: refund.order.status,
        toStatus: "refunded",
        actor: { type: "admin", id: actor.id, label: actor.email },
        reason: `Full refund of ${amountLabel}: ${refund.reason}`,
        at: doneAt,
      });
    }
  });

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
