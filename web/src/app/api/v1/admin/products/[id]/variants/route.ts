import { z } from "zod";
import { getDb } from "@/lib/db";
import { randomId } from "@/lib/crypto";
import { assertSameOrigin, apiRoute, json, readJson } from "@/lib/http";
import { conflict, notFound } from "@/lib/errors";
import { requireAdmin } from "@/lib/auth";

const variantSchema = z.object({
  name: z.string().trim().min(1).max(80),
  sku: z
    .string()
    .trim()
    .min(3)
    .max(60)
    .regex(/^[A-Za-z0-9-_]+$/),
  price: z.number().int().min(100).max(100_000_00),
  stock: z.number().int().min(0).max(100_000),
  weightGrams: z.number().int().min(0).max(100_000).optional(),
  lowStockThreshold: z.number().int().min(0).max(10_000).optional(),
});

export const POST = apiRoute<{ params: Promise<{ id: string }> }>(async (request, { params }) => {
  assertSameOrigin(request);
  await requireAdmin(request);
  const { id } = await params;
  const input = await readJson(request, variantSchema);
  const db = await getDb();

  const product = await db.prepare("SELECT id FROM products WHERE id = ?").bind(id).first<{ id: string }>();
  if (!product) throw notFound("Product not found.");

  const position = await db
    .prepare("SELECT COUNT(*) AS total FROM product_variants WHERE product_id = ?")
    .bind(id)
    .first<{ total: number }>();

  const variantId = randomId("var");
  try {
    await db
      .prepare(
        `INSERT INTO product_variants (id, product_id, sku, name, price, weight_grams, stock, low_stock_threshold, is_active, position)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, 1, ?)`,
      )
      .bind(
        variantId,
        id,
        input.sku,
        input.name,
        input.price,
        input.weightGrams ?? null,
        input.stock,
        input.lowStockThreshold ?? 5,
        position?.total ?? 0,
      )
      .run();
  } catch (error) {
    const message = error instanceof Error ? error.message : "";
    if (/UNIQUE constraint failed/i.test(message)) throw conflict("That SKU is already in use.");
    throw error;
  }

  return json({ id: variantId }, { status: 201 });
});
