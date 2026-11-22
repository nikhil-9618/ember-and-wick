import { z } from "zod";
import { assertSameOrigin, apiRoute, json, readJson } from "@/lib/http";
import { requireUser } from "@/lib/auth";
import { confirmTestPayment } from "@/lib/services/payments";

/**
 * Only reachable when PAYMENT_PROVIDER=test and NODE_ENV is not production
 * (enforced in getPaymentConfig). It exists so the automated test suite can walk
 * the full order journey without contacting a real payment gateway.
 */
export const POST = apiRoute(async (request) => {
  assertSameOrigin(request);
  const { user } = await requireUser(request);
  const input = await readJson(request, z.object({ orderNumber: z.string().min(3).max(40) }));
  await confirmTestPayment(user.id, input.orderNumber);
  return json({ ok: true, mode: "test" });
});
