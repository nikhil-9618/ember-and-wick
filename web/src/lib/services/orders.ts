import { getDb } from "../db";
import { ORDER_STATUS_LABELS, type OrderStatus } from "../orders";
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
  _id: string;
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
  const db = await getDb();
  const [items, payments, refunds, statusHistory] = await Promise.all([
    db.order_items.find({ order_id: row._id }).sort({ _id: 1 }).toArray(),
    db.payments.find({ order_id: row._id }).sort({ created_at: -1 }).limit(1).toArray(),
    db.refunds.find({ order_id: row._id }).sort({ created_at: -1 }).toArray(),
    listStatusHistory(row._id),
  ]);

  const payment = (payments as any[])[0] ?? null;
  return {
    id: row._id,
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
    items: (items as any[]).map((item) => ({
      id: item._id,
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
    refunds: (refunds as any[]).map((r) => ({
      id: r._id,
      amount: r.amount,
      status: r.status,
      reason: r.reason,
      createdAt: r.created_at,
    })),
    statusHistory,
    canCancel: ["pending_payment", "payment_failed"].includes(row.status),
    canRetryPayment:
      ["pending_payment", "payment_failed"].includes(row.status) && row.payment_status !== "paid",
  };
}

export async function listUserOrders(userId: string): Promise<OrderView[]> {
  const db = await getDb();
  const rows = await db.orders.find({ user_id: userId }).sort({ created_at: -1 }).limit(100).toArray();
  return Promise.all((rows as any[]).map((r) => hydrateOrder(mapRow(r))));
}

export async function getOrderForUser(userId: string, number: string): Promise<OrderView | null> {
  const db = await getDb();
  const row = await db.orders.findOne({ number, user_id: userId });
  return row ? hydrateOrder(mapRow(row)) : null;
}

export async function getOrderForAdmin(number: string): Promise<OrderView | null> {
  const db = await getDb();
  const row = await db.orders.findOne({ number });
  return row ? hydrateOrder(mapRow(row)) : null;
}

export async function listAllOrders(filter: { status?: string; q?: string; limit?: number }): Promise<OrderView[]> {
  const db = await getDb();
  const query: Record<string, unknown> = {};
  if (filter.status) query.status = filter.status;
  if (filter.q) {
    const rx = new RegExp(filter.q.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"), "i");
    query.$or = [{ number: rx }, { email: rx }];
  }
  const rows = await db.orders.find(query).sort({ created_at: -1 }).limit(filter.limit ?? 100).toArray();
  return Promise.all((rows as any[]).map((r) => hydrateOrder(mapRow(r))));
}

export async function cancelUnpaidOrder(userId: string, number: string): Promise<OrderView> {
  const db = await getDb();
  const row = await db.orders.findOne({ number, user_id: userId });
  if (!row) throw new Error("not_found");
  const r = row as any;
  if (r.payment_status === "paid") throw new Error("paid_order");
  const { releasesInventory } = await import("../orders");
  if (!releasesInventory(r.status) && r.status !== "pending_payment") throw new Error("not_cancellable");
  await releaseOrder(r._id, "cancelled", {
    actor: { type: "customer", id: userId, label: r.email },
    reason: "Cancelled by the customer",
  });
  const updated = await getOrderForUser(userId, number);
  if (!updated) throw new Error("not_found");
  return updated;
}

function mapRow(row: any): OrderRow {
  return {
    _id: row._id,
    number: row.number,
    user_id: row.user_id,
    email: row.email,
    status: row.status,
    payment_status: row.payment_status,
    subtotal: row.subtotal,
    discount: row.discount,
    shipping_fee: row.shipping_fee,
    tax: row.tax,
    total: row.total,
    currency: row.currency,
    coupon_code: row.coupon_code,
    shipping_address_json: row.shipping_address_json,
    notes: row.notes,
    tracking_number: row.tracking_number,
    carrier: row.carrier,
    placed_at: row.placed_at,
    paid_at: row.paid_at,
    shipped_at: row.shipped_at,
    delivered_at: row.delivered_at,
    cancelled_at: row.cancelled_at,
    created_at: row.created_at,
  };
}
