import { getDb } from "@/lib/db";
import { randomId } from "@/lib/crypto";
import { assertSameOrigin, apiRoute, json, readJson } from "@/lib/http";
import { adminProductSchema } from "@/lib/validation";
import { conflict, notFound } from "@/lib/errors";
import { requireAdmin } from "@/lib/auth";
import { auditActor, auditStatement, recordAudit } from "@/lib/services/audit";

const updateSchema = adminProductSchema.omit({ variants: true }).partial();

const COLUMN_MAP: Record<string, string> = {
  name: "name",
  slug: "slug",
  tagline: "tagline",
  description: "description",
  categoryId: "category_id",
  waxType: "wax_type",
  wickType: "wick_type",
  burnTimeHours: "burn_time_hours",
  scentNotes: "scent_notes",
  basePrice: "base_price",
  compareAtPrice: "compare_at_price",
  status: "status",
  isFeatured: "is_featured",
};

export const PATCH = apiRoute<{ params: Promise<{ id: string }> }>(async (request, { params }) => {
  assertSameOrigin(request);
  const auth = await requireAdmin(request);
  const { id } = await params;
  const input = await readJson(request, updateSchema);
  const db = await getDb();

  const existing = await db.prepare("SELECT id FROM products WHERE id = ?").bind(id).first<{ id: string }>();
  if (!existing) throw notFound("Product not found.");

  const sets: string[] = [];
  const bindings: unknown[] = [];
  for (const [key, column] of Object.entries(COLUMN_MAP)) {
    if (!(key in input)) continue;
    const value = (input as Record<string, unknown>)[key];
    if (key === "isFeatured") {
      sets.push(`${column} = ?`);
      bindings.push(value ? 1 : 0);
    } else if (key === "categoryId") {
      sets.push(`${column} = ?`);
      bindings.push(value ?? null);
    } else {
      sets.push(`${column} = ?`);
      bindings.push(value === "" ? null : value);
    }
  }

  const statements = [];
  if (sets.length > 0) {
    sets.push("updated_at = ?");
    bindings.push(new Date().toISOString(), id);
    statements.push(db.prepare(`UPDATE products SET ${sets.join(", ")} WHERE id = ?`).bind(...bindings));
  }

  if (input.images) {
    statements.push(db.prepare("DELETE FROM product_images WHERE product_id = ?").bind(id));
    for (const [index, image] of input.images.entries()) {
      statements.push(
        db
          .prepare("INSERT INTO product_images (id, product_id, url, alt, position) VALUES (?, ?, ?, ?, ?)")
          .bind(randomId("img"), id, image.url, image.alt, index),
      );
    }
  }

  if (statements.length === 0) return json({ ok: true, unchanged: true });

  statements.push(
    auditStatement(db, {
      actor: auditActor(auth),
      action: "product.updated",
      entityType: "product",
      entityId: id,
      summary: `Updated product ${id}`,
      detail: { fields: Object.keys(input) },
    }),
  );

  try {
    await db.batch(statements);
  } catch (error) {
    const message = error instanceof Error ? error.message : "";
    if (/UNIQUE constraint failed/i.test(message)) throw conflict("That slug is already in use.");
    throw error;
  }

  return json({ ok: true });
});

export const DELETE = apiRoute<{ params: Promise<{ id: string }> }>(async (request, { params }) => {
  assertSameOrigin(request);
  const auth = await requireAdmin(request);
  const { id } = await params;
  const db = await getDb();
  const changed = await db
    .prepare("UPDATE products SET status = 'archived', is_featured = 0, updated_at = ? WHERE id = ?")
    .bind(new Date().toISOString(), id)
    .run();
  if ((changed.meta.changes ?? 0) === 0) throw notFound("Product not found.");
  await recordAudit({
    actor: auditActor(auth),
    action: "product.archived",
    entityType: "product",
    entityId: id,
    summary: `Archived product ${id}`,
  });
  return json({ ok: true });
});
