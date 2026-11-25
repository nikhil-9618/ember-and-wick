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

  const row = await db.users.findOne({ _id: user.id });
  if (!row) throw badRequest("Account not found.");

  const valid = await verifyPassword(input.currentPassword, (row as any).password_hash);
  if (!valid) throw badRequest("Your current password is incorrect.");

  const newHash = await hashPassword(input.newPassword);
  const now = new Date().toISOString();
  await db.users.updateOne({ _id: user.id }, { $set: { password_hash: newHash, updated_at: now } });
  await db.sessions.updateMany(
    { user_id: user.id, _id: { $ne: sessionId }, revoked_at: null },
    { $set: { revoked_at: now } },
  );

  return json({ ok: true });
});