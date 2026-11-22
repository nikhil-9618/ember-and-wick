import { apiRoute, json } from "@/lib/http";
import { requireAdmin } from "@/lib/auth";
import { getDashboard } from "@/lib/services/analytics";

export const GET = apiRoute(async (request) => {
  await requireAdmin(request);
  return json(await getDashboard());
});
