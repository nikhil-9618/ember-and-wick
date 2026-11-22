import { getDb } from "@/lib/db";
import { assertSameOrigin, apiRoute, json, readJson } from "@/lib/http";
import { adminVariantPatchSchema } from "@/lib/validation";
import { notFound } from "@/lib/errors";
import { requireAdmin } from "@/lib/auth";

export const PATCH = apiRoute<{ params: Promise<{ id: string }> }>(async (request, { params }) => {
  assertSameOrigin(request);
  await requireAdmin(request);
  const { id } = await params;
  const input = await readJson(request, adminVariantPatchSchema);
  const db = await getDb();

  const sets: string[] = [];
  const bindings: unknown[] = [];
  if (input.price !== undefined) {
    sets.push("price = ?");
    bindings.push(input.price);
  }
  if (input.stock !== undefined) {
    sets.push("stock = ?");
    bindings.push(input.stock);
  }
  if (input.lowStockThreshold !== undefined) {
    sets.push("low_stock_threshold = ?");
    bindings.push(input.lowStockThreshold);
  }
  if (input.isActive !== undefined) {
    sets.push("is_active = ?");
    bindings.push(input.isActive ? 1 : 0);
  }
  if (sets.length === 0) return json({ ok: true, unchanged: true });

  bindings.push(id);
  const result = await db.prepare(`UPDATE product_variants SET ${sets.join(", ")} WHERE id = ?`).bind(...bindings).run();
  if ((result.meta.changes ?? 0) === 0) throw notFound("Variant not found.");

  const variant = await db
    .prepare("SELECT id, product_id, sku, name, price, stock, low_stock_threshold, is_active FROM product_variants WHERE id = ?")
    .bind(id)
    .first();
  return json({ variant });
});
