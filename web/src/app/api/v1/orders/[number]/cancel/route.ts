import { assertSameOrigin, apiRoute, json } from "@/lib/http";
import { ApiError, notFound } from "@/lib/errors";
import { requireUser } from "@/lib/auth";
import { cancelUnpaidOrder } from "@/lib/services/orders";

export const POST = apiRoute<{ params: Promise<{ number: string }> }>(async (request, { params }) => {
  assertSameOrigin(request);
  const { user } = await requireUser(request);
  const { number } = await params;

  try {
    const order = await cancelUnpaidOrder(user.id, number);
    return json({ order });
  } catch (error) {
    const message = error instanceof Error ? error.message : "";
    if (message === "not_found") throw notFound("We couldn't find that order.");
    if (message === "paid_order") {
      throw new ApiError("conflict", "This order is already paid. Contact us and we'll help you cancel it.", 409);
    }
    if (message === "not_cancellable") {
      throw new ApiError("conflict", "This order can no longer be cancelled online.", 409);
    }
    throw error;
  }
});
