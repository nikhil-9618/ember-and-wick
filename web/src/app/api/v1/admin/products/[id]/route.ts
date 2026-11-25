import { getDb } from "@/lib/db";
import { randomId } from "@/lib/crypto";
import { assertSameOrigin, apiRoute, json, readJson } from "@/lib/http";
import { adminProductSchema } from "@/lib/validation";
import { conflict, notFound } from "@/lib/errors";
import { requireAdmin } from "@/lib/auth";
import { auditActor, insertAuditLog } from "@/lib/services/audit";

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

  const existing = await db.products.findOne({ _id: id });
  if (!existing) throw notFound("Product not found.");

  const sets: Record<string, unknown> = {};
  for (const [key, column] of Object.entries(COLUMN_MAP)) {
    if (!(key in input)) continue;
    const value = (input as Record<string, unknown>)[key];
    if (key === "isFeatured") sets[column] = value ? 1 : 0;
    else if (key === "categoryId") sets[column] = value ?? null;
    else sets[column] = value === "" ? null : value;
  }

  if (Object.keys(sets).length > 0) {
    sets.updated_at = new Date().toISOString();
    try {
      await db.products.updateOne({ _id: id }, { $set: sets });
    } catch (error) {
      const message = error instanceof Error ? error.message : "";
      if (/duplicate key|E11000/i.test(message)) throw conflict("That slug is already in use.");
      throw error;
    }
  }

  if (input.images) {
    await db.product_images.deleteMany({ product_id: id });
    for (const [index, image] of input.images.entries()) {
      await db.product_images.insertOne({
        _id: randomId("img"),
        product_id: id,
        url: image.url,
        alt: image.alt,
        position: index,
      } as any);
    }
  }

  await insertAuditLog(db, {
    actor: auditActor(auth),
    action: "product.updated",
    entityType: "product",
    entityId: id,
    summary: `Updated product ${id}`,
    detail: { fields: Object.keys(input) },
  });

  return json({ ok: true });
});

export const DELETE = apiRoute<{ params: Promise<{ id: string }> }>(async (request, { params }) => {
  assertSameOrigin(request);
  const auth = await requireAdmin(request);
  const { id } = await params;
  const db = await getDb();
  const result = await db.products.updateOne(
    { _id: id },
    { $set: { status: "archived", is_featured: 0, updated_at: new Date().toISOString() } },
  );
  if ((result as any).matchedCount === 0) throw notFound("Product not found.");
  await insertAuditLog(db, {
    actor: auditActor(auth),
    action: "product.archived",
    entityType: "product",
    entityId: id,
    summary: `Archived product ${id}`,
  });
  return json({ ok: true });
});