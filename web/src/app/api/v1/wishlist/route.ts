import { z } from "zod";
import { allRows, getDb } from "@/lib/db";
import { randomId } from "@/lib/crypto";
import { assertSameOrigin, apiRoute, json, readJson } from "@/lib/http";
import { notFound } from "@/lib/errors";
import { requireUser } from "@/lib/auth";

async function listWishlist(userId: string) {
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
    created_at: string;
  }>(
    `SELECT w.product_id, p.slug, p.name, p.tagline, p.base_price,
            (SELECT MIN(price) FROM product_variants v WHERE v.product_id = p.id AND v.is_active = 1) AS price,
            (SELECT url FROM product_images pi WHERE pi.product_id = p.id ORDER BY pi.position ASC LIMIT 1) AS image_url,
            (SELECT alt FROM product_images pi WHERE pi.product_id = p.id ORDER BY pi.position ASC LIMIT 1) AS image_alt,
            (SELECT COALESCE(SUM(stock), 0) FROM product_variants v WHERE v.product_id = p.id AND v.is_active = 1) AS in_stock,
            w.created_at
       FROM wishlist_items w JOIN products p ON p.id = w.product_id
      WHERE w.user_id = ? AND p.status = 'active'
      ORDER BY w.created_at DESC`,
    [userId],
  );
  return rows.map((row) => ({
    productId: row.product_id,
    slug: row.slug,
    name: row.name,
    tagline: row.tagline,
    price: row.price ?? row.base_price,
    basePrice: row.base_price,
    imageUrl: row.image_url,
    imageAlt: row.image_alt,
    inStock: (row.in_stock ?? 0) > 0,
    addedAt: row.created_at,
  }));
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

  const product = await db
    .prepare("SELECT id FROM products WHERE id = ? AND status = 'active'")
    .bind(input.productId)
    .first<{ id: string }>();
  if (!product) throw notFound("That candle is no longer available.");

  await db
    .prepare("INSERT OR IGNORE INTO wishlist_items (id, user_id, product_id, created_at) VALUES (?, ?, ?, ?)")
    .bind(randomId("wl"), user.id, product.id, new Date().toISOString())
    .run();

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
  await db
    .prepare("DELETE FROM wishlist_items WHERE user_id = ? AND product_id = ?")
    .bind(user.id, productId)
    .run();
  return json({ items: await listWishlist(user.id) });
});
