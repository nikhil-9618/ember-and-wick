import { getDb } from "@/lib/db";
import { randomId } from "@/lib/crypto";
import { assertSameOrigin, apiRoute, json, readJson } from "@/lib/http";
import { adminProductSchema } from "@/lib/validation";
import { conflict } from "@/lib/errors";
import { requireAdmin } from "@/lib/auth";
import { auditActor, insertAuditLog } from "@/lib/services/audit";

export const GET = apiRoute(async (request) => {
  await requireAdmin(request);
  const db = await getDb();
  const prods = await db.products.find({}).sort({ created_at: -1 }).toArray();
  const categoryIds = [...new Set((prods as any[]).map((p) => p.category_id).filter(Boolean))];
  const categories = categoryIds.length ? await db.categories.find({ _id: { $in: categoryIds } }).toArray() : [];
  const catMap = new Map((categories as any[]).map((c) => [c._id, c]));
  const variants = (prods as any[]).length ? await db.product_variants.find({ product_id: { $in: (prods as any[]).map((p) => p._id) } }).toArray() : [];
  const vCount = new Map<string, number>();
  const vStock = new Map<string, number>();
  for (const v of variants as any[]) {
    vCount.set(v.product_id, (vCount.get(v.product_id) ?? 0) + 1);
    vStock.set(v.product_id, (vStock.get(v.product_id) ?? 0) + (v.stock ?? 0));
  }
  const products = (prods as any[]).map((p) => ({
    id: p._id,
    slug: p.slug,
    name: p.name,
    status: p.status,
    base_price: p.base_price,
    is_featured: p.is_featured,
    created_at: p.created_at,
    category_name: catMap.get(p.category_id)?.name ?? null,
    variant_count: vCount.get(p._id) ?? 0,
    total_stock: vStock.get(p._id) ?? 0,
    rating_avg: p.rating_avg,
    rating_count: p.rating_count,
  }));
  return json({ products });
});

export const POST = apiRoute(async (request) => {
  assertSameOrigin(request);
  const auth = await requireAdmin(request);
  const input = await readJson(request, adminProductSchema);
  const db = await getDb();

  const productId = randomId("prd");
  const now = new Date().toISOString();
  try {
    await db.products.insertOne({
      _id: productId,
      slug: input.slug,
      name: input.name,
      tagline: input.tagline || null,
      description: input.description,
      category_id: input.categoryId ?? null,
      wax_type: input.waxType || null,
      wick_type: input.wickType || null,
      burn_time_hours: input.burnTimeHours ?? null,
      scent_notes: input.scentNotes || null,
      base_price: input.basePrice,
      compare_at_price: input.compareAtPrice ?? null,
      currency: "INR",
      status: input.status,
      is_featured: input.isFeatured ? 1 : 0,
      rating_avg: 0,
      rating_count: 0,
      created_at: now,
      updated_at: now,
    } as any);

    for (const [index, variant] of input.variants.entries()) {
      await db.product_variants.insertOne({
        _id: variant.id ?? randomId("var"),
        product_id: productId,
        sku: variant.sku,
        name: variant.name,
        price: variant.price,
        weight_grams: variant.weightGrams ?? null,
        stock: variant.stock,
        low_stock_threshold: variant.lowStockThreshold ?? 5,
        is_active: variant.isActive === false ? 0 : 1,
        position: index,
      } as any);
    }
    for (const [index, image] of (input.images ?? []).entries()) {
      await db.product_images.insertOne({
        _id: randomId("img"),
        product_id: productId,
        url: image.url,
        alt: image.alt,
        position: index,
      } as any);
    }
  } catch (error) {
    const message = error instanceof Error ? error.message : "";
    if (/duplicate key|E11000/i.test(message)) throw conflict("That slug or SKU is already in use.");
    throw error;
  }

  await insertAuditLog(db, {
    actor: auditActor(auth),
    action: "product.created",
    entityType: "product",
    entityId: productId,
    summary: `Created product ${input.name} (${input.slug}) as ${input.status}`,
    detail: { variants: input.variants.length, basePrice: input.basePrice },
  });

  return json({ id: productId, slug: input.slug }, { status: 201 });
});