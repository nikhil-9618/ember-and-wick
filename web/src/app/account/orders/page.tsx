import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth";
import { listUserOrders } from "@/lib/services/orders";
import { formatMoney } from "@/lib/money";
import { ORDER_STATUS_LABELS } from "@/lib/orders";

export const metadata: Metadata = { title: "Orders", robots: { index: false, follow: false } };

export default async function OrdersPage() {
  const user = await getCurrentUser();
  if (!user) redirect("/login?next=/account/orders");
  const orders = await listUserOrders(user.id);

  if (orders.length === 0) {
    return (
      <div className="border border-line bg-sand/30 p-10 text-center">
        <h2 className="text-xl">No orders yet</h2>
        <p className="mt-2 text-sm text-ink-soft">When you place an order it will appear here with live tracking.</p>
        <Link href="/shop" className="mt-6 inline-block bg-ink px-6 py-3 text-sm text-ivory">
          Shop candles
        </Link>
      </div>
    );
  }

  return (
    <div>
      <h2 className="text-xl">Your orders</h2>
      <ul className="mt-6 divide-y divide-line border-y border-line">
        {orders.map((order) => (
          <li key={order.id} className="py-5">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <Link href={`/account/orders/${order.number}`} className="text-base hover:text-clay">
                  {order.number}
                </Link>
                <p className="text-xs text-ink-soft">
                  Placed {new Date(order.createdAt).toLocaleDateString("en-IN", { dateStyle: "medium" })} ·{" "}
                  {order.items.reduce((sum, item) => sum + item.quantity, 0)} item
                  {order.items.reduce((sum, item) => sum + item.quantity, 0) === 1 ? "" : "s"}
                </p>
                <p className="mt-1 text-xs text-ink-soft">
                  {order.items.map((item) => item.productName).join(", ")}
                </p>
              </div>
              <div className="text-right">
                <p className="text-sm">{formatMoney(order.total)}</p>
                <p className="text-xs text-sage">{ORDER_STATUS_LABELS[order.status] ?? order.status}</p>
                <Link href={`/account/orders/${order.number}`} className="mt-2 inline-block text-xs underline underline-offset-4">
                  View &amp; track
                </Link>
              </div>
            </div>
          </li>
        ))}
      </ul>
    </div>
  );
}
