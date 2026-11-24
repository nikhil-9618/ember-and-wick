import { firstRow, getDb } from "@/lib/db";
import { assertSameOrigin, apiRoute, json } from "@/lib/http";
import { ApiError, conflict, notFound } from "@/lib/errors";
import { requireAdmin } from "@/lib/auth";
import { checkRefundApproval } from "@/lib/refunds";
import { auditActor, auditStatement } from "@/lib/services/audit";
import { executeRefund, type RefundableOrder } from "@/lib/services/refunds";

interface RefundRow {
  id: string;
  order_id: string;
  payment_id: string | null;
  amount: number;
  reason: string;
  status: string;
  created_by: string | null;
  order_number: string;
  order_user_id: string | null;
  order_total: number;
  order_status: string;
  payment_status: string;
  payment_provider: string | null;
  provider_payment_id: string | null;
}

/**
 * Approves a refund that was held for a second pair of eyes. The status claim is
 * a conditional UPDATE, so two admins clicking approve at once can only produce
 * one provider refund; the loser gets a 409 and nothing is sent.
 */
export const POST = apiRoute<{ params: Promise<{ id: string }> }>(async (request, { params }) => {
  assertSameOrigin(request);
  const auth = await requireAdmin(request);
  const { id } = await params;
  const db = await getDb();

  const row = await firstRow<RefundRow>(
    `SELECT r.id, r.order_id, r.payment_id, r.amount, r.reason, r.status, r.created_by,
            o.number AS order_number, o.user_id AS order_user_id, o.total AS order_total,
            o.status AS order_status, o.payment_status,
            p.provider AS payment_provider, p.provider_payment_id
       FROM refunds r
       JOIN orders o ON o.id = r.order_id
       LEFT JOIN payments p ON p.id = r.payment_id
      WHERE r.id = ?`,
    [id],
  );
  if (!row) throw notFound("Refund not found.");

  const check = checkRefundApproval({ status: row.status, createdBy: row.created_by }, auth.user.id);
  if (!check.ok) {
    if (check.code === "self_approval") throw new ApiError("forbidden", check.message, 403);
    throw conflict(check.message);
  }

  const now = new Date().toISOString();
  const actor = auditActor(auth);
  const claimed = await db
    .prepare(
      "UPDATE refunds SET status = 'processing', approved_by = ?, approved_at = ?, updated_at = ? WHERE id = ? AND status = 'requested'",
    )
    .bind(auth.user.id, now, now, row.id)
    .run();
  if ((claimed.meta.changes ?? 0) !== 1) {
    throw conflict("This refund is already being processed.");
  }

  await auditStatement(db, {
    actor,
    action: "refund.approved",
    entityType: "refund",
    entityId: row.id,
    summary: `Approved refund of ₹${(row.amount / 100).toFixed(2)} for ${row.order_number}`,
    detail: { orderId: row.order_id, amount: row.amount, requestedBy: row.created_by },
    at: now,
  }).run();

  const order: RefundableOrder = {
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
      order,
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
