import { apiRoute, json } from "@/lib/http";
import { requireAdmin } from "@/lib/auth";
import { listAllOrders } from "@/lib/services/orders";

export const GET = apiRoute(async (request) => {
  await requireAdmin(request);
  const url = new URL(request.url);
  const status = url.searchParams.get("status") ?? undefined;
  const q = url.searchParams.get("q") ?? undefined;
  const limit = Math.min(200, Math.max(1, Number(url.searchParams.get("limit") ?? 100)));
  return json({ orders: await listAllOrders({ status, q, limit }) });
});
