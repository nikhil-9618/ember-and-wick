import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth";
import { getCart } from "@/lib/services/cart";
import { CartQuantityControls } from "@/components/cart/cart-quantity-controls";
import { formatMoney, FREE_SHIPPING_THRESHOLD } from "@/lib/money";

export const metadata: Metadata = { title: "Your cart", robots: { index: false, follow: false } };

export default async function CartPage() {
  const user = await getCurrentUser();
  if (!user) redirect("/login?next=/cart");

  const cart = await getCart(user.id);
  const remainingForFreeShipping = Math.max(0, FREE_SHIPPING_THRESHOLD - cart.subtotal);

  return (
    <div className="shell py-10 md:py-14">
      <h1 className="text-3xl md:text-4xl">Your cart</h1>
      <p className="mt-2 text-sm text-ink-soft">
        {cart.itemCount} item{cart.itemCount === 1 ? "" : "s"}
      </p>

      {cart.items.length === 0 ? (
        <div className="mt-10 border border-line bg-sand/40 p-10 text-center">
          <p className="text-lg">Your cart is empty.</p>
          <p className="mt-2 text-sm text-ink-soft">Find a candle that suits the room you&apos;re in.</p>
          <Link href="/shop" className="mt-6 inline-block bg-ink px-6 py-3 text-sm text-ivory hover:bg-clay-dark">
            Shop candles
          </Link>
        </div>
      ) : (
        <div className="mt-10 grid gap-12 lg:grid-cols-[1.6fr_1fr]">
          <ul className="divide-y divide-line border-y border-line">
            {cart.items.map((item) => (
              <li key={item.id} className="flex gap-4 py-5">
                <Link href={`/products/${item.productSlug}`} className="relative h-24 w-24 shrink-0 overflow-hidden bg-sand">
                  {item.imageUrl ? (
                    <Image src={item.imageUrl} alt={item.imageAlt ?? item.productName} fill sizes="96px" className="object-cover" />
                  ) : null}
                </Link>
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-start justify-between gap-2">
                    <div>
                      <Link href={`/products/${item.productSlug}`} className="text-base hover:text-clay">
                        {item.productName}
                      </Link>
                      <p className="text-xs text-ink-soft">{item.variantName}</p>
                      {item.stock <= 5 ? (
                        <p className="mt-1 text-xs text-clay-dark">Only {item.stock} left</p>
                      ) : null}
                    </div>
                    <p className="text-sm">{formatMoney(item.lineTotal)}</p>
                  </div>
                  <div className="mt-3 flex items-center justify-between">
                    <CartQuantityControls variantId={item.variantId} quantity={item.quantity} max={Math.min(10, item.stock)} />
                    <p className="text-xs text-ink-soft">{formatMoney(item.unitPrice)} each</p>
                  </div>
                </div>
              </li>
            ))}
          </ul>

          <aside aria-label="Order summary" className="h-fit border border-line bg-sand/30 p-6">
            <h2 className="text-lg">Summary</h2>
            <dl className="mt-4 space-y-2 text-sm">
              <div className="flex justify-between">
                <dt className="text-ink-soft">Subtotal</dt>
                <dd>{formatMoney(cart.subtotal)}</dd>
              </div>
              <div className="flex justify-between">
                <dt className="text-ink-soft">Shipping</dt>
                <dd>{cart.totals.shippingFee === 0 ? "Free" : formatMoney(cart.totals.shippingFee)}</dd>
              </div>
              <div className="flex justify-between border-t border-line pt-2 text-base">
                <dt>Total</dt>
                <dd>{formatMoney(cart.totals.total)}</dd>
              </div>
              <p className="text-xs text-ink-soft">Includes {formatMoney(cart.totals.tax)} GST</p>
            </dl>

            {remainingForFreeShipping > 0 ? (
              <p className="mt-4 bg-ivory px-3 py-2 text-xs text-ink-soft">
                Add {formatMoney(remainingForFreeShipping)} for free shipping.
              </p>
            ) : null}

            <Link
              href="/checkout"
              className="mt-6 block bg-ink px-6 py-3.5 text-center text-sm font-medium text-ivory hover:bg-clay-dark"
            >
              Continue to checkout
            </Link>
            <Link href="/shop" className="mt-3 block text-center text-xs text-ink-soft hover:text-ink">
              or keep shopping
            </Link>
          </aside>
        </div>
      )}
    </div>
  );
}
