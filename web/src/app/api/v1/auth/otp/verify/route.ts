import { apiRoute, assertSameOrigin, clientIp, json, readJson } from "@/lib/http";
import { otpVerifySchema } from "@/lib/validation";
import { sessionCookie } from "@/lib/auth";
import { verifyLoginOtp } from "@/lib/services/login-otp";

/** Step two of sign-in: exchange a valid code for a session. */
export const POST = apiRoute(async (request) => {
  assertSameOrigin(request);
  const input = await readJson(request, otpVerifySchema);
  const result = await verifyLoginOtp({
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
    { headers: { "Set-Cookie": sessionCookie(result.token, result.expiresAt) } },
  );
});
