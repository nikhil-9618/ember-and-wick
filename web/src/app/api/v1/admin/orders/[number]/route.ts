import { getDb } from "@/lib/db";
import { assertSameOrigin, apiRoute, json, readJson } from "@/lib/http";
import { adminOrderPatchSchema } from "@/lib/validation";
import { ApiError, notFound } from "@/lib/errors";
import { requireAdmin } from "@/lib/auth";
import { canTransition, ORDER_STATUS_LABELS, type OrderStatus } from "@/lib/orders";
import { getOrderForAdmin } from "@/lib/services/orders";
import { releaseOrder } from "@/lib/services/checkout";
import { notify } from "@/lib/services/notify";
import { statusHistoryStatement } from "@/lib/history";
import { auditActor, auditStatement, recordAudit } from "@/lib/services/audit";

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

  const row = await db
    .prepare("SELECT id, number, status, payment_status, user_id FROM orders WHERE number = ?")
    .bind(number)
    .first<{ id: string; number: string; status: OrderStatus; payment_status: string; user_id: string | null }>();
  if (!row) throw notFound("Order not found.");

  const now = new Date().toISOString();
  const actor = { type: "admin" as const, id: auth.user.id, label: auth.user.email };
  const reason = input.note ? input.note : null;
  const statements = [];

  if (input.trackingNumber !== undefined || input.carrier !== undefined) {
    statements.push(
      db
        .prepare(
          "UPDATE orders SET tracking_number = COALESCE(?, tracking_number), carrier = COALESCE(?, carrier), updated_at = ? WHERE id = ?",
        )
        .bind(input.trackingNumber ? input.trackingNumber : null, input.carrier ? input.carrier : null, now, row.id),
    );
    statements.push(
      auditStatement(db, {
        actor: auditActor(auth),
        action: "order.tracking_updated",
        entityType: "order",
        entityId: row.id,
        summary: `${row.number}: tracking ${input.trackingNumber || "unchanged"} / ${input.carrier || "unchanged"}`,
        detail: { trackingNumber: input.trackingNumber ?? null, carrier: input.carrier ?? null },
        at: now,
      }),
    );
  }

  let statusChanged: OrderStatus | null = null;
  if (input.status && input.status !== row.status) {
    const next = input.status as OrderStatus;
    if (!canTransition(row.status, next)) {
      throw new ApiError(
        "conflict",
        `An order that is "${ORDER_STATUS_LABELS[row.status]}" can't move to "${ORDER_STATUS_LABELS[next]}".`,
        409,
      );
    }
    if (next === "cancelled") {
      if (row.payment_status === "paid") {
        throw new ApiError("conflict", "This order is paid. Issue a refund instead of cancelling it.", 409);
      }
      // releaseOrder writes its own history and inventory rows in one batch.
      await releaseOrder(row.id, "cancelled", { actor, reason: reason ?? "Cancelled by an admin" });
      statusChanged = next;
    } else {
      statements.push(
        db
          .prepare(
            `UPDATE orders SET status = ?,
                shipped_at = CASE WHEN ? = 'shipped' THEN ? ELSE shipped_at END,
                delivered_at = CASE WHEN ? = 'delivered' THEN ? ELSE delivered_at END,
                updated_at = ?
              WHERE id = ?`,
          )
          .bind(next, next, now, next, now, now, row.id),
      );
      statements.push(
        statusHistoryStatement(db, {
          orderId: row.id,
          fromStatus: row.status,
          toStatus: next,
          actor,
          reason,
          at: now,
        }),
      );
      statements.push(
        auditStatement(db, {
          actor: auditActor(auth),
          action: "order.status_changed",
          entityType: "order",
          entityId: row.id,
          summary: `${row.number}: ${ORDER_STATUS_LABELS[row.status]} → ${ORDER_STATUS_LABELS[next]}`,
          detail: { from: row.status, to: next, note: reason },
          at: now,
        }),
      );
      statusChanged = next;
    }
  }

  if (statements.length > 0) await db.batch(statements);

  if (statusChanged === "cancelled") {
    await recordAudit({
      actor: auditActor(auth),
      action: "order.cancelled",
      entityType: "order",
      entityId: row.id,
      summary: `${row.number}: cancelled from ${ORDER_STATUS_LABELS[row.status]}`,
      detail: { from: row.status, note: reason },
      at: now,
    });
  }

  if (statusChanged) {
    if (row.user_id) {
      await notify(db, {
        userId: row.user_id,
        type: "order_status",
        title: `${row.number} — ${ORDER_STATUS_LABELS[statusChanged]}`,
        body:
          statusChanged === "shipped"
            ? `Your order is on its way${input.trackingNumber ? ` (tracking ${input.trackingNumber})` : ""}.`
            : `Your order status is now "${ORDER_STATUS_LABELS[statusChanged]}".`,
        data: { orderNumber: row.number, status: statusChanged },
      });
    }
  }

  const order = await getOrderForAdmin(number);
  if (!order) throw notFound("Order not found.");
  return json({ order });
});
