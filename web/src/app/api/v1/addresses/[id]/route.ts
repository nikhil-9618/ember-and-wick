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

  const existing = await db.addresses.findOne({ _id: id, user_id: user.id });
  if (!existing) throw notFound("Address not found.");

  const now = new Date().toISOString();
  await db.addresses.updateOne(
    { _id: id, user_id: user.id },
    {
      $set: {
        label: input.label || null,
        full_name: input.fullName,
        phone: input.phone,
        line1: input.line1,
        line2: input.line2 || null,
        city: input.city,
        state: input.state,
        postal_code: input.postalCode,
        country: input.country || "IN",
        updated_at: now,
      },
    },
  );

  return json({ addresses: await listAddresses(user.id) });
});

export const DELETE = apiRoute<{ params: Promise<{ id: string }> }>(async (request, { params }) => {
  assertSameOrigin(request);
  const { user } = await requireUser(request);
  const { id } = await params;
  const db = await getDb();
  const existing = await db.addresses.findOne({ _id: id, user_id: user.id });
  if (!existing) throw notFound("Address not found.");

  await db.addresses.deleteOne({ _id: id, user_id: user.id });

  if ((existing as any).is_default === 1) {
    const next = await db.addresses.findOne({ user_id: user.id }, { sort: { created_at: -1 } } as any);
    if (next) {
      await db.addresses.updateOne({ _id: (next as any)._id }, { $set: { is_default: 1 } });
    }
  }

  return json({ addresses: await listAddresses(user.id) });
});