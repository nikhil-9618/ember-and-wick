import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { getOrderForAdmin } from "@/lib/services/orders";
import { formatMoney } from "@/lib/money";
import { ORDER_STATUS_LABELS, nextStatuses } from "@/lib/orders";
import { OrderStatusForm } from "@/components/admin/order-status-form";

export const metadata: Metadata = { title: "Order detail", robots: { index: false, follow: false } };

export default async function AdminOrderPage({ params }: { params: Promise<{ number: string }> }) {
  const { number } = await params;
  const order = await getOrderForAdmin(number);
  if (!order) notFound();

  const transitions = nextStatuses(order.status);

  return (
    <div>
      <Link href="/admin/orders" className="text-xs text-ink-soft hover:text-ink">
        ← Orders
      </Link>

      <div className="mt-2 flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl">{order.number}</h1>
          <p className="text-sm text-ink-soft">
            {order.email} · placed {new Date(order.createdAt).toLocaleString("en-IN", { dateStyle: "medium", timeStyle: "short" })}
          </p>
        </div>
        <div className="text-right">
          <p className="text-xl">{formatMoney(order.total)}</p>
          <p className="text-xs uppercase tracking-wider text-ink-soft">{order.paymentStatus}</p>
        </div>
      </div>

      <div className="mt-8 grid gap-10 lg:grid-cols-[1.5fr_1fr]">
        <div className="space-y-8">
          <section>
            <h2 className="text-lg">Items</h2>
            <ul className="mt-3 divide-y divide-line border-y border-line text-sm">
              {order.items.map((item) => (
                <li key={item.id} className="flex justify-between gap-4 py-2">
                  <div>
                    <p>{item.productName}</p>
                    <p className="text-xs text-ink-soft">
                      {item.variantName} · {item.sku} · qty {item.quantity}
                    </p>
                  </div>
                  <p>{formatMoney(item.lineTotal)}</p>
                </li>
              ))}
            </ul>
            <dl className="mt-3 space-y-1 text-sm">
              <div className="flex justify-between">
                <dt className="text-ink-soft">Subtotal</dt>
                <dd>{formatMoney(order.subtotal)}</dd>
              </div>
              {order.discount > 0 ? (
                <div className="flex justify-between">
                  <dt className="text-ink-soft">Discount {order.couponCode ? `(${order.couponCode})` : ""}</dt>
                  <dd>− {formatMoney(order.discount)}</dd>
                </div>
              ) : null}
              <div className="flex justify-between">
                <dt className="text-ink-soft">Shipping</dt>
                <dd>{formatMoney(order.shippingFee)}</dd>
              </div>
              <div className="flex justify-between border-t border-line pt-1 text-base">
                <dt>Total</dt>
                <dd>{formatMoney(order.total)}</dd>
              </div>
            </dl>
          </section>

          {order.address ? (
            <section>
              <h2 className="text-lg">Delivery address</h2>
              <p className="mt-2 text-sm text-ink-soft">
                {order.address.fullName}
                <br />
                {order.address.line1}
                {order.address.line2 ? (
                  <>
                    <br />
                    {order.address.line2}
                  </>
                ) : null}
                <br />
                {order.address.city}, {order.address.state} {order.address.postalCode}
                <br />
                {order.address.phone}
              </p>
            </section>
          ) : null}

          {order.notes ? (
            <section>
              <h2 className="text-lg">Gift note</h2>
              <p className="mt-2 text-sm text-ink-soft">{order.notes}</p>
            </section>
          ) : null}

          {order.payment ? (
            <section>
              <h2 className="text-lg">Payment</h2>
              <p className="mt-2 text-sm text-ink-soft">
                {order.payment.provider} · {order.payment.status}
                {order.payment.providerPaymentId ? ` · ${order.payment.providerPaymentId}` : ""}
              </p>
            </section>
          ) : null}

          {order.refunds.length > 0 ? (
            <section>
              <h2 className="text-lg">Refunds</h2>
              <ul className="mt-2 space-y-1 text-sm text-ink-soft">
                {order.refunds.map((refund) => (
                  <li key={refund.id}>
                    {formatMoney(refund.amount)} · {refund.status} · {refund.reason}
                  </li>
                ))}
              </ul>
            </section>
          ) : null}
        </div>

        <aside className="space-y-6">
          <div className="border border-line p-4">
            <p className="eyebrow">Current status</p>
            <p className="mt-1 text-lg">{ORDER_STATUS_LABELS[order.status] ?? order.status}</p>
          </div>

          <OrderStatusForm
            orderNumber={order.number}
            currentStatus={order.status}
            transitions={transitions.map((status) => ({
              value: status,
              label: ORDER_STATUS_LABELS[status],
            }))}
            trackingNumber={order.trackingNumber ?? ""}
            carrier={order.carrier ?? ""}
          />

          {order.status === "delivered" || order.status === "shipped" ? (
            <Link href="/admin/refunds" className="block text-xs text-clay hover:underline">
              Issue a refund for this order →
            </Link>
          ) : null}
        </aside>
      </div>
    </div>
  );
}
