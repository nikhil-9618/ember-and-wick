import { base64, pbkdf2Hash, timingSafeEqual } from "./crypto";

/**
 * PBKDF2-SHA256 password hashing. Web Crypto is available in Workers, Node and
 * React Native-compatible runtimes, so no native bcrypt build is required.
 *
 * Stored format: pbkdf2$sha256$<iterations>$<salt>$<hash>
 */
const ITERATIONS = 210_000;
const ALGORITHM = "sha256";

export async function hashPassword(password: string): Promise<string> {
  const salt = new Uint8Array(16);
  crypto.getRandomValues(salt);
  const derived = await pbkdf2Hash(password, salt, ITERATIONS);
  return `pbkdf2$${ALGORITHM}$${ITERATIONS}$${base64.encode(salt)}$${base64.encode(derived)}`;
}

export async function verifyPassword(password: string, stored: string): Promise<boolean> {
  const parts = stored.split("$");
  if (parts.length !== 5 || parts[0] !== "pbkdf2" || parts[1] !== ALGORITHM) return false;
  const iterations = Number(parts[2]);
  if (!Number.isInteger(iterations) || iterations < 10_000) return false;
  try {
    const salt = base64.decode(parts[3] as string);
    const expected = parts[4] as string;
    const derived = await pbkdf2Hash(password, salt, iterations);
    return timingSafeEqual(base64.encode(derived), expected);
  } catch {
    return false;
  }
}

/** Burn comparable time on unknown emails so login timing does not leak accounts. */
export async function fakeVerify(): Promise<void> {
  const dummy = new Uint8Array(16);
  await pbkdf2Hash("invalid-password-placeholder", dummy, ITERATIONS);
}
