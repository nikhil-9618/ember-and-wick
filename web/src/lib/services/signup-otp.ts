import { getDb } from "../db";
import { ApiError, rateLimited, unauthenticated } from "../errors";
import { hashPassword } from "../password";
import { randomId } from "../crypto";
import { checkRateLimit } from "../rate-limit";
import { createSession, touchCartForUser, type SessionUser } from "../auth";
import {
  generateOtpCode,
  hashOtpCode,
  isOtpExpired,
  matchesOtp,
  otpExpiryFrom,
  OTP_MAX_ATTEMPTS,
  OTP_TTL_SECONDS,
} from "../otp";
import { emailConfigured, sendVerificationEmail } from "./email";

export interface SignupChallengeView {
  verificationRequired: true;
  challengeId: string;
  email: string;
  expiresAt: string;
  expiresInSeconds: number;
}

interface ChallengeRow {
  id: string;
  user_id: string;
  email: string;
  code_hash: string;
  attempts: number;
  expires_at: string;
  consumed_at: string | null;
}

const GENERIC_CODE_ERROR = "That code is not valid. Check the six digits and try again.";

/**
 * Step one of sign-up. The account row is created unverified and no session is
 * issued; a six-digit code is emailed to the address being claimed.
 */
export async function startSignup(input: {
  name: string;
  email: string;
  password: string;
  phone?: string;
  ip: string;
}): Promise<SignupChallengeView> {
  const db = await getDb();

  const ipLimit = await checkRateLimit(db, `register:${input.ip}`, 10, 60 * 60);
  if (!ipLimit.allowed) throw rateLimited("Too many sign-up attempts. Please try again in a little while.");
  const emailLimit = await checkRateLimit(db, `register:email:${input.email}`, 6, 60 * 60);
  if (!emailLimit.allowed) {
    throw rateLimited("Too many verification codes requested for this address. Try again later.");
  }

  // Fail before hashing a password or touching the database if mail is missing.
  if (!(await emailConfigured())) {
    throw new ApiError(
      "email_not_configured",
      "Account verification email is not configured yet. Add RESEND_API_KEY (and OTP_FROM_EMAIL) on the server.",
      503,
    );
  }

  const existing = await db
    .prepare("SELECT id, email_verified_at FROM users WHERE email = ?")
    .bind(input.email)
    .first<{ id: string; email_verified_at: string | null }>();

  if (existing?.email_verified_at) {
    throw new ApiError("conflict", "An account with this email already exists. Sign in instead.", 409);
  }

  const now = new Date();
  const phone = input.phone && input.phone.length > 0 ? input.phone : null;
  const passwordHash = await hashPassword(input.password);
  let userId: string;

  if (existing) {
    // An earlier sign-up never proved ownership of this address: replace the
    // details and issue a fresh code instead of locking the address out.
    userId = existing.id;
    await db
      .prepare("UPDATE users SET password_hash = ?, name = ?, phone = ?, updated_at = ? WHERE id = ?")
      .bind(passwordHash, input.name, phone, now.toISOString(), userId)
      .run();
  } else {
    userId = randomId("usr");
    await db
      .prepare(
        `INSERT INTO users (id, email, password_hash, name, phone, role, created_at, updated_at, email_verified_at)
         VALUES (?, ?, ?, ?, ?, 'customer', ?, ?, NULL)`,
      )
      .bind(userId, input.email, passwordHash, input.name, phone, now.toISOString(), now.toISOString())
      .run();
  }

  const challengeId = randomId("sotp");
  const code = generateOtpCode();
  const expiresAt = otpExpiryFrom(now);
  const codeHash = await hashOtpCode(challengeId, code);

  // Superseded codes are revoked so only the newest one can verify the account.
  await db
    .prepare("UPDATE signup_otp_challenges SET consumed_at = ? WHERE user_id = ? AND consumed_at IS NULL")
    .bind(now.toISOString(), userId)
    .run();
  await db
    .prepare(
      `INSERT INTO signup_otp_challenges (id, user_id, email, code_hash, attempts, ip, issued_at, expires_at)
       VALUES (?, ?, ?, ?, 0, ?, ?, ?)`,
    )
    .bind(challengeId, userId, input.email, codeHash, input.ip, now.toISOString(), expiresAt)
    .run();

  try {
    await sendVerificationEmail(input.email, code);
  } catch (error) {
    // A code nobody received must not sit around as a usable challenge.
    await db.prepare("DELETE FROM signup_otp_challenges WHERE id = ?").bind(challengeId).run();
    throw error;
  }

  return {
    verificationRequired: true,
    challengeId,
    email: input.email,
    expiresAt,
    expiresInSeconds: OTP_TTL_SECONDS,
  };
}

