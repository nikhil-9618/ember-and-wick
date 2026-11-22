import { getDb } from "@/lib/db";
import { fakeVerify, verifyPassword } from "@/lib/password";
import { assertSameOrigin, apiRoute, clientIp, json, readJson } from "@/lib/http";
import { loginSchema } from "@/lib/validation";
import { rateLimited, unauthenticated } from "@/lib/errors";
import { createSession, sessionCookie, touchCartForUser } from "@/lib/auth";
import { checkRateLimit } from "@/lib/rate-limit";

export const POST = apiRoute(async (request) => {
  assertSameOrigin(request);
  const db = await getDb();
  const input = await readJson(request, loginSchema);

  const ipLimit = await checkRateLimit(db, `login:ip:${clientIp(request)}`, 30, 15 * 60);
  const accountLimit = await checkRateLimit(db, `login:email:${input.email}`, 10, 15 * 60);
  if (!ipLimit.allowed || !accountLimit.allowed) {
    throw rateLimited("Too many sign-in attempts. Please wait a few minutes and try again.");
  }

  const user = await db
    .prepare("SELECT id, email, name, phone, role, password_hash FROM users WHERE email = ?")
    .bind(input.email)
    .first<{ id: string; email: string; name: string; phone: string | null; role: string; password_hash: string }>();

  if (!user) {
    await fakeVerify();
    throw unauthenticated("Email or password is incorrect.");
  }

  const valid = await verifyPassword(input.password, user.password_hash);
  if (!valid) throw unauthenticated("Email or password is incorrect.");

  await touchCartForUser(user.id);
  const session = await createSession(db, user.id, request.headers.get("user-agent"));

  return json(
    {
      user: { id: user.id, email: user.email, name: user.name, phone: user.phone, role: user.role },
      token: session.token,
      expiresAt: session.expiresAt,
    },
    { headers: { "Set-Cookie": sessionCookie(session.token, session.expiresAt) } },
  );
});
