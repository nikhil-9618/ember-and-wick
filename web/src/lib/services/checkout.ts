import { withTransaction } from "../db";
import { ApiError, badRequest, conflict, notFound, outOfStock } from "../errors";
import { computeCouponDiscount, computeTotals, type Totals } from "../money";
import { newId, orderNumber } from "../orders";
import { SYSTEM_ACTOR, type StatusActor } from "../history";
import { insertInventoryMovement } from "./inventory";
import { insertStatusHistory } from "../history";
import { getCartWith, findCouponWith, type CartLine, type CouponRow } from "./cart";
import { getPaymentConfig } from "../config";
import { createRazorpayOrder } from "../payments/razorpay";
import { insertNotification } from "./notify";

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
  const store = await (await import("../db")).getDb();
  const row = await store.addresses.findOne({ _id: input.addressId ?? null, user_id: userId } as any);
  if (!row) throw badRequest("Select a saved delivery address or enter a new one.");
  return {
    fullName: (row as any).full_name,
    phone: (row as any).phone,
    line1: (row as any).line1,
    line2: (row as any).line2,
    city: (row as any).city,
    state: (row as any).state,
    postalCode: (row as any).postal_code,
    country: (row as any).country,
  };
}

async function resolveCoupon(store: any, code: string, subtotal: number): Promise<{ coupon: CouponRow; discount: number }> {
  const coupon = await findCouponWith(store, code);
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
  const store = await (await import("../db")).getDb();
  const cart = await getCartWith(store, userId);
  if (cart.items.length === 0) throw badRequest("Your cart is empty.");
  let discount = 0;
  let applied: string | null = null;
  if (couponCode) {
    const { coupon, discount: value } = await resolveCoupon(store, couponCode, cart.subtotal);
    discount = value;
    applied = coupon.code;
  }
  return { items: cart.items, totals: computeTotals(cart.subtotal, discount), couponApplied: applied };
}

function isConstraintError(error: unknown): boolean {
  const message = error instanceof Error ? error.message : String(error);
  return /constraint failed|duplicate key|E11000/i.test(message);
}

