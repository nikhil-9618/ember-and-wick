import type { Metadata } from "next";
import { getDb } from "@/lib/db";
import { CouponManager } from "@/components/admin/coupon-manager";

export const metadata: Metadata = { title: "Coupons", robots: { index: false, follow: false } };

export default async function AdminCouponsPage() {
  const db = await getDb();
  const rows = await db.coupons.find({}).sort({ created_at: -1 }).toArray();
  const coupons = (rows as any[]).map((c) => ({
    id: c._id,
    code: c.code,
    description: c.description,
    type: c.type,
    value: c.value,
    min_subtotal: c.min_subtotal,
    max_discount: c.max_discount,
    usage_limit: c.usage_limit,
    used_count: c.used_count,
    starts_at: c.starts_at,
    ends_at: c.ends_at,
    is_active: c.is_active,
  }));

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
