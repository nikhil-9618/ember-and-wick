import { getDb } from "@/lib/db";
import { apiRoute, json } from "@/lib/http";
import { requireAdmin } from "@/lib/auth";

export const GET = apiRoute(async (request) => {
  await requireAdmin(request);
  const db = await getDb();
  const users = await db.users.find({ role: "customer" }).sort({ created_at: -1 }).limit(200).toArray();
  const customerIds = (users as any[]).map((u) => u._id);
  const orders = customerIds.length ? await db.orders.find({ user_id: { $in: customerIds } }).toArray() : [];
  const agg = new Map<string, { count: number; value: number; last: string | null }>();
  for (const u of users as any[]) agg.set(u._id, { count: 0, value: 0, last: null });
  for (const o of orders as any[]) {
    const a = agg.get(o.user_id);
    if (!a) continue;
    a.count += 1;
    if (o.payment_status === "paid") a.value += o.total;
    if (!a.last || o.created_at > a.last) a.last = o.created_at;
  }
  const rows = (users as any[]).map((u) => ({
    id: u._id,
    name: u.name,
    email: u.email,
    phone: u.phone,
    created_at: u.created_at,
    order_count: agg.get(u._id)?.count ?? 0,
    lifetime_value: agg.get(u._id)?.value ?? 0,
    last_order_at: agg.get(u._id)?.last ?? null,
  }));
  return json({ customers: rows });
});