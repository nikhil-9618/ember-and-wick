import type { Metadata } from "next";
import { redirect } from "next/navigation";
import Link from "next/link";
import { getCurrentUser } from "@/lib/auth";
import { getCart } from "@/lib/services/cart";
import { listAddresses } from "@/lib/services/addresses";
import { CheckoutForm } from "@/components/checkout/checkout-form";
import { getPaymentConfig } from "@/lib/config";

export const metadata: Metadata = { title: "Checkout", robots: { index: false, follow: false } };

export default async function CheckoutPage() {
  const user = await getCurrentUser();
  if (!user) redirect("/login?next=/checkout");

  const cart = await getCart(user.id);
  if (cart.items.length === 0) {
    return (
      <div className="shell py-20 text-center">
        <h1 className="text-3xl">Your cart is empty</h1>
        <p className="mt-3 text-ink-soft">Add a candle before checking out.</p>
        <Link href="/shop" className="mt-6 inline-block bg-ink px-6 py-3 text-sm text-ivory">
          Shop candles
        </Link>
      </div>
    );
  }

  const [addresses, paymentConfig] = await Promise.all([listAddresses(user.id), getPaymentConfig()]);

  return (
    <div className="shell py-10 md:py-14">
      <div className="max-w-xl">
        <p className="eyebrow">Almost there</p>
        <h1 className="mt-3 text-3xl md:text-4xl">Checkout</h1>
        <p className="mt-2 text-sm text-ink-soft">
          Shipping and taxes are calculated on the server. You&apos;ll confirm payment securely with Razorpay.
        </p>
      </div>

      <div className="mt-10">
        <CheckoutForm
          addresses={addresses}
          initialTotals={cart.totals}
          itemCount={cart.itemCount}
          email={user.email}
          paymentMode={paymentConfig.mode}
        />
      </div>
    </div>
  );
}
