import { getDb } from "@/lib/db";
import { hashPassword } from "@/lib/password";
import { randomId } from "@/lib/crypto";
import { assertSameOrigin, clientIp, json, readJson, apiRoute } from "@/lib/http";
import { registerSchema } from "@/lib/validation";
import { ApiError, rateLimited } from "@/lib/errors";
import { createSession, sessionCookie, touchCartForUser } from "@/lib/auth";
import { checkRateLimit } from "@/lib/rate-limit";

export const POST = apiRoute(async (request) => {
  assertSameOrigin(request);
  const db = await getDb();

  const limit = await checkRateLimit(db, `register:${clientIp(request)}`, 10, 60 * 60);
  if (!limit.allowed) throw rateLimited("Too many sign-up attempts. Please try again in a little while.");

  const input = await readJson(request, registerSchema);

  const existing = await db.prepare("SELECT id FROM users WHERE email = ?").bind(input.email).first<{ id: string }>();
  if (existing) throw new ApiError("conflict", "An account with this email already exists.", 409);

  const userId = randomId("usr");
  const now = new Date().toISOString();
  const passwordHash = await hashPassword(input.password);

  await db
    .prepare(
      "INSERT INTO users (id, email, password_hash, name, phone, role, created_at, updated_at) VALUES (?, ?, ?, ?, ?, 'customer', ?, ?)",
    )
    .bind(userId, input.email, passwordHash, input.name, input.phone ? input.phone : null, now, now)
    .run();

  await touchCartForUser(userId);
  const session = await createSession(db, userId, request.headers.get("user-agent"));

  return json(
    {
      user: { id: userId, email: input.email, name: input.name, phone: input.phone || null, role: "customer" },
      token: session.token,
      expiresAt: session.expiresAt,
    },
    { status: 201, headers: { "Set-Cookie": sessionCookie(session.token, session.expiresAt) } },
  );
});
