import { z } from "zod";
import { assertSameOrigin, apiRoute, json, readJson } from "@/lib/http";
import { requireUser } from "@/lib/auth";
import { confirmPayment } from "@/lib/services/payments";

export const POST = apiRoute(async (request) => {
  assertSameOrigin(request);
  const { user } = await requireUser(request);
  const input = await readJson(
    request,
    z.object({
      orderNumber: z.string().min(3).max(40),
      razorpayOrderId: z.string().min(3).max(80),
      razorpayPaymentId: z.string().min(3).max(80),
      razorpaySignature: z.string().min(16).max(256),
    }),
  );

  const result = await confirmPayment({
    userId: user.id,
    orderNumber: input.orderNumber,
    providerOrderId: input.razorpayOrderId,
    providerPaymentId: input.razorpayPaymentId,
    signature: input.razorpaySignature,
  });

  return json(result);
});
