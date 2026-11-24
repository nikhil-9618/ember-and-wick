import { describe, expect, it } from "vitest";
import { hashPassword, verifyPassword } from "./password";

describe("password hashing", () => {
  it("produces a versioned PBKDF2 string", async () => {
    const hash = await hashPassword("CorrectHorse123");
    expect(hash.startsWith("pbkdf2$sha256$")).toBe(true);
    expect(hash.split("$")).toHaveLength(5);
  });

  it("stays within the Workers PBKDF2 ceiling", async () => {
    const hash = await hashPassword("CorrectHorse123");
    const iterations = Number(hash.split("$")[2]);
    expect(iterations).toBe(100_000);
  });

  it("never stores the plaintext", async () => {
    const hash = await hashPassword("CorrectHorse123");
    expect(hash).not.toContain("CorrectHorse123");
  });

  it("verifies the correct password", async () => {
    const hash = await hashPassword("CorrectHorse123");
    await expect(verifyPassword("CorrectHorse123", hash)).resolves.toBe(true);
  });

  it("rejects a wrong password", async () => {
    const hash = await hashPassword("CorrectHorse123");
    await expect(verifyPassword("CorrectHorse124", hash)).resolves.toBe(false);
  });

  it("salts identical passwords differently", async () => {
    const first = await hashPassword("CorrectHorse123");
    const second = await hashPassword("CorrectHorse123");
    expect(first).not.toBe(second);
  });

  it("rejects malformed stored hashes instead of throwing", async () => {
    await expect(verifyPassword("anything", "not-a-hash")).resolves.toBe(false);
    await expect(verifyPassword("anything", "pbkdf2$sha256$100$abc$def")).resolves.toBe(false);
  });
});
