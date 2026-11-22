import { getDb } from "@/lib/db";
import { assertSameOrigin, apiRoute, json, readJson } from "@/lib/http";
import { addressSchema } from "@/lib/validation";
import { notFound } from "@/lib/errors";
import { requireUser } from "@/lib/auth";
import { listAddresses } from "@/lib/services/addresses";

export const PATCH = apiRoute<{ params: Promise<{ id: string }> }>(async (request, { params }) => {
  assertSameOrigin(request);
  const { user } = await requireUser(request);
  const { id } = await params;
  const input = await readJson(request, addressSchema);
  const db = await getDb();

  const existing = await db
    .prepare("SELECT id, is_default FROM addresses WHERE id = ? AND user_id = ?")
    .bind(id, user.id)
    .first<{ id: string; is_default: number }>();
  if (!existing) throw notFound("Address not found.");

  const now = new Date().toISOString();
  await db
    .prepare(
      `UPDATE addresses SET label = ?, full_name = ?, phone = ?, line1 = ?, line2 = ?, city = ?, state = ?,
              postal_code = ?, country = ?, updated_at = ? WHERE id = ? AND user_id = ?`,
    )
    .bind(
      input.label || null,
      input.fullName,
      input.phone,
      input.line1,
      input.line2 || null,
      input.city,
      input.state,
      input.postalCode,
      input.country || "IN",
      now,
      id,
      user.id,
    )
    .run();

  return json({ addresses: await listAddresses(user.id) });
});

export const DELETE = apiRoute<{ params: Promise<{ id: string }> }>(async (request, { params }) => {
  assertSameOrigin(request);
  const { user } = await requireUser(request);
  const { id } = await params;
  const db = await getDb();
  const existing = await db
    .prepare("SELECT id, is_default FROM addresses WHERE id = ? AND user_id = ?")
    .bind(id, user.id)
    .first<{ id: string; is_default: number }>();
  if (!existing) throw notFound("Address not found.");

  await db.prepare("DELETE FROM addresses WHERE id = ? AND user_id = ?").bind(id, user.id).run();

  if (existing.is_default === 1) {
    const next = await db
      .prepare("SELECT id FROM addresses WHERE user_id = ? ORDER BY created_at DESC LIMIT 1")
      .bind(user.id)
      .first<{ id: string }>();
    if (next) {
      await db.prepare("UPDATE addresses SET is_default = 1 WHERE id = ?").bind(next.id).run();
    }
  }

  return json({ addresses: await listAddresses(user.id) });
});
