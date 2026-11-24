import { allRows, firstRow, getDb } from "../db";
import { ORDER_STATUS_LABELS, type OrderStatus, releasesInventory } from "../orders";
import { listStatusHistory, type StatusHistoryEntry } from "../history";
import { releaseOrder } from "./checkout";

export interface OrderItemView {
  id: string;
  productId: string;
  productName: string;
  variantName: string;
  sku: string;
  unitPrice: number;
  quantity: number;
  lineTotal: number;
}

export interface OrderAddress {
  fullName: string;
  phone: string;
  line1: string;
  line2: string | null;
  city: string;
  state: string;
  postalCode: string;
  country: string;
}

export interface OrderView {
  id: string;
  number: string;
  status: OrderStatus;
  statusLabel: string;
  paymentStatus: string;
  subtotal: number;
  discount: number;
  shippingFee: number;
  tax: number;
  total: number;
  currency: string;
  couponCode: string | null;
  email: string;
  address: OrderAddress | null;
  notes: string | null;
  trackingNumber: string | null;
  carrier: string | null;
  placedAt: string | null;
  paidAt: string | null;
  shippedAt: string | null;
  deliveredAt: string | null;
  cancelledAt: string | null;
  createdAt: string;
  items: OrderItemView[];
  payment: { provider: string; status: string; providerPaymentId: string | null } | null;
  refunds: { id: string; amount: number; status: string; reason: string; createdAt: string }[];
  statusHistory: StatusHistoryEntry[];
  canCancel: boolean;
  canRetryPayment: boolean;
}

interface OrderRow {
  id: string;
  number: string;
  user_id: string | null;
  email: string;
  status: OrderStatus;
  payment_status: string;
  subtotal: number;
  discount: number;
  shipping_fee: number;
  tax: number;
  total: number;
  currency: string;
  coupon_code: string | null;
  shipping_address_json: string;
  notes: string | null;
  tracking_number: string | null;
  carrier: string | null;
  placed_at: string | null;
  paid_at: string | null;
  shipped_at: string | null;
  delivered_at: string | null;
  cancelled_at: string | null;
  created_at: string;
}

function parseAddress(raw: string): OrderAddress | null {
  try {
    const parsed = JSON.parse(raw) as Partial<OrderAddress>;
    if (!parsed.fullName || !parsed.line1) return null;
    return {
      fullName: parsed.fullName,
      phone: parsed.phone ?? "",
      line1: parsed.line1,
      line2: parsed.line2 ?? null,
      city: parsed.city ?? "",
      state: parsed.state ?? "",
      postalCode: parsed.postalCode ?? "",
      country: parsed.country ?? "IN",
    };
  } catch {
    return null;
  }
}

async function hydrateOrder(row: OrderRow): Promise<OrderView> {
  const [items, payment, refunds, statusHistory] = await Promise.all([
    allRows<{
      id: string;
      product_id: string;
      product_name: string;
      variant_name: string;
      sku: string;
      unit_price: number;
      quantity: number;
      line_total: number;
    }>(
      `SELECT id, product_id, product_name, variant_name, sku, unit_price, quantity, line_total
         FROM order_items WHERE order_id = ? ORDER BY id ASC`,
      [row.id],
    ),
    firstRow<{ provider: string; status: string; provider_payment_id: string | null }>(
      "SELECT provider, status, provider_payment_id FROM payments WHERE order_id = ? ORDER BY created_at DESC LIMIT 1",
      [row.id],
    ),
    allRows<{ id: string; amount: number; status: string; reason: string; created_at: string }>(
      "SELECT id, amount, status, reason, created_at FROM refunds WHERE order_id = ? ORDER BY created_at DESC",
      [row.id],
    ),
    listStatusHistory(row.id),
  ]);

  return {
    id: row.id,
    number: row.number,
    status: row.status,
    statusLabel: ORDER_STATUS_LABELS[row.status] ?? row.status,
    paymentStatus: row.payment_status,
    subtotal: row.subtotal,
    discount: row.discount,
    shippingFee: row.shipping_fee,
    tax: row.tax,
    total: row.total,
    currency: row.currency,
    couponCode: row.coupon_code,
    email: row.email,
    address: parseAddress(row.shipping_address_json),
    notes: row.notes,
    trackingNumber: row.tracking_number,
    carrier: row.carrier,
    placedAt: row.placed_at,
    paidAt: row.paid_at,
    shippedAt: row.shipped_at,
    deliveredAt: row.delivered_at,
    cancelledAt: row.cancelled_at,
    createdAt: row.created_at,
    items: items.map((item) => ({
      id: item.id,
      productId: item.product_id,
      productName: item.product_name,
      variantName: item.variant_name,
      sku: item.sku,
      unitPrice: item.unit_price,
      quantity: item.quantity,
      lineTotal: item.line_total,
    })),
    payment: payment
      ? { provider: payment.provider, status: payment.status, providerPaymentId: payment.provider_payment_id }
      : null,
    refunds: refunds.map((refund) => ({
      id: refund.id,
      amount: refund.amount,
      status: refund.status,
      reason: refund.reason,
      createdAt: refund.created_at,
    })),
    statusHistory,
    canCancel: ["pending_payment", "payment_failed"].includes(row.status),
    canRetryPayment:
      ["pending_payment", "payment_failed"].includes(row.status) && row.payment_status !== "paid",
  };
}

