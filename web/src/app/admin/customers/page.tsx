import type { Metadata } from "next";
import { allRows } from "@/lib/db";
import { formatMoney } from "@/lib/money";

export const metadata: Metadata = { title: "Customers", robots: { index: false, follow: false } };

export default async function AdminCustomersPage() {
  const customers = await allRows<{
    id: string;
    name: string;
    email: string;
    phone: string | null;
    created_at: string;
    order_count: number;
    lifetime_value: number;
    last_order_at: string | null;
  }>(
    `SELECT u.id, u.name, u.email, u.phone, u.created_at,
            (SELECT COUNT(*) FROM orders o WHERE o.user_id = u.id) AS order_count,
            (SELECT COALESCE(SUM(total), 0) FROM orders o WHERE o.user_id = u.id AND o.payment_status = 'paid') AS lifetime_value,
            (SELECT MAX(created_at) FROM orders o WHERE o.user_id = u.id) AS last_order_at
       FROM users u WHERE u.role = 'customer'
      ORDER BY u.created_at DESC LIMIT 200`,
  );

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
