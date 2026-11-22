import { getDb } from "@/lib/db";
import { hashPassword, verifyPassword } from "@/lib/password";
import { assertSameOrigin, apiRoute, json, readJson } from "@/lib/http";
import { changePasswordSchema } from "@/lib/validation";
import { badRequest } from "@/lib/errors";
import { requireUser } from "@/lib/auth";

export const POST = apiRoute(async (request) => {
  assertSameOrigin(request);
  const { user, sessionId } = await requireUser(request);
  const input = await readJson(request, changePasswordSchema);
  const db = await getDb();

  const row = await db
    .prepare("SELECT password_hash FROM users WHERE id = ?")
    .bind(user.id)
    .first<{ password_hash: string }>();
  if (!row) throw badRequest("Account not found.");

  const valid = await verifyPassword(input.currentPassword, row.password_hash);
  if (!valid) throw badRequest("Your current password is incorrect.");

  const newHash = await hashPassword(input.newPassword);
  const now = new Date().toISOString();
  await db.batch([
    db.prepare("UPDATE users SET password_hash = ?, updated_at = ? WHERE id = ?").bind(newHash, now, user.id),
    // Sign out every other device, keep the current session alive.
    db
      .prepare("UPDATE sessions SET revoked_at = ? WHERE user_id = ? AND id != ? AND revoked_at IS NULL")
      .bind(now, user.id, sessionId),
  ]);

  return json({ ok: true });
});
