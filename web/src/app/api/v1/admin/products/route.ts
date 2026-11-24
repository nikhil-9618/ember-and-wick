import { allRows, getDb } from "@/lib/db";
import { randomId } from "@/lib/crypto";
import { assertSameOrigin, apiRoute, json, readJson } from "@/lib/http";
import { adminProductSchema } from "@/lib/validation";
import { conflict } from "@/lib/errors";
import { requireAdmin } from "@/lib/auth";
import { auditActor, auditStatement } from "@/lib/services/audit";

export const GET = apiRoute(async (request) => {
  await requireAdmin(request);
  const rows = await allRows<{
    id: string;
    slug: string;
    name: string;
    status: string;
    base_price: number;
    is_featured: number;
    created_at: string;
    category_name: string | null;
    variant_count: number;
    total_stock: number;
    rating_avg: number;
    rating_count: number;
  }>(
    `SELECT p.id, p.slug, p.name, p.status, p.base_price, p.is_featured, p.created_at,
            p.rating_avg, p.rating_count,
            c.name AS category_name,
            (SELECT COUNT(*) FROM product_variants v WHERE v.product_id = p.id) AS variant_count,
            (SELECT COALESCE(SUM(stock), 0) FROM product_variants v WHERE v.product_id = p.id) AS total_stock
       FROM products p LEFT JOIN categories c ON c.id = p.category_id
      ORDER BY p.created_at DESC`,
  );
  return json({ products: rows });
});

export const POST = apiRoute(async (request) => {
  assertSameOrigin(request);
  const auth = await requireAdmin(request);
  const input = await readJson(request, adminProductSchema);
  const db = await getDb();

  const productId = randomId("prd");
  const now = new Date().toISOString();
  const statements = [
    db
      .prepare(
        `INSERT INTO products (id, slug, name, tagline, description, category_id, wax_type, wick_type,
                               burn_time_hours, scent_notes, base_price, compare_at_price, currency,
                               status, is_featured, created_at, updated_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'INR', ?, ?, ?, ?)`,
      )
      .bind(
        productId,
        input.slug,
        input.name,
        input.tagline || null,
        input.description,
        input.categoryId ?? null,
        input.waxType || null,
        input.wickType || null,
        input.burnTimeHours ?? null,
        input.scentNotes || null,
        input.basePrice,
        input.compareAtPrice ?? null,
        input.status,
        input.isFeatured ? 1 : 0,
        now,
        now,
      ),
    ...input.variants.map((variant, index) =>
      db
        .prepare(
          `INSERT INTO product_variants (id, product_id, sku, name, price, weight_grams, stock,
                                         low_stock_threshold, is_active, position)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        )
        .bind(
          variant.id ?? randomId("var"),
          productId,
          variant.sku,
          variant.name,
          variant.price,
          variant.weightGrams ?? null,
          variant.stock,
          variant.lowStockThreshold ?? 5,
          variant.isActive === false ? 0 : 1,
          index,
        ),
    ),
    ...(input.images ?? []).map((image, index) =>
      db
        .prepare("INSERT INTO product_images (id, product_id, url, alt, position) VALUES (?, ?, ?, ?, ?)")
        .bind(randomId("img"), productId, image.url, image.alt, index),
    ),
    auditStatement(db, {
      actor: auditActor(auth),
      action: "product.created",
      entityType: "product",
      entityId: productId,
      summary: `Created product ${input.name} (${input.slug}) as ${input.status}`,
      detail: { variants: input.variants.length, basePrice: input.basePrice },
    }),
  ];

  try {
    await db.batch(statements);
  } catch (error) {
    const message = error instanceof Error ? error.message : "";
    if (/UNIQUE constraint failed/i.test(message)) throw conflict("That slug or SKU is already in use.");
    throw error;
  }

  return json({ id: productId, slug: input.slug }, { status: 201 });
});
