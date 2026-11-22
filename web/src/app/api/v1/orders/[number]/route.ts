import { apiRoute, json } from "@/lib/http";
import { notFound } from "@/lib/errors";
import { requireUser } from "@/lib/auth";
import { getOrderForUser } from "@/lib/services/orders";

export const GET = apiRoute<{ params: Promise<{ number: string }> }>(async (request, { params }) => {
  const { user } = await requireUser(request);
  const { number } = await params;
  const order = await getOrderForUser(user.id, number);
  if (!order) throw notFound("We couldn't find that order.");
  return json({ order });
});
