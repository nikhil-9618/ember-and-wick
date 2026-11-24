import { apiRoute, assertSameOrigin, clientIp, json, readJson } from "@/lib/http";
import { signupVerifySchema } from "@/lib/validation";
import { sessionCookie } from "@/lib/auth";
import { verifySignupOtp } from "@/lib/services/signup-otp";

/**
 * Step two of sign-up: the emailed code is the only thing that can activate the
 * account, and this route is the first place a session is minted.
 */
export const POST = apiRoute(async (request) => {
  assertSameOrigin(request);
  const input = await readJson(request, signupVerifySchema);
  const result = await verifySignupOtp({
    challengeId: input.challengeId,
    code: input.code,
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
    { status: 201, headers: { "Set-Cookie": sessionCookie(result.token, result.expiresAt) } },
  );
});
