import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth";
import { getDb } from "@/lib/db";
import { WishlistList } from "@/components/account/wishlist-list";

export const metadata: Metadata = { title: "Wishlist", robots: { index: false, follow: false } };

export default async function WishlistPage() {
  const user = await getCurrentUser();
  if (!user) redirect("/login?next=/account/wishlist");

  const db = await getDb();
  const wishlist = await db.wishlist_items.find({ user_id: user.id }).sort({ created_at: -1 }).toArray();
  const productIds = (wishlist as any[]).map((w) => w.product_id);
  const products = productIds.length ? await db.products.find({ _id: { $in: productIds }, status: "active" }).toArray() : [];
  const productMap = new Map((products as any[]).map((p) => [p._id, p]));
  const variants = productIds.length ? await db.product_variants.find({ product_id: { $in: productIds }, is_active: 1 }).toArray() : [];
  const images = productIds.length ? await db.product_images.find({ product_id: { $in: productIds } }).sort({ position: 1 }).toArray() : [];
  const imageMap = new Map<string, any>();
  for (const img of images as any[]) if (!imageMap.has(img.product_id)) imageMap.set(img.product_id, img);
  const stockMap = new Map<string, number>();
  const priceMap = new Map<string, number>();
  for (const v of variants as any[]) {
    stockMap.set(v.product_id, (stockMap.get(v.product_id) ?? 0) + v.stock);
    if (!priceMap.has(v.product_id) || v.price < priceMap.get(v.product_id)!) priceMap.set(v.product_id, v.price);
  }

  const rows = (wishlist as any[])
    .map((w) => {
      const p = productMap.get(w.product_id);
      if (!p) return null;
      const img = imageMap.get(p._id);
      return {
        product_id: p._id,
        slug: p.slug,
        name: p.name,
        tagline: p.tagline,
        price: priceMap.get(p._id) ?? null,
        base_price: p.base_price,
        image_url: img?.url ?? null,
        image_alt: img?.alt ?? null,
        in_stock: stockMap.get(p._id) ?? 0,
      };
    })
    .filter(Boolean) as any[];

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
