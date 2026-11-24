import { sha256Hex, timingSafeEqual } from "./crypto";

/** A sign-in code is valid for ten minutes and can be mistyped five times. */
export const OTP_TTL_SECONDS = 10 * 60;
export const OTP_MAX_ATTEMPTS = 5;
export const OTP_LENGTH = 6;

/** Cryptographically random 6-digit code, zero-padded so every code is 6 digits. */
export function generateOtpCode(): string {
  const bytes = new Uint32Array(1);
  crypto.getRandomValues(bytes);
  return String(bytes[0]! % 1_000_000).padStart(OTP_LENGTH, "0");
}

/** Codes are stored salted with their challenge id, so the table alone cannot reveal one. */
export function hashOtpCode(challengeId: string, code: string): Promise<string> {
  return sha256Hex(`${challengeId}:${code}`);
}

export function isOtpExpired(expiresAt: string, now: number = Date.now()): boolean {
  const time = new Date(expiresAt).getTime();
  if (!Number.isFinite(time)) return true;
  return time <= now;
}

/** Constant-time comparison of a submitted code against the stored hash. */
export function matchesOtp(hash: string, submittedHash: string): boolean {
  return timingSafeEqual(hash, submittedHash);
}

export function otpExpiryFrom(now: Date = new Date()): string {
  return new Date(now.getTime() + OTP_TTL_SECONDS * 1000).toISOString();
}
