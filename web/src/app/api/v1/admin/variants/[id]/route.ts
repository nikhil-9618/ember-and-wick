import { getDb } from "@/lib/db";
import { assertSameOrigin, apiRoute, json, readJson } from "@/lib/http";
import { adminVariantPatchSchema } from "@/lib/validation";
import { notFound } from "@/lib/errors";
import { requireAdmin } from "@/lib/auth";
import { insertInventoryMovement } from "@/lib/services/inventory";
import { insertAuditLog } from "@/lib/services/audit";
import { auditActor } from "@/lib/services/audit";

export const PATCH = apiRoute<{ params: Promise<{ id: string }> }>(async (request, { params }) => {
  assertSameOrigin(request);
  const auth = await requireAdmin(request);
  const { id } = await params;
  const input = await readJson(request, adminVariantPatchSchema);
  const db = await getDb();

  const existing = await db.product_variants.findOne({ _id: id });
  if (!existing) throw notFound("Variant not found.");
  const e = existing as any;

  const sets: Record<string, unknown> = {};
  if (input.price !== undefined) sets.price = input.price;
  if (input.stock !== undefined) sets.stock = input.stock;
  if (input.lowStockThreshold !== undefined) sets.low_stock_threshold = input.lowStockThreshold;
  if (input.isActive !== undefined) sets.is_active = input.isActive ? 1 : 0;
  if (Object.keys(sets).length === 0) return json({ ok: true, unchanged: true });

  sets.updated_at = new Date().toISOString();
  await db.product_variants.updateOne({ _id: id }, { $set: sets });

  const stockDelta = input.stock === undefined ? 0 : input.stock - e.stock;
  if (stockDelta !== 0) {
    await insertInventoryMovement(db, {
      variantId: id,
      delta: stockDelta,
      reason: stockDelta > 0 ? "restock" : "admin_adjustment",
      referenceType: "variant",
      referenceId: id,
      actor: { type: "admin", id: auth.user.id },
      note: input.stock === undefined ? null : `Set to ${input.stock}`,
    });
  }

  await insertAuditLog(db, {
    actor: auditActor(auth),
    action: "variant.updated",
    entityType: "variant",
    entityId: id,
    summary: `${e.sku}: ${Object.entries(input).map(([key, value]) => `${key}=${String(value)}`).join(", ")}`,
    detail: {
      productId: e.product_id,
      before: { price: e.price, stock: e.stock },
      after: input,
      stockDelta,
    },
  });

  const variant = await db.product_variants.findOne({ _id: id });
  return json({ variant });
});