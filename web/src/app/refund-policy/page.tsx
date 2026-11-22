import type { Metadata } from "next";
import Link from "next/link";
import { BRAND, POLICIES } from "@/lib/brand";

export const metadata: Metadata = {
  title: "Returns & refunds",
  description: "How returns, replacements and refunds work at Ember & Wick.",
  alternates: { canonical: "/refund-policy" },
};

export default function RefundPolicyPage() {
  return (
    <article className="shell max-w-3xl py-12 md:py-16">
      <p className="eyebrow">Legal</p>
      <h1 className="mt-3 text-4xl">Returns &amp; refunds</h1>
      <p className="mt-2 text-xs text-ink-soft">Last updated 22 November 2026</p>

      <div className="mt-10 space-y-6 text-sm leading-relaxed text-ink-soft">
        <div className="border border-line bg-sand/30 p-5">
          <p className="text-ink">
            In short: unlit candles can be returned within {POLICIES.returnWindowDays} days. Damaged orders are
            replaced free. Refunds reach your original payment method in 5-7 business days after we receive the
            return.
          </p>
        </div>

        <h2 className="text-xl text-ink">What can be returned</h2>
        <ul className="list-disc space-y-1 pl-5">
          <li>Candles that have not been lit, in their original box and vessel.</li>
          <li>Requests made within {POLICIES.returnWindowDays} days of delivery.</li>
          <li>Gift orders, provided the order number can be confirmed.</li>
        </ul>

        <h2 className="pt-4 text-xl text-ink">What cannot</h2>
        <ul className="list-disc space-y-1 pl-5">
          <li>Candles that have been burned, even partially, for safety and hygiene reasons.</li>
          <li>Wicks that have been trimmed or damaged by the customer.</li>
          <li>Items marked final sale or included in a clearance batch.</li>
        </ul>

        <h2 className="pt-4 text-xl text-ink">Damaged or incorrect orders</h2>
        <p>
          If a candle arrives cracked, melted or is not what you ordered, email{" "}
          <a href={`mailto:${BRAND.supportEmail}`} className="text-clay underline underline-offset-4">
            {BRAND.supportEmail}
          </a>{" "}
          within 48 hours with your order number and a photograph. We will ship a replacement at our cost, or
          refund you in full if the item is out of stock. You do not need to return a damaged candle.
        </p>

        <h2 className="pt-4 text-xl text-ink">How to start a return</h2>
        <ol className="list-decimal space-y-1 pl-5">
          <li>
            Go to{" "}
            <Link href="/account/orders" className="text-clay underline underline-offset-4">
              your orders
            </Link>{" "}
            and note the order number, then email us with the reason.
          </li>
          <li>We confirm eligibility within one business day and share a pickup address or courier label.</li>
          <li>Pack the candle in its original box and hand it to the courier.</li>
          <li>Once received and inspected, we process the refund.</li>
        </ol>

        <h2 className="pt-4 text-xl text-ink">Refund timelines</h2>
        <p>
          Refunds are issued to the original payment method through Razorpay. UPI and card refunds typically
          appear in 5-7 business days; netbanking can take up to 10. Shipping charges are refunded only when the
          return is due to our error.
        </p>

        <h2 className="pt-4 text-xl text-ink">Cancellations</h2>
        <p>
          Unpaid orders can be cancelled from your order page at any time, which releases the reserved stock
          immediately. Once an order is paid it enters packing quickly; write to us and we will help if it has
          not yet shipped. Paid orders that are cancelled before dispatch are refunded in full.
        </p>

        <h2 className="pt-4 text-xl text-ink">Failed payments</h2>
        <p>
          If a payment fails, no money is taken and the order is marked as failed. Your items stay reserved so
          you can retry from the order page. If your bank shows a temporary hold, it is released by the bank
          automatically, usually within 24 hours.
        </p>

        <h2 className="pt-4 text-xl text-ink">Contact</h2>
        <p>
          {BRAND.supportEmail} · {BRAND.supportPhone}. {BRAND.address}.
        </p>
      </div>
    </article>
  );
}