export async function createOrder(
  userId: string,
  email: string,
  input: CheckoutInput,
): Promise<CheckoutResult> {
  const paymentConfig = await getPaymentConfig();
  if (paymentConfig.mode === "unconfigured") {
    throw new ApiError("payment_not_configured", "Card and UPI payments are not configured yet. Nothing has been charged.", 503);
  }

  const store = await (await import("../db")).getDb();
  const cart = await getCartWith(store, userId);
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
    const resolved = await resolveCoupon(store, input.couponCode, cart.subtotal);
    coupon = resolved.coupon;
    discount = resolved.discount;
  }
  const totals = computeTotals(cart.subtotal, discount);

  const now = new Date().toISOString();
  const orderId = newId("ord");
  const number = orderNumber();
  const lines = cart.items.map((item) => ({ variantId: item.variantId, quantity: item.quantity }));

  let created = false;
  try {
    await withTransaction(async (tx) => {
      // decrement stock with guard
      for (const line of lines) {
        const res = await tx.product_variants.updateOne(
          { _id: line.variantId, is_active: 1, stock: { $gte: line.quantity } },
          { $inc: { stock: -line.quantity } },
        );
        if ((res as any).modifiedCount !== 1) {
          throw outOfStock("One of the items in your cart just sold out. Please review your cart.");
        }
        await insertInventoryMovement(tx, {
          variantId: line.variantId,
          delta: -line.quantity,
          reason: "order_reserved",
          referenceType: "order",
          referenceId: orderId,
          actor: { type: "customer", id: userId },
          at: now,
        });
      }

      await tx.orders.insertOne({
        _id: orderId,
        number,
        user_id: userId,
        email,
        status: "pending_payment",
        payment_status: "unpaid",
        subtotal: totals.subtotal,
        discount: totals.discount,
        shipping_fee: totals.shippingFee,
        tax: totals.tax,
        total: totals.total,
        currency: "INR",
        coupon_code: coupon?.code ?? null,
        shipping_address_json: JSON.stringify(address),
        notes: input.notes ? input.notes : null,
        placed_at: now,
        created_at: now,
        updated_at: now,
      } as any);

      const itemDocs = cart.items.map((item) => ({
        _id: newId("oi"),
        order_id: orderId,
        variant_id: item.variantId,
        product_id: item.productId,
        product_name: item.productName,
        variant_name: item.variantName,
        sku: item.sku,
        unit_price: item.unitPrice,
        quantity: item.quantity,
        line_total: item.lineTotal,
      }));
      if (itemDocs.length) await tx.order_items.insertMany(itemDocs as any);

      await tx.cart_items.deleteMany({ cart_id: cart.cartId });

      await insertStatusHistory(tx, {
        orderId,
        fromStatus: null,
        toStatus: "pending_payment",
        actor: { type: "customer", id: userId, label: email },
        reason: "Order placed",
        at: now,
      });

      if (coupon) {
        const res = await tx.coupons.updateOne(
          { _id: coupon.id, $expr: { $or: [{ $eq: ["$usage_limit", null] }, { $lt: ["$used_count", "$usage_limit"] }] } },
          { $inc: { used_count: 1 } },
        );
        if ((res as any).modifiedCount !== 1) throw outOfStock("That coupon just reached its usage limit.");
      }
    });
    created = true;
  } catch (error) {
    if (isConstraintError(error)) {
      throw outOfStock("One of the items in your cart just sold out. Please review your cart.");
    }
    throw error;
  }

  if (!created) throw new Error("order not created");

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

  // Payment intent after order exists.
  if (paymentConfig.mode === "test") {
    const provider = "test";
    const providerOrderId = `${provider}_${orderId}`;
    const db = await (await import("../db")).getDb();
    await db.payments.insertOne({
      _id: newId("pay"),
      order_id: orderId,
      provider,
      provider_order_id: providerOrderId,
      provider_payment_id: null,
      amount: totals.total,
      currency: "INR",
      status: "created",
      method: null,
      error_code: null,
      error_description: null,
      created_at: now,
      updated_at: now,
    } as any);
    return { order, payment: { provider, keyId: null, providerOrderId, amount: totals.total, currency: "INR" } };
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
    const db = await (await import("../db")).getDb();
    await db.payments.insertOne({
      _id: newId("pay"),
      order_id: orderId,
      provider: "razorpay",
      provider_order_id: rzp.id,
      provider_payment_id: null,
      amount: totals.total,
      currency: "INR",
      status: "created",
      method: null,
      error_code: null,
      error_description: null,
      created_at: now,
      updated_at: now,
    } as any);
    return {
      order,
      payment: { provider: "razorpay", keyId: paymentConfig.keyId, providerOrderId: rzp.id, amount: totals.total, currency: "INR" },
    };
  } catch {
    await releaseOrder(orderId, "cancelled", {
      actor: { type: "system", label: "Payment gateway" },
      reason: "Payment could not be started",
    });
    throw new ApiError("payment_error", "We couldn't start the payment. Your card has not been charged and your items have been released.", 502);
  }
}

export async function releaseOrder(
  orderId: string,
  nextStatus: "cancelled",
  options: { actor?: StatusActor; reason?: string | null } = {},
): Promise<void> {
  await withTransaction(async (tx) => {
    const order = await tx.orders.findOne({ _id: orderId });
    if (!order) throw notFound("Order not found.");
    if (order.status === "cancelled") return;

    const items = await tx.order_items.find({ order_id: orderId }).toArray();
    const now = new Date().toISOString();
    const actor = options.actor ?? SYSTEM_ACTOR;

    for (const item of items as any[]) {
      await tx.product_variants.updateOne({ _id: item.variant_id }, { $inc: { stock: item.quantity } });
      await insertInventoryMovement(tx, {
        variantId: item.variant_id,
        delta: item.quantity,
        reason: "order_released",
        referenceType: "order",
        referenceId: orderId,
        actor: { type: actor.type === "webhook" ? "system" : actor.type, id: actor.id ?? null },
        at: now,
      });
    }

    await tx.orders.updateOne(
      { _id: orderId },
      { $set: { status: "cancelled", payment_status: "unpaid", cancelled_at: now, updated_at: now } },
    );
    await tx.payments.updateMany(
      { order_id: orderId, status: "created" },
      { $set: { status: "failed", updated_at: now } },
    );

    await insertStatusHistory(tx, {
      orderId,
      fromStatus: order.status,
      toStatus: nextStatus,
      actor,
      reason: options.reason ?? "Order cancelled",
      at: now,
    });

    if (order.coupon_code) {
      await tx.coupons.updateOne(
        { code: order.coupon_code },
        { $inc: { used_count: -1 } },
      );
      // clamp at 0
      const c = await tx.coupons.findOne({ code: order.coupon_code });
      if (c && (c as any).used_count < 0) {
        await tx.coupons.updateOne({ code: order.coupon_code }, { $set: { used_count: 0 } });
      }
    }
  });
}
