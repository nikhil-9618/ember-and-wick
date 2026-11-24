import { describe, expect, it } from "vitest";
import { generateOtpCode, hashOtpCode, isOtpExpired, matchesOtp, otpExpiryFrom, OTP_LENGTH, OTP_TTL_SECONDS } from "./otp";

describe("one-time sign-in codes", () => {
  it("always produces a six digit code", () => {
    for (let i = 0; i < 200; i += 1) {
      const code = generateOtpCode();
      expect(code).toHaveLength(OTP_LENGTH);
      expect(code).toMatch(/^\d{6}$/);
    }
  });

  it("hashes a code deterministically but differently per challenge", async () => {
    const first = await hashOtpCode("otp_a", "123456");
    const repeat = await hashOtpCode("otp_a", "123456");
    const other = await hashOtpCode("otp_b", "123456");
    expect(first).toBe(repeat);
    expect(first).not.toBe(other);
    expect(first).not.toContain("123456");
  });

  it("compares codes in constant time", async () => {
    const hash = await hashOtpCode("otp_c", "654321");
    expect(matchesOtp(hash, await hashOtpCode("otp_c", "654321"))).toBe(true);
    expect(matchesOtp(hash, await hashOtpCode("otp_c", "000000"))).toBe(false);
    expect(matchesOtp(hash, "short")).toBe(false);
  });

  it("expires ten minutes after issue", () => {
    const issued = new Date("2026-01-01T10:00:00.000Z");
    const expiresAt = otpExpiryFrom(issued);
    expect(expiresAt).toBe("2026-01-01T10:10:00.000Z");
    expect(isOtpExpired(expiresAt, issued.getTime() + (OTP_TTL_SECONDS - 1) * 1000)).toBe(false);
    expect(isOtpExpired(expiresAt, issued.getTime() + OTP_TTL_SECONDS * 1000)).toBe(true);
    expect(isOtpExpired("not-a-date")).toBe(true);
  });
});
