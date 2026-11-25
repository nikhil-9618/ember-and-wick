import { getDb } from "@/lib/db";
import { assertSameOrigin, apiRoute, json, readJson } from "@/lib/http";
import { adminOrderPatchSchema } from "@/lib/validation";
import { ApiError, notFound } from "@/lib/errors";
import { requireAdmin } from "@/lib/auth";
import { canTransition, ORDER_STATUS_LABELS, type OrderStatus } from "@/lib/orders";
import { getOrderForAdmin } from "@/lib/services/orders";
import { releaseOrder } from "@/lib/services/checkout";
import { notify } from "@/lib/services/notify";
import { insertStatusHistory } from "@/lib/history";
import { auditActor, insertAuditLog } from "@/lib/services/audit";

export const GET = apiRoute<{ params: Promise<{ number: string }> }>(async (request, { params }) => {
  await requireAdmin(request);
  const { number } = await params;
  const order = await getOrderForAdmin(number);
  if (!order) throw notFound("Order not found.");
  return json({ order });
});

export const PATCH = apiRoute<{ params: Promise<{ number: string }> }>(async (request, { params }) => {
  assertSameOrigin(request);
  const auth = await requireAdmin(request);
  const { number } = await params;
  const input = await readJson(request, adminOrderPatchSchema);
  const db = await getDb();

  const row = await db.orders.findOne({ number });
  if (!row) throw notFound("Order not found.");
  const r = row as any;

  const now = new Date().toISOString();
  const actor = { type: "admin" as const, id: auth.user.id, label: auth.user.email };
  const reason = input.note ? input.note : null;

  if (input.trackingNumber !== undefined || input.carrier !== undefined) {
    const set: Record<string, unknown> = { updated_at: now };
    if (input.trackingNumber !== undefined) set.tracking_number = input.trackingNumber ? input.trackingNumber : r.tracking_number;
    if (input.carrier !== undefined) set.carrier = input.carrier ? input.carrier : r.carrier;
    await db.orders.updateOne({ _id: r._id }, { $set: set });
    await insertAuditLog(db, {
      actor: auditActor(auth),
      action: "order.tracking_updated",
      entityType: "order",
      entityId: r._id,
      summary: `${r.number}: tracking ${input.trackingNumber || "unchanged"} / ${input.carrier || "unchanged"}`,
      detail: { trackingNumber: input.trackingNumber ?? null, carrier: input.carrier ?? null },
      at: now,
    });
  }

  let statusChanged: OrderStatus | null = null;
  if (input.status && input.status !== r.status) {
    const next = input.status as OrderStatus;
    if (!canTransition(r.status, next)) {
      throw new ApiError(
        "conflict",
        `An order that is "${ORDER_STATUS_LABELS[r.status as OrderStatus]}" can't move to "${ORDER_STATUS_LABELS[next]}".`,
        409,
      );
    }
    if (next === "cancelled") {
      if (r.payment_status === "paid") {
        throw new ApiError("conflict", "This order is paid. Issue a refund instead of cancelling it.", 409);
      }
      await releaseOrder(r._id, "cancelled", { actor, reason: reason ?? "Cancelled by an admin" });
      statusChanged = next;
    } else {
      const set: Record<string, unknown> = { status: next, updated_at: now };
      if (next === "shipped") set.shipped_at = now;
      if (next === "delivered") set.delivered_at = now;
      await db.orders.updateOne({ _id: r._id }, { $set: set });
      await insertStatusHistory(db, {
        orderId: r._id,
        fromStatus: r.status,
        toStatus: next,
        actor,
        reason,
        at: now,
      });
      await insertAuditLog(db, {
        actor: auditActor(auth),
        action: "order.status_changed",
        entityType: "order",
        entityId: r._id,
        summary: `${r.number}: ${ORDER_STATUS_LABELS[r.status as OrderStatus]} → ${ORDER_STATUS_LABELS[next]}`,
        detail: { from: r.status, to: next, note: reason },
        at: now,
      });
      statusChanged = next;
    }
  }

  if (statusChanged === "cancelled") {
    await insertAuditLog(db, {
      actor: auditActor(auth),
      action: "order.cancelled",
      entityType: "order",
      entityId: r._id,
      summary: `${r.number}: cancelled from ${ORDER_STATUS_LABELS[r.status as OrderStatus]}`,
      detail: { from: r.status, note: reason },
      at: now,
    });
  }

  if (statusChanged) {
    if (r.user_id) {
      await notify(db, {
        userId: r.user_id,
        type: "order_status",
        title: `${r.number} — ${ORDER_STATUS_LABELS[statusChanged as OrderStatus]}`,
        body:
          statusChanged === "shipped"
            ? `Your order is on its way${input.trackingNumber ? ` (tracking ${input.trackingNumber})` : ""}.`
            : `Your order status is now "${ORDER_STATUS_LABELS[statusChanged as OrderStatus]}".`,
        data: { orderNumber: r.number, status: statusChanged },
      });
    }
  }

  const order = await getOrderForAdmin(number);
  if (!order) throw notFound("Order not found.");
  return json({ order });
});