/** Step two: verify the emailed code, mark the account verified, start a session. */
export async function verifySignupOtp(input: {
  challengeId: string;
  code: string;
  ip: string;
  userAgent: string | null;
}): Promise<{ user: SessionUser; token: string; expiresAt: string }> {
  const db = await getDb();

  const verifyLimit = await checkRateLimit(db, `signup:verify:${input.ip}`, 30, 15 * 60);
  if (!verifyLimit.allowed) {
    throw rateLimited("Too many code attempts. Please wait a few minutes and try again.");
  }

  const challenge = await db
    .prepare(
      `SELECT id, user_id, email, code_hash, attempts, expires_at, consumed_at
         FROM signup_otp_challenges WHERE id = ?`,
    )
    .bind(input.challengeId)
    .first<ChallengeRow>();

  if (!challenge || challenge.consumed_at) {
    throw unauthenticated("This verification code has already been used. Request a new one.");
  }
  if (isOtpExpired(challenge.expires_at)) {
    throw unauthenticated("This verification code has expired. Request a new one.");
  }
  if (challenge.attempts >= OTP_MAX_ATTEMPTS) {
    throw unauthenticated("Too many incorrect attempts on this code. Request a new one.");
  }

  const submitted = await hashOtpCode(challenge.id, input.code);
  if (!matchesOtp(challenge.code_hash, submitted)) {
    await db
      .prepare("UPDATE signup_otp_challenges SET attempts = attempts + 1 WHERE id = ?")
      .bind(challenge.id)
      .run();
    const remaining = OTP_MAX_ATTEMPTS - (challenge.attempts + 1);
    throw unauthenticated(
      remaining > 0
        ? `${GENERIC_CODE_ERROR} ${remaining} attempt${remaining === 1 ? "" : "s"} left.`
        : GENERIC_CODE_ERROR,
    );
  }

  // Claim the challenge atomically: a replayed request can never verify twice.
  const claimed = await db
    .prepare("UPDATE signup_otp_challenges SET consumed_at = ? WHERE id = ? AND consumed_at IS NULL")
    .bind(new Date().toISOString(), challenge.id)
    .run();
  if ((claimed.meta.changes ?? 0) === 0) {
    throw unauthenticated("This verification code has already been used. Request a new one.");
  }

  const now = new Date().toISOString();
  await db
    .prepare("UPDATE users SET email_verified_at = COALESCE(email_verified_at, ?), updated_at = ? WHERE id = ?")
    .bind(now, now, challenge.user_id)
    .run();

  const user = await db
    .prepare("SELECT id, email, name, phone, role, created_at FROM users WHERE id = ?")
    .bind(challenge.user_id)
    .first<SessionUser>();
  if (!user) throw unauthenticated("This account is no longer available.");

  await touchCartForUser(user.id);
  const session = await createSession(db, user.id, input.userAgent);

  return { user, token: session.token, expiresAt: session.expiresAt };
}

/** Housekeeping: drop verification codes that expired more than a day ago. */
export async function pruneSignupChallenges(): Promise<void> {
  const db = await getDb();
  const cutoff = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
  await db.prepare("DELETE FROM signup_otp_challenges WHERE expires_at < ?").bind(cutoff).run();
}
