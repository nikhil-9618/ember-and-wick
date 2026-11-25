import { getDb } from "@/lib/db";
import { assertSameOrigin, apiRoute, json } from "@/lib/http";
import { ApiError, conflict, notFound } from "@/lib/errors";
import { requireAdmin } from "@/lib/auth";
import { checkRefundApproval } from "@/lib/refunds";
import { auditActor, insertAuditLog } from "@/lib/services/audit";
import { executeRefund, type RefundableOrder } from "@/lib/services/refunds";

export const POST = apiRoute<{ params: Promise<{ id: string }> }>(async (request, { params }) => {
  assertSameOrigin(request);
  const auth = await requireAdmin(request);
  const { id } = await params;
  const db = await getDb();

  const refund = await db.refunds.findOne({ _id: id });
  if (!refund) throw notFound("Refund not found.");
  const r = refund as any;

  const order = await db.orders.findOne({ _id: r.order_id });
  if (!order) throw notFound("Order not found.");
  const o = order as any;

  const payment = r.payment_id
    ? await db.payments.findOne({ _id: r.payment_id })
    : await db.payments.find({ order_id: r.order_id, status: { $in: ["captured", "refunded"] } }).sort({ created_at: -1 }).limit(1).toArray().then((x: any[]) => x[0]);

  const row = {
    id: r._id,
    order_id: r.order_id,
    payment_id: r.payment_id,
    amount: r.amount,
    reason: r.reason,
    status: r.status,
    created_by: r.created_by,
    order_number: o.number,
    order_user_id: o.user_id,
    order_total: o.total,
    order_status: o.status,
    payment_status: o.payment_status,
    payment_provider: (payment as any)?.provider ?? null,
    provider_payment_id: (payment as any)?.provider_payment_id ?? null,
  };

  const check = checkRefundApproval({ status: row.status, createdBy: row.created_by }, auth.user.id);
  if (!check.ok) {
    if (check.code === "self_approval") throw new ApiError("forbidden", check.message, 403);
    throw conflict(check.message);
  }

  const now = new Date().toISOString();
  const actor = auditActor(auth);
  const claimed = await db.refunds.updateOne(
    { _id: id, status: "requested" },
    { $set: { status: "processing", approved_by: auth.user.id, approved_at: now, updated_at: now } },
  );
  if ((claimed as any).modifiedCount !== 1) {
    throw conflict("This refund is already being processed.");
  }

  await insertAuditLog(db, {
    actor,
    action: "refund.approved",
    entityType: "refund",
    entityId: id,
    summary: `Approved refund of ₹${(row.amount / 100).toFixed(2)} for ${row.order_number}`,
    detail: { orderId: row.order_id, amount: row.amount, requestedBy: row.created_by },
    at: now,
  });

  const refundableOrder: RefundableOrder = {
    id: row.order_id,
    number: row.order_number,
    user_id: row.order_user_id,
    total: row.order_total,
    status: row.order_status,
    payment_status: row.payment_status,
  };

  const result = await executeRefund({
    refund: {
      id: row.id,
      amount: row.amount,
      reason: row.reason,
      order: refundableOrder,
      payment: {
        id: row.payment_id ?? "",
        provider: row.payment_provider ?? "razorpay",
        provider_payment_id: row.provider_payment_id,
        status: "captured",
      },
    },
    actor,
    action: "refund.approved",
  });

  return json({ id: row.id, status: result.status, providerRefundId: result.providerRefundId });
});