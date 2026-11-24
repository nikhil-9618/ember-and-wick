import { z } from "zod";
import { assertSameOrigin, apiRoute, json, readJson } from "@/lib/http";
import { requireUser } from "@/lib/auth";
import { getPaymentConfig } from "@/lib/config";
import { confirmTestPayment } from "@/lib/services/payments";

/**
 * Only reachable when PAYMENT_PROVIDER=test, which `getPaymentConfig` refuses in
 * production. It exists so the automated suite can walk the full order journey
 * without a live gateway; a deployment can never fake a capture.
 */
export const POST = apiRoute(async (request) => {
  assertSameOrigin(request);
  const { user } = await requireUser(request);
  const input = await readJson(request, z.object({ orderNumber: z.string().min(3).max(40) }));
  await confirmTestPayment(user.id, input.orderNumber);
  const config = await getPaymentConfig();
  return json({ ok: true, mode: config.mode });
});
