import { getDb } from "@/lib/db";
import { assertSameOrigin, apiRoute, json, readJson } from "@/lib/http";
import { adminOrderPatchSchema } from "@/lib/validation";
import { ApiError, notFound } from "@/lib/errors";
import { requireAdmin } from "@/lib/auth";
import { canTransition, ORDER_STATUS_LABELS, type OrderStatus } from "@/lib/orders";
import { getOrderForAdmin } from "@/lib/services/orders";
import { releaseOrder } from "@/lib/services/checkout";
import { notify } from "@/lib/services/notify";

export const GET = apiRoute<{ params: Promise<{ number: string }> }>(async (request, { params }) => {
  await requireAdmin(request);
  const { number } = await params;
  const order = await getOrderForAdmin(number);
  if (!order) throw notFound("Order not found.");
  return json({ order });
});

export const PATCH = apiRoute<{ params: Promise<{ number: string }> }>(async (request, { params }) => {
  assertSameOrigin(request);
  await requireAdmin(request);
  const { number } = await params;
  const input = await readJson(request, adminOrderPatchSchema);
  const db = await getDb();

  const row = await db
    .prepare("SELECT id, number, status, payment_status, user_id FROM orders WHERE number = ?")
    .bind(number)
    .first<{ id: string; number: string; status: OrderStatus; payment_status: string; user_id: string | null }>();
  if (!row) throw notFound("Order not found.");

  const now = new Date().toISOString();
  const statements = [];

  if (input.trackingNumber !== undefined || input.carrier !== undefined) {
    statements.push(
      db
        .prepare("UPDATE orders SET tracking_number = COALESCE(?, tracking_number), carrier = COALESCE(?, carrier), updated_at = ? WHERE id = ?")
        .bind(input.trackingNumber ? input.trackingNumber : null, input.carrier ? input.carrier : null, now, row.id),
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
      await releaseOrder(row.id, "cancelled");
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
      statusChanged = next;
    }
  }

  if (statements.length > 0) await db.batch(statements);

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
