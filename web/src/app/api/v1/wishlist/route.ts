import { z } from "zod";
import { getDb } from "@/lib/db";
import { randomId } from "@/lib/crypto";
import { assertSameOrigin, apiRoute, json, readJson } from "@/lib/http";
import { notFound } from "@/lib/errors";
import { requireUser } from "@/lib/auth";

async function listWishlist(userId: string) {
  const db = await getDb();
  const wishlist = await db.wishlist_items.find({ user_id: userId }).sort({ created_at: -1 }).toArray();
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

  return (wishlist as any[])
    .map((w) => {
      const p = productMap.get(w.product_id);
      if (!p) return null;
      const img = imageMap.get(p._id);
      return {
        productId: p._id,
        slug: p.slug,
        name: p.name,
        tagline: p.tagline,
        price: priceMap.get(p._id) ?? p.base_price,
        basePrice: p.base_price,
        imageUrl: img?.url ?? null,
        imageAlt: img?.alt ?? null,
        inStock: (stockMap.get(p._id) ?? 0) > 0,
        addedAt: w.created_at,
      };
    })
    .filter(Boolean) as any[];
}

export const GET = apiRoute(async (request) => {
  const { user } = await requireUser(request);
  return json({ items: await listWishlist(user.id) });
});

export const POST = apiRoute(async (request) => {
  assertSameOrigin(request);
  const { user } = await requireUser(request);
  const input = await readJson(request, z.object({ productId: z.string().min(3).max(80) }));
  const db = await getDb();

  const product = await db.products.findOne({ _id: input.productId, status: "active" });
  if (!product) throw notFound("That candle is no longer available.");

  try {
    await db.wishlist_items.insertOne({
      _id: randomId("wl"),
      user_id: user.id,
      product_id: product._id,
      created_at: new Date().toISOString(),
    } as any);
  } catch {
    // duplicate ignored
  }

  return json({ items: await listWishlist(user.id) }, { status: 201 });
});

export const DELETE = apiRoute(async (request) => {
  assertSameOrigin(request);
  const { user } = await requireUser(request);
  const productId = new URL(request.url).searchParams.get("productId")?.trim();
  if (!productId) {
    return json({ error: { code: "validation_error", message: "productId is required." } }, { status: 422 });
  }
  const db = await getDb();
  await db.wishlist_items.deleteOne({ user_id: user.id, product_id: productId });
  return json({ items: await listWishlist(user.id) });
});