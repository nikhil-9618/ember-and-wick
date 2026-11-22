import type { Metadata } from "next";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth";
import { getOrderForUser } from "@/lib/services/orders";
import { formatMoney } from "@/lib/money";
import { ORDER_STATUS_LABELS, ORDER_TIMELINE } from "@/lib/orders";
import { OrderActions } from "@/components/account/order-actions";

export const metadata: Metadata = { title: "Order details", robots: { index: false, follow: false } };

interface PageProps {
  params: Promise<{ number: string }>;
  searchParams: Promise<{ paid?: string }>;
}

export default async function OrderDetailPage({ params, searchParams }: PageProps) {
  const user = await getCurrentUser();
  if (!user) redirect("/login?next=/account/orders");

  const { number } = await params;
  const { paid } = await searchParams;
  const order = await getOrderForUser(user.id, number);
  if (!order) notFound();

  const reachedIndex = ORDER_TIMELINE.indexOf(order.status);
  const cancelled = order.status === "cancelled" || order.status === "refunded";

  return (
    <div className="space-y-10">
      {paid === "1" ? (
        <div className="border border-sage/50 bg-sage/10 p-5">
          <p className="text-lg">Thank you — your payment is confirmed.</p>
          <p className="mt-1 text-sm text-ink-soft">
            A confirmation has been added to your notifications. We&apos;ll write again when your order ships.
          </p>
        </div>
      ) : null}

      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <p className="eyebrow">Order</p>
          <h2 className="mt-1 text-2xl">{order.number}</h2>
          <p className="mt-1 text-sm text-ink-soft">
            Placed {new Date(order.createdAt).toLocaleDateString("en-IN", { dateStyle: "long" })} ·{" "}
            {ORDER_STATUS_LABELS[order.status]}
          </p>
        </div>
        <div className="text-right">
          <p className="text-xl">{formatMoney(order.total)}</p>
          <p className="text-xs uppercase tracking-wider text-ink-soft">
            {order.paymentStatus.replace("_", " ")}
          </p>
        </div>
      </div>

      {cancelled ? (
        <p className="border border-line bg-sand/30 p-4 text-sm text-ink-soft">
          This order is {order.status}. Reserved stock has been returned to inventory.
          {order.refunds.length > 0
            ? ` A refund of ${formatMoney(order.refunds.reduce((sum, refund) => sum + refund.amount, 0))} is ${order.refunds[0]!.status}.`
            : ""}
        </p>
      ) : (
        <ol className="grid gap-3 border-y border-line py-5 sm:grid-cols-5">
          {ORDER_TIMELINE.map((status, index) => {
            const done = reachedIndex >= index && order.paymentStatus === "paid";
            return (
              <li key={status} className="text-sm">
                <span className={`block h-0.5 w-full ${done ? "bg-clay" : "bg-line"}`} aria-hidden />
                <span className={`mt-2 block text-xs ${done ? "text-ink" : "text-ink-soft"}`} aria-current={done ? "step" : undefined}>
                  {ORDER_STATUS_LABELS[status]}
                </span>
              </li>
            );
          })}
        </ol>
      )}

      {order.trackingNumber ? (
        <div className="border border-line p-4 text-sm">
          <p className="eyebrow">Tracking</p>
          <p className="mt-1">
            {order.carrier ? `${order.carrier} · ` : ""}
            <span className="font-mono">{order.trackingNumber}</span>
          </p>
        </div>
      ) : null}

      <div className="grid gap-10 md:grid-cols-[1.5fr_1fr]">
        <section aria-labelledby="items-heading">
          <h3 id="items-heading" className="text-lg">
            Items
          </h3>
          <ul className="mt-4 divide-y divide-line border-y border-line">
            {order.items.map((item) => (
              <li key={item.id} className="flex items-start justify-between gap-4 py-3 text-sm">
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

          <dl className="mt-4 space-y-1.5 text-sm">
            <div className="flex justify-between">
              <dt className="text-ink-soft">Subtotal</dt>
              <dd>{formatMoney(order.subtotal)}</dd>
            </div>
            {order.discount > 0 ? (
              <div className="flex justify-between text-sage">
                <dt>Discount {order.couponCode ? `(${order.couponCode})` : ""}</dt>
                <dd>− {formatMoney(order.discount)}</dd>
              </div>
            ) : null}
            <div className="flex justify-between">
              <dt className="text-ink-soft">Shipping</dt>
              <dd>{order.shippingFee === 0 ? "Free" : formatMoney(order.shippingFee)}</dd>
            </div>
            <div className="flex justify-between border-t border-line pt-2 text-base">
              <dt>Total</dt>
              <dd>{formatMoney(order.total)}</dd>
            </div>
          </dl>
        </section>

        <aside className="space-y-6">
          {order.address ? (
            <div>
              <h3 className="eyebrow">Delivering to</h3>
              <p className="mt-2 text-sm">
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
              </p>
              <p className="mt-1 text-xs text-ink-soft">{order.address.phone}</p>
            </div>
          ) : null}

          {order.notes ? (
            <div>
              <h3 className="eyebrow">Gift note</h3>
              <p className="mt-2 text-sm text-ink-soft">{order.notes}</p>
            </div>
          ) : null}

          <OrderActions
            orderNumber={order.number}
            canCancel={order.canCancel}
            canRetryPayment={order.canRetryPayment}
            email={user.email}
          />

          <div className="text-xs text-ink-soft">
            Need help with this order?{" "}
            <Link href="/contact" className="underline underline-offset-4">
              Contact us
            </Link>
          </div>
        </aside>
      </div>
    </div>
  );
}
