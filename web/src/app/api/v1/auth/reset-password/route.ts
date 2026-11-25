import { assertSameOrigin, apiRoute, clientIp, json, readJson } from "@/lib/http";
import { resetPasswordSchema } from "@/lib/validation";
import { resetPassword } from "@/lib/services/password-reset";

/**
 * Verifies the emailed code and replaces the password. Every existing session is
 * revoked, so the customer signs in again with the new password.
 */
export const POST = apiRoute(async (request) => {
  assertSameOrigin(request);
  const input = await readJson(request, resetPasswordSchema);
  await resetPassword({
    challengeId: input.challengeId,
    code: input.code,
    newPassword: input.newPassword,
    ip: clientIp(request),
  });
  return json({ ok: true });
});
