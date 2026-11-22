import { z } from "zod";
import { firstRow, getDb } from "@/lib/db";
import { randomId } from "@/lib/crypto";
import { assertSameOrigin, apiRoute, json, readJson } from "@/lib/http";
import { addressSchema } from "@/lib/validation";
import { requireUser } from "@/lib/auth";
import { listAddresses } from "@/lib/services/addresses";

export const GET = apiRoute(async (request) => {
  const { user } = await requireUser(request);
  return json({ addresses: await listAddresses(user.id) });
});

export const POST = apiRoute(async (request) => {
  assertSameOrigin(request);
  const { user } = await requireUser(request);
  const input = await readJson(request, addressSchema);
  const db = await getDb();

  const count = await firstRow<{ total: number }>("SELECT COUNT(*) AS total FROM addresses WHERE user_id = ?", [user.id]);
  const makeDefault = input.isDefault === true || (count?.total ?? 0) === 0;
  const now = new Date().toISOString();
  const id = randomId("adr");

  if (makeDefault) {
    await db.prepare("UPDATE addresses SET is_default = 0 WHERE user_id = ?").bind(user.id).run();
  }

  await db
    .prepare(
      `INSERT INTO addresses (id, user_id, label, full_name, phone, line1, line2, city, state, postal_code, country, is_default, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    )
    .bind(
      id,
      user.id,
      input.label || null,
      input.fullName,
      input.phone,
      input.line1,
      input.line2 || null,
      input.city,
      input.state,
      input.postalCode,
      input.country || "IN",
      makeDefault ? 1 : 0,
      now,
      now,
    )
    .run();

  return json({ addresses: await listAddresses(user.id) }, { status: 201 });
});

export const PATCH = apiRoute(async (request) => {
  assertSameOrigin(request);
  const { user } = await requireUser(request);
  const input = await readJson(request, z.object({ addressId: z.string().min(3).max(80) }));
  const db = await getDb();
  const existing = await db
    .prepare("SELECT id FROM addresses WHERE id = ? AND user_id = ?")
    .bind(input.addressId, user.id)
    .first<{ id: string }>();
  if (!existing) {
    return json({ error: { code: "not_found", message: "Address not found." } }, { status: 404 });
  }
  await db.batch([
    db.prepare("UPDATE addresses SET is_default = 0 WHERE user_id = ?").bind(user.id),
    db.prepare("UPDATE addresses SET is_default = 1, updated_at = ? WHERE id = ?").bind(new Date().toISOString(), input.addressId),
  ]);
  return json({ addresses: await listAddresses(user.id) });
});
