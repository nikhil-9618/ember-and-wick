import { getDb } from "@/lib/db";
import { assertSameOrigin, apiRoute, json, readJson } from "@/lib/http";
import { updateProfileSchema } from "@/lib/validation";
import { requireUser } from "@/lib/auth";

export const GET = apiRoute(async (request) => {
  const { user } = await requireUser(request);
  return json({ user });
});

export const PATCH = apiRoute(async (request) => {
  assertSameOrigin(request);
  const { user } = await requireUser(request);
  const input = await readJson(request, updateProfileSchema);
  const db = await getDb();
  const now = new Date().toISOString();
  const set: Record<string, unknown> = { updated_at: now };
  if (input.name !== undefined) set.name = input.name ?? user.name;
  if (input.phone !== undefined) set.phone = input.phone === "" ? null : input.phone;
  await db.users.updateOne({ _id: user.id }, { $set: set });

  const updated = await db.users.findOne({ _id: user.id });
  const u = updated as any;
  return json({
    user: {
      id: u._id,
      email: u.email,
      name: u.name,
      phone: u.phone,
      role: u.role,
      created_at: u.created_at,
    },
  });
});
