import type { Metadata } from "next";
import { allRows } from "@/lib/db";
import { CouponManager } from "@/components/admin/coupon-manager";

export const metadata: Metadata = { title: "Coupons", robots: { index: false, follow: false } };

export default async function AdminCouponsPage() {
  const coupons = await allRows<{
    id: string;
    code: string;
    description: string | null;
    type: "percent" | "fixed";
    value: number;
    min_subtotal: number;
    max_discount: number | null;
    usage_limit: number | null;
    used_count: number;
    starts_at: string | null;
    ends_at: string | null;
    is_active: number;
  }>(
    `SELECT id, code, description, type, value, min_subtotal, max_discount, usage_limit, used_count,
            starts_at, ends_at, is_active
       FROM coupons ORDER BY created_at DESC`,
  );

  return (
    <div>
      <h1 className="text-2xl">Coupons</h1>
      <p className="mt-1 text-sm text-ink-soft">
        Discounts are always recalculated on the server. Usage limits are enforced by a database constraint.
      </p>
      <CouponManager
        initial={coupons.map((coupon) => ({
          id: coupon.id,
          code: coupon.code,
          description: coupon.description,
          type: coupon.type,
          value: coupon.value,
          minSubtotal: coupon.min_subtotal,
          maxDiscount: coupon.max_discount,
          usageLimit: coupon.usage_limit,
          usedCount: coupon.used_count,
          startsAt: coupon.starts_at,
          endsAt: coupon.ends_at,
          isActive: coupon.is_active === 1,
        }))}
      />
    </div>
  );
}
