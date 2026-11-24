import { apiRoute, assertSameOrigin, clientIp, json, readJson } from "@/lib/http";
import { loginSchema } from "@/lib/validation";
import { startLogin } from "@/lib/services/login-otp";

/**
 * Step one of sign-in. A correct password does not create a session; it issues a
 * single-use six-digit code. The client then calls /auth/otp/verify, which is the
 * only place a session cookie or bearer token is minted.
 */
export const POST = apiRoute(async (request) => {
  assertSameOrigin(request);
  const input = await readJson(request, loginSchema);
  const challenge = await startLogin({ email: input.email, password: input.password, ip: clientIp(request) });
  return json(challenge);
});
