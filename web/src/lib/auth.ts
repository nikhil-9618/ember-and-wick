import { cookies } from "next/headers";
import { randomId, randomToken, sha256Hex } from "./crypto";
import { forbidden, unauthenticated } from "./errors";
import { getDb } from "./db";
import type { Store } from "./db";

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
  db: Store,
  userId: string,
  userAgent: string | null,
): Promise<{ token: string; expiresAt: string; sessionId: string }> {
  const token = randomToken(32);
  const sessionId = await sha256Hex(token);
  const now = new Date();
  const expiresAt = new Date(now.getTime() + SESSION_TTL_MS).toISOString();

  await db.sessions.deleteMany({
    user_id: userId,
    $or: [{ expires_at: { $lt: now.toISOString() } }, { revoked_at: { $ne: null } }],
  } as any);
  await db.sessions.insertOne({
    _id: sessionId,
    user_id: userId,
    created_at: now.toISOString(),
    expires_at: expiresAt,
    revoked_at: null,
    user_agent: userAgent,
  } as any);

  return { token, expiresAt, sessionId };
}

export async function revokeSession(sessionId: string): Promise<void> {
  const db = await getDb();
  await db.sessions.updateOne(
    { _id: sessionId },
    { $set: { revoked_at: new Date().toISOString() } },
  );
}

export async function userForToken(token: string): Promise<SessionUser | null> {
  if (!token || token.length < 20) return null;
  const db = await getDb();
  const sessionId = await sha256Hex(token);
  const session = await db.sessions.findOne({ _id: sessionId });
  if (!session) return null;
  if (session.revoked_at) return null;
  if (new Date(session.expires_at).getTime() < Date.now()) return null;
  const user = await db.users.findOne({ _id: session.user_id });
  if (!user) return null;
  return {
    id: user._id,
    email: user.email,
    name: user.name,
    phone: user.phone,
    role: user.role,
    created_at: user.created_at,
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
  const existing = await db.carts.findOne({ user_id: userId });
  if (existing) return existing._id;
  const id = randomId("cart");
  const now = new Date().toISOString();
  await db.carts.insertOne({ _id: id, user_id: userId, created_at: now, updated_at: now } as any);
  return id;
}
