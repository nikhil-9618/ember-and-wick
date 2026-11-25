import { assertSameOrigin, apiRoute, clientIp, json, readJson } from "@/lib/http";
import { forgotPasswordSchema } from "@/lib/validation";
import { startPasswordReset } from "@/lib/services/password-reset";

/**
 * Starts a password reset by emailing a six-digit code to the account address.
 * The response is intentionally the same for known and unknown addresses.
 */
export const POST = apiRoute(async (request) => {
  assertSameOrigin(request);
  const input = await readJson(request, forgotPasswordSchema);
  const challenge = await startPasswordReset({
    email: input.email,
    ip: clientIp(request),
  });
  return json(challenge, { status: 202 });
});
