import { getDb } from "@/lib/db";
import { randomId } from "@/lib/crypto";
import { assertSameOrigin, apiRoute, json, readJson } from "@/lib/http";
import { couponSchema } from "@/lib/validation";
import { conflict } from "@/lib/errors";
import { requireAdmin } from "@/lib/auth";
import { auditActor, recordAudit } from "@/lib/services/audit";

export const GET = apiRoute(async (request) => {
  await requireAdmin(request);
  const db = await getDb();
  const coupons = await db.coupons.find({}).sort({ created_at: -1 }).toArray();
  return json({ coupons: (coupons as any[]).map((c) => ({ ...c, id: c._id })) });
});

export const POST = apiRoute(async (request) => {
  assertSameOrigin(request);
  const auth = await requireAdmin(request);
  const input = await readJson(request, couponSchema);
  const db = await getDb();

  if (input.type === "percent" && input.value > 90) {
    return json(
      { error: { code: "validation_error", message: "Percentage coupons are capped at 90%." } },
      { status: 422 },
    );
  }
  if (input.startsAt && input.endsAt && input.startsAt >= input.endsAt) {
    return json(
      { error: { code: "validation_error", message: "The end date must be after the start date." } },
      { status: 422 },
    );
  }

  const id = randomId("cpn");
  const now = new Date().toISOString();
  try {
    await db.coupons.insertOne({
      _id: id,
      code: input.code,
      description: input.description || null,
      type: input.type,
      value: input.value,
      min_subtotal: input.minSubtotal,
      max_discount: input.maxDiscount ?? null,
      usage_limit: input.usageLimit ?? null,
      used_count: 0,
      starts_at: input.startsAt ?? null,
      ends_at: input.endsAt ?? null,
      is_active: input.isActive ? 1 : 0,
      created_at: now,
    } as any);
  } catch (error) {
    const message = error instanceof Error ? error.message : "";
    if (/duplicate key|E11000/i.test(message)) throw conflict("That coupon code already exists.");
    throw error;
  }

  await recordAudit({
    actor: auditActor(auth),
    action: "coupon.created",
    entityType: "coupon",
    entityId: id,
    summary: `Created coupon ${input.code} (${input.type} ${input.value})`,
    detail: { usageLimit: input.usageLimit ?? null, minSubtotal: input.minSubtotal, isActive: input.isActive },
  });

  return json({ id, code: input.code }, { status: 201 });
});