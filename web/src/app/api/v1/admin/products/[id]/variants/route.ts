import { z } from "zod";
import { getDb } from "@/lib/db";
import { randomId } from "@/lib/crypto";
import { assertSameOrigin, apiRoute, json, readJson } from "@/lib/http";
import { conflict, notFound } from "@/lib/errors";
import { requireAdmin } from "@/lib/auth";

const variantSchema = z.object({
  name: z.string().trim().min(1).max(80),
  sku: z.string().trim().min(3).max(60).regex(/^[A-Za-z0-9-_]+$/),
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

  const product = await db.products.findOne({ _id: id });
  if (!product) throw notFound("Product not found.");

  const position = await db.product_variants.countDocuments({ product_id: id });

  const variantId = randomId("var");
  try {
    await db.product_variants.insertOne({
      _id: variantId,
      product_id: id,
      sku: input.sku,
      name: input.name,
      price: input.price,
      weight_grams: input.weightGrams ?? null,
      stock: input.stock,
      low_stock_threshold: input.lowStockThreshold ?? 5,
      is_active: 1,
      position,
    } as any);
  } catch (error) {
    const message = error instanceof Error ? error.message : "";
    if (/duplicate key|E11000/i.test(message)) throw conflict("That SKU is already in use.");
    throw error;
  }

  return json({ id: variantId }, { status: 201 });
});