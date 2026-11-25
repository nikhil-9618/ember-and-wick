import { getDb, withTransaction } from "../db";
import { ApiError, rateLimited, unauthenticated } from "../errors";
import { hashPassword } from "../password";
import { randomId } from "../crypto";
import { checkRateLimit } from "../rate-limit";
import { emailConfigIssue, sendPasswordResetEmail } from "./email";
import {
  generateOtpCode,
  hashOtpCode,
  isOtpExpired,
  matchesOtp,
  otpExpiryFrom,
  OTP_MAX_ATTEMPTS,
  OTP_TTL_SECONDS,
} from "../otp";

export interface PasswordResetChallengeView {
  challengeId: string;
  email: string;
  expiresAt: string;
  expiresInSeconds: number;
}

const GENERIC_CODE_ERROR =
  "That code is not valid or has expired. Request a new code and try again.";

export async function startPasswordReset(input: {
  email: string;
  ip: string;
}): Promise<PasswordResetChallengeView> {
  const db = await getDb();

  const ipLimit = await checkRateLimit(db, `password-reset:ip:${input.ip}`, 10, 60 * 60);
  const emailLimit = await checkRateLimit(db, `password-reset:email:${input.email}`, 5, 60 * 60);
  if (!ipLimit.allowed || !emailLimit.allowed) {
    throw rateLimited("Too many password reset requests. Please wait a little while and try again.");
  }

  const mailIssue = await emailConfigIssue();
  if (mailIssue) {
    throw new ApiError("email_not_configured", mailIssue, 503);
  }

  const user = await db.users.findOne({ email: input.email });
  const now = new Date();
  const challengeId = randomId("prst");
  const code = generateOtpCode();
  const expiresAt = otpExpiryFrom(now);
  const codeHash = await hashOtpCode(challengeId, code);
  const nowIso = now.toISOString();

  // A new request invalidates every earlier outstanding code for this address.
  await db.password_reset_challenges.updateMany(
    { email: input.email, consumed_at: null },
    { $set: { consumed_at: nowIso } },
  );
  await db.password_reset_challenges.insertOne({
    _id: challengeId,
    user_id: user?._id ?? null,
    email: input.email,
    code_hash: codeHash,
    attempts: 0,
    ip: input.ip,
    issued_at: nowIso,
    expires_at: expiresAt,
    consumed_at: null,
  });

  if (user) {
    try {
      await sendPasswordResetEmail(input.email, code);
    } catch (error) {
      await db.password_reset_challenges.deleteOne({ _id: challengeId });
      throw error;
    }
  }

  // The response is identical whether or not the address belongs to an account.
  // Only a real mailbox receives a code, so this cannot be used to enumerate users.
  return {
    challengeId,
    email: input.email,
    expiresAt,
    expiresInSeconds: OTP_TTL_SECONDS,
  };
}

export async function resetPassword(input: {
  challengeId: string;
  code: string;
  newPassword: string;
  ip: string;
}): Promise<void> {
  const db = await getDb();

  const verifyLimit = await checkRateLimit(db, `password-reset:verify:${input.ip}`, 30, 15 * 60);
  if (!verifyLimit.allowed) {
    throw rateLimited("Too many code attempts. Please wait a few minutes and try again.");
  }

  const challenge = await db.password_reset_challenges.findOne({ _id: input.challengeId });
  if (!challenge || challenge.consumed_at) {
    throw unauthenticated(GENERIC_CODE_ERROR);
  }
  if (isOtpExpired(challenge.expires_at)) {
    throw unauthenticated(GENERIC_CODE_ERROR);
  }
  if (challenge.attempts >= OTP_MAX_ATTEMPTS) {
    throw unauthenticated(GENERIC_CODE_ERROR);
  }

  const submitted = await hashOtpCode(challenge._id, input.code);
  if (!matchesOtp(challenge.code_hash, submitted)) {
    await db.password_reset_challenges.updateOne(
      { _id: challenge._id },
      { $inc: { attempts: 1 } },
    );
    const remaining = OTP_MAX_ATTEMPTS - (challenge.attempts + 1);
    throw unauthenticated(
      remaining > 0
        ? `${GENERIC_CODE_ERROR} ${remaining} attempt${remaining === 1 ? "" : "s"} left.`
        : GENERIC_CODE_ERROR,
    );
  }

  const now = new Date().toISOString();
  const claimed = await db.password_reset_challenges.updateOne(
    { _id: challenge._id, consumed_at: null },
    { $set: { consumed_at: now } },
  );
  if (claimed.modifiedCount === 0) {
    throw unauthenticated(GENERIC_CODE_ERROR);
  }

  if (!challenge.user_id) {
    throw unauthenticated(GENERIC_CODE_ERROR);
  }

  const user = await db.users.findOne({ _id: challenge.user_id });
  if (!user || user.email !== challenge.email) {
    throw unauthenticated(GENERIC_CODE_ERROR);
  }

  const newHash = await hashPassword(input.newPassword);
  await withTransaction(async (tx) => {
    await tx.users.updateOne(
      { _id: user._id },
      {
        $set: {
          password_hash: newHash,
          updated_at: now,
          ...(user.email_verified_at ? {} : { email_verified_at: now }),
        },
      },
    );
    // A reset signs every other device out. The code proved control of the inbox.
    await tx.sessions.updateMany(
      { user_id: user._id, revoked_at: null },
      { $set: { revoked_at: now } },
    );
    await tx.password_reset_challenges.updateMany(
      { email: challenge.email, consumed_at: null },
      { $set: { consumed_at: now } },
    );
  });
}
