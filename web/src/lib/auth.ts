import { cookies } from "next/headers";
import type { D1Database } from "./types-d1";
import { randomId, randomToken, sha256Hex } from "./crypto";
import { forbidden, unauthenticated } from "./errors";
import { firstRow, getDb } from "./db";

export const SESSION_COOKIE = "ew_session";
const SESSION_TTL_DAYS = 30;
const SESSION_TTL_MS = SESSION_TTL_DAYS * 24 * 60 * 60 * 1000;

export type Role = "customer" | "admin";

export interface SessionUser {
  id: string;
  email: string;
  name: string;
  phone: string | null;
  role: Role;
  created_at: string;
}

export interface AuthContext {
  user: SessionUser;
  sessionId: string;
  via: "cookie" | "bearer";
}

interface SessionRow extends SessionUser {
  session_id: string;
  expires_at: string;
  revoked_at: string | null;
}

export async function createSession(
  db: D1Database,
  userId: string,
  userAgent: string | null,
): Promise<{ token: string; expiresAt: string; sessionId: string }> {
  const token = randomToken(32);
  const sessionId = await sha256Hex(token);
  const now = new Date();
  const expiresAt = new Date(now.getTime() + SESSION_TTL_MS).toISOString();

  await db
    .prepare("DELETE FROM sessions WHERE user_id = ? AND (expires_at < ? OR revoked_at IS NOT NULL)")
    .bind(userId, now.toISOString())
    .run();
  await db
    .prepare("INSERT INTO sessions (id, user_id, created_at, expires_at, user_agent) VALUES (?, ?, ?, ?, ?)")
    .bind(sessionId, userId, now.toISOString(), expiresAt, userAgent)
    .run();

  return { token, expiresAt, sessionId };
}

export async function revokeSession(sessionId: string): Promise<void> {
  const db = await getDb();
  await db.prepare("UPDATE sessions SET revoked_at = ? WHERE id = ?").bind(new Date().toISOString(), sessionId).run();
}

export async function userForToken(token: string): Promise<SessionUser | null> {
  if (!token || token.length < 20) return null;
  const db = await getDb();
  const sessionId = await sha256Hex(token);
  const row = await db
    .prepare(
      `SELECT s.id AS session_id, s.expires_at, s.revoked_at,
              u.id, u.email, u.name, u.phone, u.role, u.created_at
         FROM sessions s
         JOIN users u ON u.id = s.user_id
        WHERE s.id = ?`,
    )
    .bind(sessionId)
    .first<SessionRow>();

  if (!row) return null;
  if (row.revoked_at) return null;
  if (new Date(row.expires_at).getTime() < Date.now()) return null;

  return {
    id: row.id,
    email: row.email,
    name: row.name,
    phone: row.phone,
    role: row.role,
    created_at: row.created_at,
  };
}

function bearerToken(request: Request): string | null {
  const header = request.headers.get("authorization");
  if (!header) return null;
  const [scheme, value] = header.split(" ");
  if (!scheme || scheme.toLowerCase() !== "bearer" || !value) return null;
  return value.trim();
}

export function cookieToken(request: Request): string | null {
  const header = request.headers.get("cookie");
  if (!header) return null;
  for (const part of header.split(";")) {
    const [name, ...rest] = part.trim().split("=");
    if (name === SESSION_COOKIE) return decodeURIComponent(rest.join("="));
  }
  return null;
}

/**
 * Resolves auth from either an Authorization bearer token (mobile app) or the
 * HttpOnly session cookie (website). Both resolve to the same sessions table,
 * so a session revoked on one platform stops working on the other.
 */
export async function resolveAuth(request: Request): Promise<AuthContext | null> {
  const bearer = bearerToken(request);
  if (bearer) {
    const user = await userForToken(bearer);
    if (!user) return null;
    return { user, sessionId: await sha256Hex(bearer), via: "bearer" };
  }
  const token = cookieToken(request);
  if (!token) return null;
  const user = await userForToken(token);
  if (!user) return null;
  return { user, sessionId: await sha256Hex(token), via: "cookie" };
}

export async function requireUser(request: Request): Promise<AuthContext> {
  const auth = await resolveAuth(request);
  if (!auth) throw unauthenticated();
  return auth;
}

export async function requireAdmin(request: Request): Promise<AuthContext> {
  const auth = await requireUser(request);
  if (auth.user.role !== "admin") throw forbidden("Admin access required.");
  return auth;
}

/** Server-component helper: current user from the session cookie, if any. */
export async function getCurrentUser(): Promise<SessionUser | null> {
  const jar = await cookies();
  const token = jar.get(SESSION_COOKIE)?.value;
  if (!token) return null;
  try {
    return await userForToken(token);
  } catch {
    return null;
  }
}

export function sessionCookie(token: string, expiresAt: string): string {
  const secure = process.env.NODE_ENV === "production" ? "; Secure" : "";
  return `${SESSION_COOKIE}=${encodeURIComponent(token)}; Path=/; HttpOnly; SameSite=Lax; Expires=${new Date(
    expiresAt,
  ).toUTCString()}${secure}`;
}

export function clearedSessionCookie(): string {
  const secure = process.env.NODE_ENV === "production" ? "; Secure" : "";
  return `${SESSION_COOKIE}=; Path=/; HttpOnly; SameSite=Lax; Max-Age=0${secure}`;
}

export async function touchCartForUser(userId: string): Promise<string> {
  const db = await getDb();
  const existing = await firstRow<{ id: string }>("SELECT id FROM carts WHERE user_id = ?", [userId]);
  if (existing) return existing.id;
  const id = randomId("cart");
  const now = new Date().toISOString();
  await db
    .prepare("INSERT INTO carts (id, user_id, created_at, updated_at) VALUES (?, ?, ?, ?)")
    .bind(id, userId, now, now)
    .run();
  return id;
}
