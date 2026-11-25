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
import { emailConfigIssue, sendVerificationEmail } from "./email";

export interface SignupChallengeView {
  verificationRequired: true;
  challengeId: string;
  email: string;
  expiresAt: string;
  expiresInSeconds: number;
}

interface ChallengeRow {
  _id: string;
  user_id: string;
  email: string;
  code_hash: string;
  attempts: number;
  expires_at: string;
  consumed_at: string | null;
}

const GENERIC_CODE_ERROR = "That code is not valid. Check the six digits and try again.";

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

  const mailIssue = await emailConfigIssue();
  if (mailIssue) {
    throw new ApiError("email_not_configured", mailIssue, 503);
  }

  const existing = (await db.users.findOne({ email: input.email })) as { _id: string; email_verified_at: string | null } | null;

  if (existing?.email_verified_at) {
    throw new ApiError("conflict", "An account with this email already exists. Sign in instead.", 409);
  }

  const now = new Date();
  const phone = input.phone && input.phone.length > 0 ? input.phone : null;
  const passwordHash = await hashPassword(input.password);
  let userId: string;

  if (existing) {
    userId = existing._id;
    await db.users.updateOne(
      { _id: userId },
      { $set: { password_hash: passwordHash, name: input.name, phone, updated_at: now.toISOString() } },
    );
  } else {
    userId = randomId("usr");
    await db.users.insertOne({
      _id: userId,
      email: input.email,
      password_hash: passwordHash,
      name: input.name,
      phone,
      role: "customer",
      created_at: now.toISOString(),
      updated_at: now.toISOString(),
      email_verified_at: null,
    } as any);
  }

  const challengeId = randomId("sotp");
  const code = generateOtpCode();
  const expiresAt = otpExpiryFrom(now);
  const codeHash = await hashOtpCode(challengeId, code);

  await db.signup_otp_challenges.updateMany(
    { user_id: userId, consumed_at: null },
    { $set: { consumed_at: now.toISOString() } },
  );
  await db.signup_otp_challenges.insertOne({
    _id: challengeId,
    user_id: userId,
    email: input.email,
    code_hash: codeHash,
    attempts: 0,
    ip: input.ip,
    issued_at: now.toISOString(),
    expires_at: expiresAt,
    consumed_at: null,
  } as any);

  try {
    await sendVerificationEmail(input.email, code);
  } catch (error) {
    await db.signup_otp_challenges.deleteOne({ _id: challengeId });
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

  const challenge = (await db.signup_otp_challenges.findOne({ _id: input.challengeId })) as ChallengeRow | null;

  if (!challenge || challenge.consumed_at) {
    throw unauthenticated("This verification code has already been used. Request a new one.");
  }
  if (isOtpExpired(challenge.expires_at)) {
    throw unauthenticated("This verification code has expired. Request a new one.");
  }
  if (challenge.attempts >= OTP_MAX_ATTEMPTS) {
    throw unauthenticated("Too many incorrect attempts on this code. Request a new one.");
  }

  const submitted = await hashOtpCode(challenge._id, input.code);
  if (!matchesOtp(challenge.code_hash, submitted)) {
    await db.signup_otp_challenges.updateOne({ _id: challenge._id }, { $inc: { attempts: 1 } });
    const remaining = OTP_MAX_ATTEMPTS - (challenge.attempts + 1);
    throw unauthenticated(
      remaining > 0
        ? `${GENERIC_CODE_ERROR} ${remaining} attempt${remaining === 1 ? "" : "s"} left.`
        : GENERIC_CODE_ERROR,
    );
  }

  const claimed = await db.signup_otp_challenges.updateOne(
    { _id: challenge._id, consumed_at: null },
    { $set: { consumed_at: new Date().toISOString() } },
  );
  if ((claimed as any).modifiedCount === 0) {
    throw unauthenticated("This verification code has already been used. Request a new one.");
  }

  const now = new Date().toISOString();
  await db.users.updateOne({ _id: challenge.user_id }, { $set: { updated_at: now } });
  await db.users.updateOne({ _id: challenge.user_id, email_verified_at: null }, { $set: { email_verified_at: now } });

  const user = (await db.users.findOne({ _id: challenge.user_id })) as any;
  if (!user) throw unauthenticated("This account is no longer available.");

  await touchCartForUser(user._id);
  const session = await createSession(db, user._id, input.userAgent);

  return {
    user: {
      id: user._id,
      email: user.email,
      name: user.name,
      phone: user.phone,
      role: user.role,
      created_at: user.created_at,
    },
    token: session.token,
    expiresAt: session.expiresAt,
  };
}

export async function pruneSignupChallenges(): Promise<void> {
  const db = await getDb();
  const cutoff = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
  await db.signup_otp_challenges.deleteMany({ expires_at: { $lt: cutoff } } as any);
}
