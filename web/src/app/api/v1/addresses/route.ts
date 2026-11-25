import { z } from "zod";
import { getDb } from "@/lib/db";
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

  const count = await db.addresses.countDocuments({ user_id: user.id });
  const makeDefault = input.isDefault === true || count === 0;
  const now = new Date().toISOString();
  const id = randomId("adr");

  if (makeDefault) {
    await db.addresses.updateMany({ user_id: user.id }, { $set: { is_default: 0 } });
  }

  await db.addresses.insertOne({
    _id: id,
    user_id: user.id,
    label: input.label || null,
    full_name: input.fullName,
    phone: input.phone,
    line1: input.line1,
    line2: input.line2 || null,
    city: input.city,
    state: input.state,
    postal_code: input.postalCode,
    country: input.country || "IN",
    is_default: makeDefault ? 1 : 0,
    created_at: now,
    updated_at: now,
  } as any);

  return json({ addresses: await listAddresses(user.id) }, { status: 201 });
});

export const PATCH = apiRoute(async (request) => {
  assertSameOrigin(request);
  const { user } = await requireUser(request);
  const input = await readJson(request, z.object({ addressId: z.string().min(3).max(80) }));
  const db = await getDb();
  const existing = await db.addresses.findOne({ _id: input.addressId, user_id: user.id });
  if (!existing) {
    return json({ error: { code: "not_found", message: "Address not found." } }, { status: 404 });
  }
  await db.addresses.updateMany({ user_id: user.id }, { $set: { is_default: 0 } });
  await db.addresses.updateOne({ _id: input.addressId }, { $set: { is_default: 1, updated_at: new Date().toISOString() } });
  return json({ addresses: await listAddresses(user.id) });
});