const ORDER_COLUMNS = `id, number, user_id, email, status, payment_status, subtotal, discount, shipping_fee,
  tax, total, currency, coupon_code, shipping_address_json, notes, tracking_number, carrier,
  placed_at, paid_at, shipped_at, delivered_at, cancelled_at, created_at`;

export async function listUserOrders(userId: string): Promise<OrderView[]> {
  const rows = await allRows<OrderRow>(
    `SELECT ${ORDER_COLUMNS} FROM orders WHERE user_id = ? ORDER BY created_at DESC LIMIT 100`,
    [userId],
  );
  return Promise.all(rows.map(hydrateOrder));
}

export async function getOrderForUser(userId: string, number: string): Promise<OrderView | null> {
  const db = await getDb();
  const row = await db
    .prepare(`SELECT ${ORDER_COLUMNS} FROM orders WHERE number = ? AND user_id = ?`)
    .bind(number, userId)
    .first<OrderRow>();
  return row ? hydrateOrder(row) : null;
}

export async function getOrderForAdmin(number: string): Promise<OrderView | null> {
  const db = await getDb();
  const row = await db
    .prepare(`SELECT ${ORDER_COLUMNS} FROM orders WHERE number = ?`)
    .bind(number)
    .first<OrderRow>();
  return row ? hydrateOrder(row) : null;
}

export async function listAllOrders(filter: { status?: string; q?: string; limit?: number }): Promise<OrderView[]> {
  const where: string[] = [];
  const bindings: unknown[] = [];
  if (filter.status) {
    where.push("status = ?");
    bindings.push(filter.status);
  }
  if (filter.q) {
    where.push("(number LIKE ? OR email LIKE ?)");
    bindings.push(`%${filter.q}%`, `%${filter.q}%`);
  }
  const sql = `SELECT ${ORDER_COLUMNS} FROM orders ${where.length ? `WHERE ${where.join(" AND ")}` : ""}
               ORDER BY created_at DESC LIMIT ?`;
  const rows = await allRows<OrderRow>(sql, [...bindings, filter.limit ?? 100]);
  return Promise.all(rows.map(hydrateOrder));
}

/**
 * Cancels a customer's unpaid order and returns its stock. Paid orders must go
 * through the admin refund flow instead, so money and inventory stay consistent.
 */
export async function cancelUnpaidOrder(userId: string, number: string): Promise<OrderView> {
  const db = await getDb();
  const row = await db
    .prepare("SELECT id, status, payment_status, email FROM orders WHERE number = ? AND user_id = ?")
    .bind(number, userId)
    .first<{ id: string; status: OrderStatus; payment_status: string; email: string }>();
  if (!row) throw new Error("not_found");
  if (row.payment_status === "paid") throw new Error("paid_order");
  if (!releasesInventory(row.status) && row.status !== "pending_payment") throw new Error("not_cancellable");
  await releaseOrder(row.id, "cancelled", {
    actor: { type: "customer", id: userId, label: row.email },
    reason: "Cancelled by the customer",
  });
  const updated = await getOrderForUser(userId, number);
  if (!updated) throw new Error("not_found");
  return updated;
}
