import { describe, expect, it } from "vitest";
import {
  FREE_SHIPPING_THRESHOLD,
  SHIPPING_FEE,
  computeCouponDiscount,
  computeShipping,
  computeTotals,
  formatMoney,
  includedTax,
} from "./money";

describe("formatMoney", () => {
  it("renders whole rupees without decimals", () => {
    expect(formatMoney(89900)).toContain("899");
    expect(formatMoney(89900)).not.toContain(".00");
  });

  it("renders paise when present", () => {
    expect(formatMoney(89950)).toContain("899.50");
  });
});

describe("computeShipping", () => {
  it("is free for an empty order", () => {
    expect(computeShipping(0)).toBe(0);
  });

  it("charges below the threshold", () => {
    expect(computeShipping(FREE_SHIPPING_THRESHOLD - 1)).toBe(SHIPPING_FEE);
  });

  it("is free at exactly the threshold", () => {
    expect(computeShipping(FREE_SHIPPING_THRESHOLD)).toBe(0);
  });
});

describe("includedTax", () => {
  it("extracts the 18% GST already inside the price", () => {
    expect(includedTax(118000)).toBe(18000);
  });

  it("never exceeds the gross amount", () => {
    expect(includedTax(100)).toBeLessThanOrEqual(100);
  });
});

describe("computeCouponDiscount", () => {
  const percent = { type: "percent" as const, value: 10, min_subtotal: 50000, max_discount: 20000 };
  const fixed = { type: "fixed" as const, value: 20000, min_subtotal: 149900, max_discount: null };

  it("respects the minimum subtotal", () => {
    expect(computeCouponDiscount(percent, 40000)).toBe(0);
  });

  it("applies a percentage", () => {
    expect(computeCouponDiscount(percent, 100000)).toBe(10000);
  });

  it("caps a percentage discount", () => {
    expect(computeCouponDiscount(percent, 500000)).toBe(20000);
  });

  it("applies a fixed discount", () => {
    expect(computeCouponDiscount(fixed, 150000)).toBe(20000);
  });

  it("never discounts more than the subtotal", () => {
    expect(computeCouponDiscount({ ...fixed, min_subtotal: 0 }, 5000)).toBe(5000);
  });
});

describe("computeTotals", () => {
  it("adds shipping after discount and keeps tax inside the total", () => {
    const totals = computeTotals(50000, 10000);
    expect(totals.total).toBe(40000 + SHIPPING_FEE);
    expect(totals.tax).toBe(includedTax(40000));
  });

  it("clamps a discount larger than the subtotal", () => {
    const totals = computeTotals(50000, 999999);
    expect(totals.discount).toBe(50000);
    expect(totals.total).toBe(0);
  });
});
