import { getDb } from "../db";
import { ApiError, rateLimited, unauthenticated } from "../errors";
import { fakeVerify, verifyPassword } from "../password";
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
import { otpDeliveryMode, sendOtpEmail } from "./email";

export interface OtpChallengeView {
  otpRequired: true;
  challengeId: string;
  email: string;
  expiresAt: string;
  expiresInSeconds: number;
  delivery: "email" | "demo";
  /** Present only in demo delivery, where the code is shown instead of emailed. */
  demoCode?: string;
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
 * Step one of sign-in: check the password, then issue a single-use code.
 * No session is created here, so a stolen password alone is not enough.
 */
export async function startLogin(input: {
  email: string;
  password: string;
  ip: string;
}): Promise<OtpChallengeView> {
  const db = await getDb();

  const ipLimit = await checkRateLimit(db, `login:ip:${input.ip}`, 30, 15 * 60);
  const accountLimit = await checkRateLimit(db, `login:email:${input.email}`, 10, 15 * 60);
  if (!ipLimit.allowed || !accountLimit.allowed) {
    throw rateLimited("Too many sign-in attempts. Please wait a few minutes and try again.");
  }

  const user = await db
    .prepare("SELECT id, email, password_hash FROM users WHERE email = ?")
    .bind(input.email)
    .first<{ id: string; email: string; password_hash: string }>();

  if (!user) {
    await fakeVerify();
    throw unauthenticated("Email or password is incorrect.");
  }

  const valid = await verifyPassword(input.password, user.password_hash);
  if (!valid) throw unauthenticated("Email or password is incorrect.");

  const delivery = await otpDeliveryMode();
  if (!delivery) {
    throw new ApiError(
      "email_not_configured",
      "Email sign-in codes are not configured yet. Add RESEND_API_KEY or BREVO_API_KEY on the server.",
      503,
    );
  }

  const now = new Date();
  const challengeId = randomId("otp");
  const code = generateOtpCode();
  const expiresAt = otpExpiryFrom(now);
  const codeHash = await hashOtpCode(challengeId, code);

  // Superseded challenges are revoked so only the newest code can be used.
  await db
    .prepare("UPDATE login_otp_challenges SET consumed_at = ? WHERE user_id = ? AND consumed_at IS NULL")
    .bind(now.toISOString(), user.id)
    .run();
  await db
    .prepare(
      `INSERT INTO login_otp_challenges (id, user_id, email, code_hash, attempts, ip, issued_at, expires_at)
       VALUES (?, ?, ?, ?, 0, ?, ?, ?)`,
    )
    .bind(challengeId, user.id, user.email, codeHash, input.ip, now.toISOString(), expiresAt)
    .run();

  if (delivery === "email") {
    await sendOtpEmail(user.email, code);
    return {
      otpRequired: true,
      challengeId,
      email: user.email,
      expiresAt,
      expiresInSeconds: OTP_TTL_SECONDS,
      delivery,
    };
  }

  console.info(`[otp] demo delivery for ${user.email}`);
  return {
    otpRequired: true,
    challengeId,
    email: user.email,
    expiresAt,
    expiresInSeconds: OTP_TTL_SECONDS,
    delivery,
    demoCode: code,
  };
}

/** Step two: verify the code, then (and only then) create the session. */
export async function verifyLoginOtp(input: {
  challengeId: string;
  code: string;
  ip: string;
  userAgent: string | null;
}): Promise<{ user: SessionUser; token: string; expiresAt: string }> {
  const db = await getDb();

  const verifyLimit = await checkRateLimit(db, `otp:verify:${input.ip}`, 30, 15 * 60);
  if (!verifyLimit.allowed) {
    throw rateLimited("Too many code attempts. Please wait a few minutes and try again.");
  }

  const challenge = await db
    .prepare(
      `SELECT id, user_id, email, code_hash, attempts, expires_at, consumed_at
         FROM login_otp_challenges WHERE id = ?`,
    )
    .bind(input.challengeId)
    .first<ChallengeRow>();

  if (!challenge || challenge.consumed_at) {
    throw unauthenticated("This sign-in code has already been used. Request a new one.");
  }
  if (isOtpExpired(challenge.expires_at)) {
    throw unauthenticated("This sign-in code has expired. Request a new one.");
  }
  if (challenge.attempts >= OTP_MAX_ATTEMPTS) {
    throw unauthenticated("Too many incorrect attempts on this code. Request a new one.");
  }

  const submitted = await hashOtpCode(challenge.id, input.code);
  if (!matchesOtp(challenge.code_hash, submitted)) {
    await db
      .prepare("UPDATE login_otp_challenges SET attempts = attempts + 1 WHERE id = ?")
      .bind(challenge.id)
      .run();
    const remaining = OTP_MAX_ATTEMPTS - (challenge.attempts + 1);
    throw unauthenticated(
      remaining > 0 ? `${GENERIC_CODE_ERROR} ${remaining} attempt${remaining === 1 ? "" : "s"} left.` : GENERIC_CODE_ERROR,
    );
  }

  // Claim the challenge atomically: a replayed request can never create a second session.
  const claimed = await db
    .prepare("UPDATE login_otp_challenges SET consumed_at = ? WHERE id = ? AND consumed_at IS NULL")
    .bind(new Date().toISOString(), challenge.id)
    .run();
  if ((claimed.meta.changes ?? 0) === 0) {
    throw unauthenticated("This sign-in code has already been used. Request a new one.");
  }

  const user = await db
    .prepare("SELECT id, email, name, phone, role, created_at FROM users WHERE id = ?")
    .bind(challenge.user_id)
    .first<SessionUser>();
  if (!user) throw unauthenticated("This account is no longer available.");

  await touchCartForUser(user.id);
  const session = await createSession(db, user.id, input.userAgent);

  return { user, token: session.token, expiresAt: session.expiresAt };
}

/** Housekeeping: drop challenges that expired more than a day ago. */
export async function pruneLoginChallenges(): Promise<void> {
  const db = await getDb();
  const cutoff = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
  await db.prepare("DELETE FROM login_otp_challenges WHERE expires_at < ?").bind(cutoff).run();
}
