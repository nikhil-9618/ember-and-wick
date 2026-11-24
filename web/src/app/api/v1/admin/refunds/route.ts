import { allRows, firstRow, getDb } from "@/lib/db";
import { randomId } from "@/lib/crypto";
import { assertSameOrigin, apiRoute, json, readJson } from "@/lib/http";
import { refundSchema } from "@/lib/validation";
import { badRequest, conflict } from "@/lib/errors";
import { requireAdmin } from "@/lib/auth";
import { getRefundPolicy } from "@/lib/config";
import { refundRequiresApproval } from "@/lib/refunds";
import { auditActor, auditStatement } from "@/lib/services/audit";
import {
  executeRefund,
  loadCapturedPayment,
  loadRefundableOrder,
  reservedRefundTotal,
} from "@/lib/services/refunds";

export const GET = apiRoute(async (request) => {
  await requireAdmin(request);
  const policy = await getRefundPolicy();
  const status = new URL(request.url).searchParams.get("status");
  const where = status && ["requested", "processing", "completed", "failed"].includes(status) ? "WHERE r.status = ?" : "";
  const refunds = await allRows(
    `SELECT r.id, r.order_id, r.amount, r.reason, r.status, r.provider_refund_id, r.created_at, r.processed_at,
            r.created_by, r.approved_by, r.approved_at,
            o.number AS order_number, o.email,
            requester.email AS requested_by_email, approver.email AS approved_by_email
       FROM refunds r
       JOIN orders o ON o.id = r.order_id
       LEFT JOIN users requester ON requester.id = r.created_by
       LEFT JOIN users approver ON approver.id = r.approved_by
       ${where}
      ORDER BY r.created_at DESC LIMIT 100`,
    where ? [status] : [],
  );
  return json({ refunds, refundPolicy: policy });
});

export const POST = apiRoute(async (request) => {
  assertSameOrigin(request);
  const auth = await requireAdmin(request);
  const input = await readJson(request, refundSchema);
  const db = await getDb();
  const policy = await getRefundPolicy();
  const actor = auditActor(auth);

  // A retried submission with the same request key returns the original refund
  // instead of moving money twice. This runs before any state validation so a
  // replay still succeeds after the first request changed the order.
  if (input.requestKey) {
    const existing = await firstRow<{ id: string; status: string; provider_refund_id: string | null }>(
      "SELECT id, status, provider_refund_id FROM refunds WHERE request_key = ?",
      [input.requestKey],
    );
    if (existing) {
      return json({
        id: existing.id,
        status: existing.status,
        providerRefundId: existing.provider_refund_id,
        requiresApproval: existing.status === "requested",
        duplicate: true,
      });
    }
  }

  const order = await loadRefundableOrder(input.orderId);
  const paidPayment = await loadCapturedPayment(order.id);

  const alreadyRefunded = await reservedRefundTotal(order.id);
  const refundable = order.total - alreadyRefunded;
  if (input.amount > refundable) throw badRequest(`You can refund at most ₹${(refundable / 100).toFixed(2)} on this order.`);

  const needsApproval = refundRequiresApproval(input.amount, policy.approvalThresholdPaise);
  const refundId = randomId("ref");
  const now = new Date().toISOString();
  const amountLabel = `₹${(input.amount / 100).toFixed(2)}`;

  try {
    await db.batch([
      db
        .prepare(
          `INSERT INTO refunds (id, order_id, payment_id, amount, reason, status, created_by, request_key, created_at, updated_at)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        )
        .bind(
          refundId,
          order.id,
          paidPayment.id,
          input.amount,
          input.reason,
          needsApproval ? "requested" : "processing",
          auth.user.id,
          input.requestKey ?? null,
          now,
          now,
        ),
      auditStatement(db, {
        actor,
        action: needsApproval ? "refund.requested" : "refund.created",
        entityType: "refund",
        entityId: refundId,
        summary: `${needsApproval ? "Requested" : "Issued"} refund of ${amountLabel} for ${order.number}`,
        detail: {
          orderId: order.id,
          amount: input.amount,
          reason: input.reason,
          approvalThresholdPaise: policy.approvalThresholdPaise,
        },
        at: now,
      }),
    ]);
  } catch (error) {
    const message = error instanceof Error ? error.message : "";
    if (/UNIQUE constraint failed/i.test(message)) {
      throw conflict("This refund request was already submitted. Refresh to see its status.");
    }
    throw error;
  }

  if (needsApproval) {
    return json(
      {
        id: refundId,
        status: "requested",
        requiresApproval: true,
        approvalThresholdPaise: policy.approvalThresholdPaise,
      },
      { status: 202 },
    );
  }

  const result = await executeRefund({
    refund: {
      id: refundId,
      amount: input.amount,
      reason: input.reason,
      order,
      payment: paidPayment,
    },
    actor,
    action: "refund.created",
  });

  return json(
    { id: refundId, status: result.status, providerRefundId: result.providerRefundId, requiresApproval: false },
    { status: 201 },
  );
});
