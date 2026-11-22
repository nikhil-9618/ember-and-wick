import type { D1PreparedStatement } from "../types-d1";
import { getDb } from "../db";
import { ApiError, badRequest, conflict, notFound, outOfStock } from "../errors";
import { computeCouponDiscount, computeTotals, type Totals } from "../money";
import { decrementStockStatements, newId, orderNumber } from "../orders";
import { findCoupon, getCart, type CartLine, type CouponRow } from "./cart";
import { getPaymentConfig } from "../config";
import { createRazorpayOrder } from "../payments/razorpay";
/** Explicit structural input so web forms and the mobile client can both call this. */
export interface CheckoutAddressInput {
  label?: string;
  fullName: string;
  phone: string;
  line1: string;
  line2?: string;
  city: string;
  state: string;
  postalCode: string;
  country?: string;
}

export interface CheckoutInput {
  email?: string;
  addressId?: string;
  address?: CheckoutAddressInput;
  couponCode?: string;
  notes?: string;
  idempotencyKey?: string;
}

export interface OrderSummary {
  id: string;
  number: string;
  status: string;
  paymentStatus: string;
  subtotal: number;
  discount: number;
  shippingFee: number;
  tax: number;
  total: number;
  currency: string;
  couponCode: string | null;
  createdAt: string;
}

export interface PaymentIntent {
  provider: "razorpay" | "test";
  keyId: string | null;
  providerOrderId: string;
  amount: number;
  currency: string;
}

export interface CheckoutResult {
  order: OrderSummary;
  payment: PaymentIntent;
}

interface AddressSnapshot {
  fullName: string;
  phone: string;
  line1: string;
  line2: string | null;
  city: string;
  state: string;
  postalCode: string;
  country: string;
}

function snapshotFromInput(input: CheckoutAddressInput): AddressSnapshot {
  return {
    fullName: input.fullName,
    phone: input.phone,
    line1: input.line1,
    line2: input.line2 ? input.line2 : null,
    city: input.city,
    state: input.state,
    postalCode: input.postalCode,
    country: input.country || "IN",
  };
}

export async function resolveAddress(userId: string, input: CheckoutInput): Promise<AddressSnapshot> {
  if (input.address) return snapshotFromInput(input.address);
  const db = await getDb();
  const row = await db
    .prepare(
      `SELECT full_name, phone, line1, line2, city, state, postal_code, country
         FROM addresses WHERE id = ? AND user_id = ?`,
    )
    .bind(input.addressId ?? null, userId)
    .first<{
      full_name: string;
      phone: string;
      line1: string;
      line2: string | null;
      city: string;
      state: string;
      postal_code: string;
      country: string;
    }>();
  if (!row) throw badRequest("Select a saved delivery address or enter a new one.");
  return {
    fullName: row.full_name,
    phone: row.phone,
    line1: row.line1,
    line2: row.line2,
    city: row.city,
    state: row.state,
    postalCode: row.postal_code,
    country: row.country,
  };
}

async function resolveCoupon(code: string, subtotal: number): Promise<{ coupon: CouponRow; discount: number }> {
  const coupon = await findCoupon(code);
  if (!coupon || coupon.is_active !== 1) throw badRequest("That coupon code isn't valid.");
  const now = new Date().toISOString();
  if (coupon.starts_at && now < coupon.starts_at) throw badRequest("That coupon isn't active yet.");
  if (coupon.ends_at && now > coupon.ends_at) throw badRequest("That coupon has expired.");
  if (coupon.usage_limit !== null && coupon.used_count >= coupon.usage_limit) {
    throw badRequest("That coupon has reached its usage limit.");
  }
  if (subtotal < coupon.min_subtotal) throw badRequest("Your cart doesn't meet this coupon's minimum order value.");
  const discount = computeCouponDiscount(coupon, subtotal);
  if (discount <= 0) throw badRequest("That coupon can't be applied to this order.");
  return { coupon, discount };
}

