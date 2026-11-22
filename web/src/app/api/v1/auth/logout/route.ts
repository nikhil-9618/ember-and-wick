import { assertSameOrigin, apiRoute, json } from "@/lib/http";
import { clearedSessionCookie, resolveAuth, revokeSession } from "@/lib/auth";

export const POST = apiRoute(async (request) => {
  assertSameOrigin(request);
  const auth = await resolveAuth(request);
  if (auth) await revokeSession(auth.sessionId);
  return json({ ok: true }, { headers: { "Set-Cookie": clearedSessionCookie() } });
});
