import { assertSameOrigin, apiRoute, json } from "@/lib/http";
import { requireUser } from "@/lib/auth";
import { retryPaymentIntent } from "@/lib/services/payments";

export const POST = apiRoute<{ params: Promise<{ number: string }> }>(async (request, { params }) => {
  assertSameOrigin(request);
  const { user } = await requireUser(request);
  const { number } = await params;
  const payment = await retryPaymentIntent(user.id, number);
  return json({ payment });
});
