import { z } from "zod";
import { getDb } from "@/lib/db";
import { assertSameOrigin, apiRoute, json, readJson } from "@/lib/http";
import { notFound } from "@/lib/errors";
import { requireAdmin } from "@/lib/auth";

export const PATCH = apiRoute<{ params: Promise<{ id: string }> }>(async (request, { params }) => {
  assertSameOrigin(request);
  await requireAdmin(request);
  const { id } = await params;
  const input = await readJson(request, z.object({ isActive: z.boolean() }));
  const db = await getDb();
  const result = await db
    .prepare("UPDATE coupons SET is_active = ? WHERE id = ?")
    .bind(input.isActive ? 1 : 0, id)
    .run();
  if ((result.meta.changes ?? 0) === 0) throw notFound("Coupon not found.");
  return json({ ok: true });
});