export async function quoteCheckout(
  userId: string,
  couponCode: string | undefined,
): Promise<{ items: CartLine[]; totals: Totals; couponApplied: string | null }> {
  const cart = await getCart(userId);
  if (cart.items.length === 0) throw badRequest("Your cart is empty.");
  let discount = 0;
  let applied: string | null = null;
  if (couponCode) {
    const { coupon, discount: value } = await resolveCoupon(couponCode, cart.subtotal);
    discount = value;
    applied = coupon.code;
  }
  return { items: cart.items, totals: computeTotals(cart.subtotal, discount), couponApplied: applied };
}

function isConstraintError(error: unknown): boolean {
  const message = error instanceof Error ? error.message : String(error);
  return /CHECK constraint failed|constraint failed|UNIQUE constraint failed/i.test(message);
}

/**
 * Creates the order and reserves inventory in one D1 batch (a single
 * transaction). Prices, discounts and totals are recomputed here from the
 * database; nothing the client sent is trusted except variant ids, quantities
 * and the delivery address.
 */
export async function createOrder(
  userId: string,
  email: string,
  input: CheckoutInput,
): Promise<CheckoutResult> {
  const paymentConfig = await getPaymentConfig();
  if (paymentConfig.mode === "unconfigured") {
    throw new ApiError(
      "payment_not_configured",
      "Card and UPI payments are not configured yet. Nothing has been charged.",
      503,
    );
  }

  const cart = await getCart(userId);
  if (cart.items.length === 0) throw badRequest("Your cart is empty.");

  for (const item of cart.items) {
    if (item.quantity > item.stock) {
      throw outOfStock(`${item.productName} (${item.variantName}) only has ${item.stock} left in stock.`);
    }
  }

  const address = await resolveAddress(userId, input);
  let discount = 0;
  let coupon: CouponRow | null = null;
  if (input.couponCode) {
    const resolved = await resolveCoupon(input.couponCode, cart.subtotal);
    coupon = resolved.coupon;
    discount = resolved.discount;
  }
  const totals = computeTotals(cart.subtotal, discount);

  const db = await getDb();
  const now = new Date().toISOString();
  const orderId = newId("ord");
  const number = orderNumber();
  const lines = cart.items.map((item) => ({
    variantId: item.variantId,
    quantity: item.quantity,
  }));

  const orderInsert = db
    .prepare(
      `INSERT INTO orders (id, number, user_id, email, status, payment_status, subtotal, discount,
                           shipping_fee, tax, total, currency, coupon_code, shipping_address_json,
                           notes, placed_at, created_at, updated_at)
       VALUES (?, ?, ?, ?, 'pending_payment', 'unpaid', ?, ?, ?, ?, ?, 'INR', ?, ?, ?, ?, ?, ?)`,
    )
    .bind(
      orderId,
      number,
      userId,
      email,
      totals.subtotal,
      totals.discount,
      totals.shippingFee,
      totals.tax,
      totals.total,
      coupon?.code ?? null,
      JSON.stringify(address),
      input.notes ? input.notes : null,
      now,
      now,
      now,
    );

  const itemStatements: D1PreparedStatement[] = cart.items.map((item) =>
    db
      .prepare(
        `INSERT INTO order_items (id, order_id, variant_id, product_id, product_name, variant_name,
                                  sku, unit_price, quantity, line_total)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      )
      .bind(
        newId("oi"),
        orderId,
        item.variantId,
        item.productId,
        item.productName,
        item.variantName,
        item.sku,
        item.unitPrice,
        item.quantity,
        item.lineTotal,
      ),
  );

  const statements: D1PreparedStatement[] = [
    ...decrementStockStatements((sql) => db.prepare(sql), lines),
    orderInsert,
    ...itemStatements,
    db.prepare("DELETE FROM cart_items WHERE cart_id = ?").bind(cart.cartId),
  ];
  if (coupon) {
    // The CHECK (used_count <= usage_limit) constraint aborts this transaction if
    // the coupon was exhausted between validation and checkout.
    statements.push(db.prepare("UPDATE coupons SET used_count = used_count + 1 WHERE id = ?").bind(coupon.id));
  }

  try {
    await db.batch(statements);
  } catch (error) {
    if (isConstraintError(error)) {
      throw outOfStock("One of the items in your cart just sold out. Please review your cart.");
    }
    throw error;
  }

  const order: OrderSummary = {
    id: orderId,
    number,
    status: "pending_payment",
    paymentStatus: "unpaid",
    subtotal: totals.subtotal,
    discount: totals.discount,
    shippingFee: totals.shippingFee,
    tax: totals.tax,
    total: totals.total,
    currency: "INR",
    couponCode: coupon?.code ?? null,
    createdAt: now,
  };

  // Payment intent is created after the order exists so an orphan provider order
  // can never outlive a rolled-back database transaction.
  if (paymentConfig.mode === "test") {
    const providerOrderId = `test_${orderId}`;
    await db
      .prepare(
        `INSERT INTO payments (id, order_id, provider, provider_order_id, amount, currency, status, created_at, updated_at)
         VALUES (?, ?, 'test', ?, ?, 'INR', 'created', ?, ?)`,
      )
      .bind(newId("pay"), orderId, providerOrderId, totals.total, now, now)
      .run();
    return { order, payment: { provider: "test", keyId: null, providerOrderId, amount: totals.total, currency: "INR" } };
  }

  try {
    const rzp = await createRazorpayOrder({
      amount: totals.total,
      currency: "INR",
      receipt: number,
      notes: { orderId, orderNumber: number },
      keyId: paymentConfig.keyId!,
      keySecret: paymentConfig.keySecret!,
    });
    await db
      .prepare(
        `INSERT INTO payments (id, order_id, provider, provider_order_id, amount, currency, status, created_at, updated_at)
         VALUES (?, ?, 'razorpay', ?, ?, 'INR', 'created', ?, ?)`,
      )
      .bind(newId("pay"), orderId, rzp.id, totals.total, now, now)
      .run();
    return {
      order,
      payment: {
        provider: "razorpay",
        keyId: paymentConfig.keyId,
        providerOrderId: rzp.id,
        amount: totals.total,
        currency: "INR",
      },
    };
  } catch {
    // Payment could not even be started, so the reservation is released fully.
    await releaseOrder(orderId, "cancelled");
    throw new ApiError(
      "payment_error",
      "We couldn't start the payment. Your card has not been charged and your items have been released.",
      502,
    );
  }
}

/**
 * Full release: returns reserved stock to inventory, refunds the coupon usage and
 * marks the order cancelled. Used on explicit cancellation and when payment could
 * not be started at all. A merely *failed* payment keeps its reservation so the
 * customer can retry from the order page without losing the item.
 */
export async function releaseOrder(orderId: string, nextStatus: "cancelled"): Promise<void> {
  const db = await getDb();
  const order = await db
    .prepare("SELECT id, status, coupon_code FROM orders WHERE id = ?")
    .bind(orderId)
    .first<{ id: string; status: string; coupon_code: string | null }>();
  if (!order) throw notFound("Order not found.");
  if (order.status === "cancelled" || order.status === "payment_failed") return;

  const items = await db
    .prepare("SELECT variant_id, quantity FROM order_items WHERE order_id = ?")
    .bind(orderId)
    .all<{ variant_id: string; quantity: number }>();

  const now = new Date().toISOString();
  const statements: D1PreparedStatement[] = [
    ...(items.results ?? []).map((item) =>
      db.prepare("UPDATE product_variants SET stock = stock + ? WHERE id = ?").bind(item.quantity, item.variant_id),
    ),
    db
      .prepare("UPDATE orders SET status = ?, payment_status = ?, cancelled_at = ?, updated_at = ? WHERE id = ?")
      .bind(nextStatus, nextStatus === "cancelled" ? "unpaid" : "failed", now, now, orderId),
    db.prepare("UPDATE payments SET status = 'failed', updated_at = ? WHERE order_id = ? AND status = 'created'").bind(now, orderId),
  ];
  if (order.coupon_code) {
    statements.push(
      db.prepare("UPDATE coupons SET used_count = MAX(0, used_count - 1) WHERE code = ?").bind(order.coupon_code),
    );
  }
  await db.batch(statements).catch(() => {
    throw conflict("We couldn't update this order. Please contact support.");
  });
}
