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
    const existing = await db.idempotency_keys.findOne({ _id: idempotencyKey });
    if ((existing as any)?.response_json) {
      return json(JSON.parse((existing as any).response_json), { status: 201 });
    }
  }

  const result = await createOrder(user.id, input.email ?? user.email, input);

  if (idempotencyKey) {
    try {
      await db.idempotency_keys.insertOne({
        _id: idempotencyKey,
        user_id: user.id,
        scope: "create_order",
        request_hash: await sha256Hex(JSON.stringify({ addressId: input.addressId ?? null, coupon: input.couponCode ?? null })),
        response_json: JSON.stringify(result),
        created_at: new Date().toISOString(),
      } as any);
    } catch {
      // duplicate ignored
    }
  }

  return json(result, { status: 201 });
});
