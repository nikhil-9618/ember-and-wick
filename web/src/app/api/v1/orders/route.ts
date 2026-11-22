import { getDb } from "@/lib/db";
import { assertSameOrigin, apiRoute, json, readJson } from "@/lib/http";
import { checkoutSchema } from "@/lib/validation";
import { requireUser } from "@/lib/auth";
import { createOrder } from "@/lib/services/checkout";
import { listUserOrders } from "@/lib/services/orders";
import { sha256Hex } from "@/lib/crypto";

export const GET = apiRoute(async (request) => {
  const { user } = await requireUser(request);
  return json({ orders: await listUserOrders(user.id) });
});

export const POST = apiRoute(async (request) => {
  assertSameOrigin(request);
  const { user } = await requireUser(request);
  const input = await readJson(request, checkoutSchema);
  const db = await getDb();

  // A retried request (double tap, flaky network) must never create two orders.
  const idempotencyKey = input.idempotencyKey ? `${user.id}:order:${input.idempotencyKey}` : null;
  if (idempotencyKey) {
    const existing = await db
      .prepare("SELECT response_json FROM idempotency_keys WHERE key = ?")
      .bind(idempotencyKey)
      .first<{ response_json: string | null }>();
    if (existing?.response_json) {
      return json(JSON.parse(existing.response_json), { status: 201 });
    }
  }

  const result = await createOrder(user.id, input.email ?? user.email, input);

  if (idempotencyKey) {
    await db
      .prepare(
        "INSERT OR IGNORE INTO idempotency_keys (key, user_id, scope, request_hash, response_json, created_at) VALUES (?, ?, 'create_order', ?, ?, ?)",
      )
      .bind(
        idempotencyKey,
        user.id,
        await sha256Hex(JSON.stringify({ addressId: input.addressId ?? null, coupon: input.couponCode ?? null })),
        JSON.stringify(result),
        new Date().toISOString(),
      )
      .run();
  }

  return json(result, { status: 201 });
});
