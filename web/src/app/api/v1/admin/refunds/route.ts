import { getDb } from "@/lib/db";
import { randomId } from "@/lib/crypto";
import { assertSameOrigin, apiRoute, json, readJson } from "@/lib/http";
import { refundSchema } from "@/lib/validation";
import { badRequest, conflict } from "@/lib/errors";
import { requireAdmin } from "@/lib/auth";
import { getRefundPolicy } from "@/lib/config";
import { refundRequiresApproval } from "@/lib/refunds";
import { auditActor, insertAuditLog } from "@/lib/services/audit";
import {
  executeRefund,
  loadCapturedPayment,
  loadRefundableOrder,
  reservedRefundTotal,
} from "@/lib/services/refunds";

export const GET = apiRoute(async (request) => {
  await requireAdmin(request);
  const db = await getDb();
  const policy = await getRefundPolicy();
  const status = new URL(request.url).searchParams.get("status");
  const query = status && ["requested", "processing", "completed", "failed"].includes(status) ? { status } as any : {};
  const refundRows = await db.refunds.find(query).sort({ created_at: -1 }).limit(100).toArray();
  const orderIds = [...new Set((refundRows as any[]).map((r) => r.order_id))];
  const userIds = [...new Set((refundRows as any[]).flatMap((r) => [r.created_by, r.approved_by].filter(Boolean)))];
  const [orders, users] = await Promise.all([
    orderIds.length ? db.orders.find({ _id: { $in: orderIds } }).toArray() : Promise.resolve([]),
    userIds.length ? db.users.find({ _id: { $in: userIds } }).toArray() : Promise.resolve([]),
  ]);
  const orderMap = new Map((orders as any[]).map((o) => [o._id, o]));
  const userMap = new Map((users as any[]).map((u) => [u._id, u]));
  const refunds = (refundRows as any[]).map((r) => ({
    id: r._id,
    order_id: r.order_id,
    amount: r.amount,
    reason: r.reason,
    status: r.status,
    provider_refund_id: r.provider_refund_id,
    created_at: r.created_at,
    processed_at: r.processed_at,
    created_by: r.created_by,
    approved_by: r.approved_by,
    approved_at: r.approved_at,
    order_number: orderMap.get(r.order_id)?.number ?? "",
    email: orderMap.get(r.order_id)?.email ?? "",
    requested_by_email: r.created_by ? userMap.get(r.created_by)?.email ?? null : null,
    approved_by_email: r.approved_by ? userMap.get(r.approved_by)?.email ?? null : null,
  }));
  return json({ refunds, refundPolicy: policy });
});

export const POST = apiRoute(async (request) => {
  assertSameOrigin(request);
  const auth = await requireAdmin(request);
  const input = await readJson(request, refundSchema);
  const db = await getDb();
  const policy = await getRefundPolicy();
  const actor = auditActor(auth);

  if (input.requestKey) {
    const existing = await db.refunds.findOne({ request_key: input.requestKey });
    if (existing) {
      const e = existing as any;
      return json({
        id: e._id,
        status: e.status,
        providerRefundId: e.provider_refund_id,
        requiresApproval: e.status === "requested",
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
    await db.refunds.insertOne({
      _id: refundId,
      order_id: order.id,
      payment_id: paidPayment.id,
      amount: input.amount,
      reason: input.reason,
      status: needsApproval ? "requested" : "processing",
      created_by: auth.user.id,
      request_key: input.requestKey ?? null,
      created_at: now,
      updated_at: now,
    } as any);
    await insertAuditLog(db, {
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
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "";
    if (/duplicate key|E11000/i.test(message)) {
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