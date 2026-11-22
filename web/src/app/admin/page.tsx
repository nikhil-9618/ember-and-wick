import type { Metadata } from "next";
import Link from "next/link";
import { getDashboard } from "@/lib/services/analytics";
import { formatMoney } from "@/lib/money";
import { ORDER_STATUS_LABELS, type OrderStatus } from "@/lib/orders";

export const metadata: Metadata = { title: "Admin dashboard", robots: { index: false, follow: false } };

export default async function AdminDashboardPage() {
  const data = await getDashboard();
  const maxRevenue = Math.max(1, ...data.daily.map((day) => day.revenue));
  const statusCount = (status: string) => data.orderCounts.find((row) => row.status === status)?.count ?? 0;

  return (
    <div className="space-y-10">
      <h1 className="text-2xl">Dashboard</h1>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <div className="border border-line bg-sand/30 p-5">
          <p className="eyebrow">Paid revenue</p>
          <p className="mt-2 text-2xl">{formatMoney(data.revenue.paid)}</p>
          <p className="text-xs text-ink-soft">{data.revenue.paidOrders} paid orders</p>
        </div>
        <div className="border border-line bg-sand/30 p-5">
          <p className="eyebrow">Refunded</p>
          <p className="mt-2 text-2xl">{formatMoney(data.revenue.refunded)}</p>
          <p className="text-xs text-ink-soft">completed refunds</p>
        </div>
        <div className="border border-line bg-sand/30 p-5">
          <p className="eyebrow">Orders in progress</p>
          <p className="mt-2 text-2xl">{statusCount("paid") + statusCount("processing") + statusCount("packed")}</p>
          <p className="text-xs text-ink-soft">{statusCount("shipped")} shipped · {statusCount("delivered")} delivered</p>
        </div>
        <div className="border border-line bg-sand/30 p-5">
          <p className="eyebrow">Customers</p>
          <p className="mt-2 text-2xl">{data.customers}</p>
          <p className="text-xs text-ink-soft">{data.lowStock.length} low-stock variants</p>
        </div>
      </div>

      <section aria-labelledby="revenue-heading">
        <h2 id="revenue-heading" className="text-lg">
          Last 14 days
        </h2>
        {data.daily.length === 0 ? (
          <p className="mt-3 text-sm text-ink-soft">No orders in this period yet.</p>
        ) : (
          <div className="mt-4 flex items-end gap-2 border-b border-line pb-2" role="img" aria-label="Daily paid revenue for the last 14 days">
            {data.daily.map((day) => (
              <div key={day.day} className="flex flex-1 flex-col items-center gap-1">
                <div
                  className="w-full bg-clay/70"
                  style={{ height: `${Math.max(4, Math.round((day.revenue / maxRevenue) * 120))}px` }}
                  title={`${day.day}: ${formatMoney(day.revenue)} (${day.orders} orders)`}
                />
                <span className="text-[0.5625rem] text-ink-soft">{day.day.slice(5)}</span>
              </div>
            ))}
          </div>
        )}
      </section>

      <div className="grid gap-8 lg:grid-cols-2">
        <section aria-labelledby="low-stock-heading">
          <div className="flex items-baseline justify-between">
            <h2 id="low-stock-heading" className="text-lg">
              Low stock
            </h2>
            <Link href="/admin/products" className="text-xs text-clay hover:underline">
              Manage inventory
            </Link>
          </div>
          {data.lowStock.length === 0 ? (
            <p className="mt-3 text-sm text-ink-soft">Every variant is above its threshold.</p>
          ) : (
            <ul className="mt-3 divide-y divide-line border-y border-line text-sm">
              {data.lowStock.map((item) => (
                <li key={item.variantId} className="flex items-center justify-between gap-3 py-2">
                  <div>
                    <p>{item.productName}</p>
                    <p className="text-xs text-ink-soft">
                      {item.variantName} · {item.sku}
                    </p>
                  </div>
                  <p className={item.stock === 0 ? "text-clay-dark" : "text-ink-soft"}>
                    {item.stock} left
                  </p>
                </li>
              ))}
            </ul>
          )}
        </section>

        <section aria-labelledby="recent-heading">
          <div className="flex items-baseline justify-between">
            <h2 id="recent-heading" className="text-lg">
              Recent orders
            </h2>
            <Link href="/admin/orders" className="text-xs text-clay hover:underline">
              View all
            </Link>
          </div>
          {data.recentOrders.length === 0 ? (
            <p className="mt-3 text-sm text-ink-soft">No orders yet.</p>
          ) : (
            <ul className="mt-3 divide-y divide-line border-y border-line text-sm">
              {data.recentOrders.map((order) => (
                <li key={order.number} className="flex items-center justify-between gap-3 py-2">
                  <div>
                    <Link href={`/admin/orders/${order.number}`} className="hover:text-clay">
                      {order.number}
                    </Link>
                    <p className="text-xs text-ink-soft">{order.email}</p>
                  </div>
                  <div className="text-right">
                    <p>{formatMoney(order.total)}</p>
                    <p className="text-xs text-ink-soft">{ORDER_STATUS_LABELS[order.status as OrderStatus] ?? order.status}</p>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </section>
      </div>

      <section aria-labelledby="top-heading">
        <h2 id="top-heading" className="text-lg">
          Best sellers
        </h2>
        {data.topProducts.length === 0 ? (
          <p className="mt-3 text-sm text-ink-soft">No paid orders yet.</p>
        ) : (
          <table className="mt-3 w-full border-collapse text-sm">
            <thead>
              <tr className="border-b border-line text-left text-xs uppercase tracking-wider text-ink-soft">
                <th scope="col" className="py-2 font-medium">Candle</th>
                <th scope="col" className="py-2 text-right font-medium">Units</th>
                <th scope="col" className="py-2 text-right font-medium">Revenue</th>
              </tr>
            </thead>
            <tbody>
              {data.topProducts.map((product) => (
                <tr key={product.product_name} className="border-b border-line/70">
                  <td className="py-2">{product.product_name}</td>
                  <td className="py-2 text-right">{product.units}</td>
                  <td className="py-2 text-right">{formatMoney(product.revenue)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </section>
    </div>
  );
}
