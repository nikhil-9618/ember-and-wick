import { apiRoute, json } from "@/lib/http";
import { requireAdmin } from "@/lib/auth";
import { listAuditEntries } from "@/lib/services/audit";

export const GET = apiRoute(async (request) => {
  await requireAdmin(request);
  const params = new URL(request.url).searchParams;
  const limit = Number.parseInt(params.get("limit") ?? "100", 10);
  const entries = await listAuditEntries({
    limit: Number.isFinite(limit) ? limit : 100,
    entityType: params.get("entityType") ?? undefined,
    entityId: params.get("entityId") ?? undefined,
    action: params.get("action") ?? undefined,
  });
  return json({ entries });
});
