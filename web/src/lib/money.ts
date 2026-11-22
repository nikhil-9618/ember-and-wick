/**
 * Money is handled exclusively as integer paise. No floating point arithmetic
 * is ever used to compute a charge.
 */
export const CURRENCY = "INR";
export const GST_RATE = 0.18; // candles attract 18% GST, already included in listed prices
export const FREE_SHIPPING_THRESHOLD = 149_900; // ₹1,499
export const SHIPPING_FEE = 7_900; // ₹79

export function formatMoney(paise: number, options: { showDecimals?: boolean } = {}): string {
  const rupees = paise / 100;
  const hasPaise = paise % 100 !== 0;
  return new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: CURRENCY,
    minimumFractionDigits: options.showDecimals || hasPaise ? 2 : 0,
    maximumFractionDigits: 2,
  }).format(rupees);
}

export function computeShipping(subtotalAfterDiscount: number): number {
  if (subtotalAfterDiscount <= 0) return 0;
  return subtotalAfterDiscount >= FREE_SHIPPING_THRESHOLD ? 0 : SHIPPING_FEE;
}

/** The GST already contained inside a tax-inclusive amount. */
export function includedTax(grossAmount: number): number {
  return Math.round((grossAmount * GST_RATE) / (1 + GST_RATE));
}

export interface CouponLike {
  type: "percent" | "fixed";
  value: number;
  min_subtotal: number;
  max_discount: number | null;
}

export function computeCouponDiscount(coupon: CouponLike, subtotal: number): number {
  if (subtotal < coupon.min_subtotal) return 0;
  if (coupon.type === "percent") {
    const raw = Math.round((subtotal * coupon.value) / 100);
    return coupon.max_discount !== null ? Math.min(raw, coupon.max_discount) : raw;
  }
  return Math.min(coupon.value, subtotal);
}

export interface Totals {
  subtotal: number;
  discount: number;
  shippingFee: number;
  tax: number;
  total: number;
}

export function computeTotals(subtotal: number, discount: number): Totals {
  const safeDiscount = Math.max(0, Math.min(discount, subtotal));
  const shippingFee = computeShipping(subtotal - safeDiscount);
  const total = subtotal - safeDiscount + shippingFee;
  return {
    subtotal,
    discount: safeDiscount,
    shippingFee,
    tax: includedTax(subtotal - safeDiscount),
    total,
  };
}
