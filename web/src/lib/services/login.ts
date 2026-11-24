import { getDb } from "../db";
import { ApiError, rateLimited, unauthenticated } from "../errors";
import { fakeVerify, verifyPassword } from "../password";
import { checkRateLimit } from "../rate-limit";
import { createSession, touchCartForUser, type SessionUser } from "../auth";

interface LoginRow {
  id: string;
  password_hash: string;
  email_verified_at: string | null;
}

/**
 * Conditional sign-in. Password only: the account's email address was verified
 * once at sign-up, so a second code on every sign-in would add nothing but
 * friction. Unverified accounts cannot sign in and are told why.
 */
export async function loginWithPassword(input: {
  email: string;
  password: string;
  ip: string;
  userAgent: string | null;
}): Promise<{ user: SessionUser; token: string; expiresAt: string }> {
  const db = await getDb();

  const ipLimit = await checkRateLimit(db, `login:ip:${input.ip}`, 30, 15 * 60);
  const accountLimit = await checkRateLimit(db, `login:email:${input.email}`, 10, 15 * 60);
  if (!ipLimit.allowed || !accountLimit.allowed) {
    throw rateLimited("Too many sign-in attempts. Please wait a few minutes and try again.");
  }

  const row = await db
    .prepare("SELECT id, password_hash, email_verified_at FROM users WHERE email = ?")
    .bind(input.email)
    .first<LoginRow>();

  if (!row) {
    await fakeVerify();
    throw unauthenticated("Email or password is incorrect.");
  }

  const valid = await verifyPassword(input.password, row.password_hash);
  if (!valid) throw unauthenticated("Email or password is incorrect.");

  if (!row.email_verified_at) {
    throw new ApiError(
      "email_unverified",
      "Verify your email address first. Sign up again with this email to get a new verification code.",
      403,
    );
  }

  await touchCartForUser(row.id);
  const session = await createSession(db, row.id, input.userAgent);

  const user = await db
    .prepare("SELECT id, email, name, phone, role, created_at FROM users WHERE id = ?")
    .bind(row.id)
    .first<SessionUser>();
  if (!user) throw unauthenticated("This account is no longer available.");

  return { user, token: session.token, expiresAt: session.expiresAt };
}
