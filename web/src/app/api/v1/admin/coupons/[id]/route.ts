import { getDb } from "@/lib/db";
import { assertSameOrigin, apiRoute, json, readJson } from "@/lib/http";
import { notFound } from "@/lib/errors";
import { requireAdmin } from "@/lib/auth";
import { auditActor, recordAudit } from "@/lib/services/audit";
import { z } from "zod";

export const PATCH = apiRoute<{ params: Promise<{ id: string }> }>(async (request, { params }) => {
  assertSameOrigin(request);
  const auth = await requireAdmin(request);
  const { id } = await params;
  const input = await readJson(request, z.object({ isActive: z.boolean() }));
  const db = await getDb();
  const result = await db.coupons.updateOne({ _id: id }, { $set: { is_active: input.isActive ? 1 : 0 } });
  if ((result as any).matchedCount === 0) throw notFound("Coupon not found.");
  await recordAudit({
    actor: auditActor(auth),
    action: input.isActive ? "coupon.activated" : "coupon.deactivated",
    entityType: "coupon",
    entityId: id,
    summary: `${input.isActive ? "Activated" : "Deactivated"} coupon ${id}`,
  });
  return json({ ok: true });
});