import type { Metadata } from "next";
import { getDb } from "@/lib/db";
import { formatMoney } from "@/lib/money";

export const metadata: Metadata = { title: "Customers", robots: { index: false, follow: false } };

export default async function AdminCustomersPage() {
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
  const customers = (users as any[]).map((u) => ({
    id: u._id,
    name: u.name,
    email: u.email,
    phone: u.phone,
    created_at: u.created_at,
    order_count: agg.get(u._id)?.count ?? 0,
    lifetime_value: agg.get(u._id)?.value ?? 0,
    last_order_at: agg.get(u._id)?.last ?? null,
  }));

  return (
    <div>
      <h1 className="text-2xl">Customers</h1>
      <p className="mt-1 text-sm text-ink-soft">{customers.length} registered customers.</p>

      {customers.length === 0 ? (
        <p className="mt-6 border border-line bg-sand/30 p-6 text-sm text-ink-soft">No customers yet.</p>
      ) : (
        <div className="mt-6 overflow-x-auto">
          <table className="w-full min-w-[38rem] border-collapse text-sm">
            <thead>
              <tr className="border-b border-line text-left text-xs uppercase tracking-wider text-ink-soft">
                <th scope="col" className="py-2 font-medium">Customer</th>
                <th scope="col" className="py-2 font-medium">Joined</th>
                <th scope="col" className="py-2 text-right font-medium">Orders</th>
                <th scope="col" className="py-2 text-right font-medium">Lifetime value</th>
                <th scope="col" className="py-2 text-right font-medium">Last order</th>
              </tr>
            </thead>
            <tbody>
              {customers.map((customer) => (
                <tr key={customer.id} className="border-b border-line/70">
                  <td className="py-2.5">
                    {customer.name}
                    <span className="block text-xs text-ink-soft">{customer.email}</span>
                    {customer.phone ? <span className="block text-xs text-ink-soft">{customer.phone}</span> : null}
                  </td>
                  <td className="py-2.5 text-ink-soft">
                    {new Date(customer.created_at).toLocaleDateString("en-IN", { dateStyle: "medium" })}
                  </td>
                  <td className="py-2.5 text-right">{customer.order_count}</td>
                  <td className="py-2.5 text-right">{formatMoney(customer.lifetime_value)}</td>
                  <td className="py-2.5 text-right text-ink-soft">
                    {customer.last_order_at
                      ? new Date(customer.last_order_at).toLocaleDateString("en-IN", { dateStyle: "medium" })
                      : "—"}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
