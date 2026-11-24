import { apiRoute, assertSameOrigin, clientIp, json, readJson } from "@/lib/http";
import { loginSchema } from "@/lib/validation";
import { sessionCookie } from "@/lib/auth";
import { loginWithPassword } from "@/lib/services/login";

/**
 * Sign in with the password chosen at sign-up. The email address was verified
 * once during registration, so no second code is required here.
 */
export const POST = apiRoute(async (request) => {
  assertSameOrigin(request);
  const input = await readJson(request, loginSchema);
  const result = await loginWithPassword({
    email: input.email,
    password: input.password,
    ip: clientIp(request),
    userAgent: request.headers.get("user-agent"),
  });

  return json(
    {
      user: {
        id: result.user.id,
        email: result.user.email,
        name: result.user.name,
        phone: result.user.phone,
        role: result.user.role,
      },
      token: result.token,
      expiresAt: result.expiresAt,
    },
    { headers: { "Set-Cookie": sessionCookie(result.token, result.expiresAt) } },
  );
});
