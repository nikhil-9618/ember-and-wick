import { allRows, getDb } from "@/lib/db";
import { randomId } from "@/lib/crypto";
import { assertSameOrigin, apiRoute, json, readJson } from "@/lib/http";
import { couponSchema } from "@/lib/validation";
import { conflict } from "@/lib/errors";
import { requireAdmin } from "@/lib/auth";

export const GET = apiRoute(async (request) => {
  await requireAdmin(request);
  const coupons = await allRows(
    `SELECT id, code, description, type, value, min_subtotal, max_discount, usage_limit, used_count,
            starts_at, ends_at, is_active, created_at
       FROM coupons ORDER BY created_at DESC`,
  );
  return json({ coupons });
});

export const POST = apiRoute(async (request) => {
  assertSameOrigin(request);
  await requireAdmin(request);
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
  try {
    await db
      .prepare(
        `INSERT INTO coupons (id, code, description, type, value, min_subtotal, max_discount, usage_limit,
                              used_count, starts_at, ends_at, is_active, created_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, 0, ?, ?, ?, ?)`,
      )
      .bind(
        id,
        input.code,
        input.description || null,
        input.type,
        input.value,
        input.minSubtotal,
        input.maxDiscount ?? null,
        input.usageLimit ?? null,
        input.startsAt ?? null,
        input.endsAt ?? null,
        input.isActive ? 1 : 0,
        new Date().toISOString(),
      )
      .run();
  } catch (error) {
    const message = error instanceof Error ? error.message : "";
    if (/UNIQUE constraint failed/i.test(message)) throw conflict("That coupon code already exists.");
    throw error;
  }

  return json({ id, code: input.code }, { status: 201 });
});
