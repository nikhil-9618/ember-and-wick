import type { D1PreparedStatement } from "./types-d1";
import { randomId, randomToken } from "./crypto";

export type OrderStatus =
  | "pending_payment"
  | "paid"
  | "processing"
  | "packed"
  | "shipped"
  | "delivered"
  | "cancelled"
  | "payment_failed"
  | "refunded";

export type PaymentStatus = "unpaid" | "paid" | "failed" | "refunded" | "partially_refunded";

/** Allowed order state transitions. Anything not listed here is rejected. */
const TRANSITIONS: Record<OrderStatus, OrderStatus[]> = {
  pending_payment: ["paid", "payment_failed", "cancelled"],
  payment_failed: ["pending_payment", "cancelled"],
  paid: ["processing", "shipped", "cancelled", "refunded"],
  processing: ["packed", "shipped", "cancelled", "refunded"],
  packed: ["shipped", "cancelled", "refunded"],
  shipped: ["delivered", "refunded"],
  delivered: ["refunded"],
  cancelled: [],
  refunded: [],
};

export function canTransition(from: OrderStatus, to: OrderStatus): boolean {
  return TRANSITIONS[from].includes(to);
}

export function nextStatuses(from: OrderStatus): OrderStatus[] {
  return [...TRANSITIONS[from]];
}

/** Statuses that should return reserved stock to inventory. */
export function releasesInventory(status: OrderStatus): boolean {
  return status === "cancelled" || status === "payment_failed";
}

export const ORDER_STATUS_LABELS: Record<OrderStatus, string> = {
  pending_payment: "Awaiting payment",
  paid: "Payment confirmed",
  processing: "Packing your order",
  packed: "Packed",
  shipped: "Shipped",
  delivered: "Delivered",
  cancelled: "Cancelled",
  payment_failed: "Payment failed",
  refunded: "Refunded",
};

export const ORDER_TIMELINE: OrderStatus[] = ["paid", "processing", "packed", "shipped", "delivered"];

export function orderNumber(): string {
  const now = new Date();
  const stamp = `${String(now.getUTCFullYear()).slice(2)}${String(now.getUTCMonth() + 1).padStart(2, "0")}${String(
    now.getUTCDate(),
  ).padStart(2, "0")}`;
  const suffix = randomToken(4).replace(/[^A-Za-z0-9]/g, "").slice(0, 5).toUpperCase();
  return `EW-${stamp}-${suffix}`;
}

export interface StockReservation {
  variantId: string;
  quantity: number;
}

/**
 * Statements that reduce inventory. `stock` has a CHECK (stock >= 0) constraint,
 * so an over-sell aborts the entire D1 batch transaction instead of going
 * negative. That is what makes order creation atomic.
 */
export function decrementStockStatements(
  prepare: (sql: string) => D1PreparedStatement,
  lines: StockReservation[],
): D1PreparedStatement[] {
  return lines.map((line) =>
    prepare("UPDATE product_variants SET stock = stock - ? WHERE id = ? AND is_active = 1").bind(
      line.quantity,
      line.variantId,
    ),
  );
}

export function restoreStockStatements(
  prepare: (sql: string) => D1PreparedStatement,
  lines: StockReservation[],
): D1PreparedStatement[] {
  return lines.map((line) =>
    prepare("UPDATE product_variants SET stock = stock + ? WHERE id = ?").bind(line.quantity, line.variantId),
  );
}

export function newId(prefix: string): string {
  return randomId(prefix);
}
