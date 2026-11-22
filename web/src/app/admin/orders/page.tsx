import type { Metadata } from "next";
import Link from "next/link";
import { listAllOrders } from "@/lib/services/orders";
import { formatMoney } from "@/lib/money";
import { ORDER_STATUS_LABELS, type OrderStatus } from "@/lib/orders";

export const metadata: Metadata = { title: "Orders", robots: { index: false, follow: false } };

const FILTERS = [
  "all",
  "pending_payment",
  "paid",
  "processing",
  "packed",
  "shipped",
  "delivered",
  "payment_failed",
  "cancelled",
  "refunded",
];

export default async function AdminOrdersPage({
  searchParams,
}: {
  searchParams: Promise<{ status?: string; q?: string }>;
}) {
  const { status, q } = await searchParams;
  const orders = await listAllOrders({
    status: status && status !== "all" ? status : undefined,
    q: q?.trim() || undefined,
    limit: 200,
  });

  return (
    <div>
      <h1 className="text-2xl">Orders</h1>

      <div className="mt-4 flex flex-wrap items-center gap-3">
        <form action="/admin/orders" method="get" className="flex gap-2">
          <input
            name="q"
            defaultValue={q ?? ""}
            placeholder="Order number or email"
            className="w-56 border border-line bg-ivory px-3 py-1.5 text-sm"
            aria-label="Search orders"
          />
          {status ? <input type="hidden" name="status" value={status} /> : null}
          <button type="submit" className="border border-ink px-3 py-1.5 text-xs uppercase tracking-wider">
            Search
          </button>
        </form>
      </div>

      <nav aria-label="Filter by status" className="mt-4 flex flex-wrap gap-2 text-xs">
        {FILTERS.map((filter) => (
          <Link
            key={filter}
            href={`/admin/orders${filter === "all" ? "" : `?status=${filter}`}`}
            className={`border px-2.5 py-1 uppercase tracking-wider ${
              (status ?? "all") === filter ? "border-ink bg-ink text-ivory" : "border-line text-ink-soft"
            }`}
          >
            {filter === "all" ? "All" : ORDER_STATUS_LABELS[filter as OrderStatus] ?? filter}
          </Link>
        ))}
      </nav>

      {orders.length === 0 ? (
        <p className="mt-6 border border-line bg-sand/30 p-6 text-sm text-ink-soft">No orders match this filter.</p>
      ) : (
        <div className="mt-6 overflow-x-auto">
          <table className="w-full min-w-[44rem] border-collapse text-sm">
            <thead>
              <tr className="border-b border-line text-left text-xs uppercase tracking-wider text-ink-soft">
                <th scope="col" className="py-2 font-medium">Order</th>
                <th scope="col" className="py-2 font-medium">Customer</th>
                <th scope="col" className="py-2 font-medium">Placed</th>
                <th scope="col" className="py-2 font-medium">Status</th>
                <th scope="col" className="py-2 font-medium">Payment</th>
                <th scope="col" className="py-2 text-right font-medium">Total</th>
              </tr>
            </thead>
            <tbody>
              {orders.map((order) => (
                <tr key={order.id} className="border-b border-line/70">
                  <td className="py-2.5">
                    <Link href={`/admin/orders/${order.number}`} className="hover:text-clay">
                      {order.number}
                    </Link>
                  </td>
                  <td className="py-2.5 text-ink-soft">{order.email}</td>
                  <td className="py-2.5 text-ink-soft">
                    {new Date(order.createdAt).toLocaleDateString("en-IN", { dateStyle: "medium" })}
                  </td>
                  <td className="py-2.5">{ORDER_STATUS_LABELS[order.status] ?? order.status}</td>
                  <td className="py-2.5 text-xs uppercase tracking-wider text-ink-soft">{order.paymentStatus}</td>
                  <td className="py-2.5 text-right">{formatMoney(order.total)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
