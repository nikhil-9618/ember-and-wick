import { z } from "zod";
import { assertSameOrigin, apiRoute, json, readJson } from "@/lib/http";
import { requireUser } from "@/lib/auth";
import { quoteCheckout } from "@/lib/services/checkout";

export const POST = apiRoute(async (request) => {
  assertSameOrigin(request);
  const { user } = await requireUser(request);
  const input = await readJson(
    request,
    z.object({ couponCode: z.string().trim().max(32).optional().or(z.literal("")) }),
  );
  const quote = await quoteCheckout(user.id, input.couponCode || undefined);
  return json({
    items: quote.items,
    totals: quote.totals,
    couponApplied: quote.couponApplied,
  });
});
