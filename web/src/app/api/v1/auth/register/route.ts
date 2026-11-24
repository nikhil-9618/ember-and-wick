import { assertSameOrigin, clientIp, json, readJson, apiRoute } from "@/lib/http";
import { registerSchema } from "@/lib/validation";
import { startSignup } from "@/lib/services/signup-otp";

/**
 * Step one of sign-up: store the account unverified and email a six-digit code
 * to the address being claimed. No session exists until the code is verified.
 */
export const POST = apiRoute(async (request) => {
  assertSameOrigin(request);
  const input = await readJson(request, registerSchema);
  const challenge = await startSignup({
    name: input.name,
    email: input.email,
    password: input.password,
    phone: input.phone ?? undefined,
    ip: clientIp(request),
  });

  return json(challenge, { status: 202 });
});
