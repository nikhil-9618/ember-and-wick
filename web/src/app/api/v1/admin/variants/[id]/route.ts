import { getDb } from "@/lib/db";
import { assertSameOrigin, apiRoute, json, readJson } from "@/lib/http";
import { adminVariantPatchSchema } from "@/lib/validation";
import { notFound } from "@/lib/errors";
import { requireAdmin } from "@/lib/auth";
import { inventoryMovementStatement } from "@/lib/services/inventory";
import { auditActor, auditStatement } from "@/lib/services/audit";

export const PATCH = apiRoute<{ params: Promise<{ id: string }> }>(async (request, { params }) => {
  assertSameOrigin(request);
  const auth = await requireAdmin(request);
  const { id } = await params;
  const input = await readJson(request, adminVariantPatchSchema);
  const db = await getDb();

  const existing = await db
    .prepare("SELECT id, product_id, sku, price, stock FROM product_variants WHERE id = ?")
    .bind(id)
    .first<{ id: string; product_id: string; sku: string; price: number; stock: number }>();
  if (!existing) throw notFound("Variant not found.");

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
  const statements = [db.prepare(`UPDATE product_variants SET ${sets.join(", ")} WHERE id = ?`).bind(...bindings)];

  const stockDelta = input.stock === undefined ? 0 : input.stock - existing.stock;
  if (stockDelta !== 0) {
    statements.push(
      inventoryMovementStatement(db, {
        variantId: id,
        delta: stockDelta,
        reason: stockDelta > 0 ? "restock" : "admin_adjustment",
        referenceType: "variant",
        referenceId: id,
        actor: { type: "admin", id: auth.user.id },
        note: input.stock === undefined ? null : `Set to ${input.stock}`,
      }),
    );
  }

  statements.push(
    auditStatement(db, {
      actor: auditActor(auth),
      action: "variant.updated",
      entityType: "variant",
      entityId: id,
      summary: `${existing.sku}: ${Object.entries(input)
        .map(([key, value]) => `${key}=${String(value)}`)
        .join(", ")}`,
      detail: {
        productId: existing.product_id,
        before: { price: existing.price, stock: existing.stock },
        after: input,
        stockDelta,
      },
    }),
  );

  const results = await db.batch(statements);
  if ((results[0]?.meta.changes ?? 0) === 0) throw notFound("Variant not found.");

  const variant = await db
    .prepare("SELECT id, product_id, sku, name, price, stock, low_stock_threshold, is_active FROM product_variants WHERE id = ?")
    .bind(id)
    .first();
  return json({ variant });
});
