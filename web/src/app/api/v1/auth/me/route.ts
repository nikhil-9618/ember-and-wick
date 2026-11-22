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

  await db
    .prepare("UPDATE users SET name = COALESCE(?, name), phone = ?, updated_at = ? WHERE id = ?")
    .bind(input.name ?? null, input.phone === undefined ? user.phone : input.phone || null, now, user.id)
    .run();

  const updated = await db
    .prepare("SELECT id, email, name, phone, role, created_at FROM users WHERE id = ?")
    .bind(user.id)
    .first<{ id: string; email: string; name: string; phone: string | null; role: string; created_at: string }>();

  return json({ user: updated });
});
