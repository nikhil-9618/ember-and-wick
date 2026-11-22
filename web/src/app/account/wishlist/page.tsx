import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth";
import { allRows } from "@/lib/db";
import { WishlistList } from "@/components/account/wishlist-list";

export const metadata: Metadata = { title: "Wishlist", robots: { index: false, follow: false } };

export default async function WishlistPage() {
  const user = await getCurrentUser();
  if (!user) redirect("/login?next=/account/wishlist");

  const rows = await allRows<{
    product_id: string;
    slug: string;
    name: string;
    tagline: string | null;
    price: number | null;
    base_price: number;
    image_url: string | null;
    image_alt: string | null;
    in_stock: number | null;
  }>(
    `SELECT w.product_id, p.slug, p.name, p.tagline, p.base_price,
            (SELECT MIN(price) FROM product_variants v WHERE v.product_id = p.id AND v.is_active = 1) AS price,
            (SELECT url FROM product_images pi WHERE pi.product_id = p.id ORDER BY pi.position ASC LIMIT 1) AS image_url,
            (SELECT alt FROM product_images pi WHERE pi.product_id = p.id ORDER BY pi.position ASC LIMIT 1) AS image_alt,
            (SELECT COALESCE(SUM(stock), 0) FROM product_variants v WHERE v.product_id = p.id AND v.is_active = 1) AS in_stock
       FROM wishlist_items w JOIN products p ON p.id = w.product_id
      WHERE w.user_id = ? AND p.status = 'active'
      ORDER BY w.created_at DESC`,
    [user.id],
  );

  return (
    <section aria-labelledby="wishlist-heading">
      <h2 id="wishlist-heading" className="text-xl">
        Saved candles
      </h2>
      <p className="mt-1 mb-6 text-sm text-ink-soft">Keep an eye on the ones you loved and add them when you&apos;re ready.</p>
      <WishlistList
        initial={rows.map((row) => ({
          productId: row.product_id,
          slug: row.slug,
          name: row.name,
          tagline: row.tagline,
          price: row.price ?? row.base_price,
          imageUrl: row.image_url,
          imageAlt: row.image_alt,
          inStock: (row.in_stock ?? 0) > 0,
        }))}
      />
    </section>
  );
}
