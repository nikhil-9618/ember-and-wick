import type { Metadata } from "next";
import { BRAND } from "@/lib/brand";

export const metadata: Metadata = {
  title: "Terms of service",
  description: "The terms that apply when you order from Ember & Wick.",
  alternates: { canonical: "/terms" },
};

export default function TermsPage() {
  return (
    <article className="shell max-w-3xl py-12 md:py-16">
      <p className="eyebrow">Legal</p>
      <h1 className="mt-3 text-4xl">Terms of service</h1>
      <p className="mt-2 text-xs text-ink-soft">Last updated 22 November 2026</p>

      <div className="mt-10 space-y-6 text-sm leading-relaxed text-ink-soft">
        <h2 className="text-xl text-ink">1. Who we are</h2>
        <p>
          This store is operated by {BRAND.legalName}, {BRAND.address}. By placing an order you agree to these
          terms.
        </p>

        <h2 className="pt-4 text-xl text-ink">2. Products and descriptions</h2>
        <p>
          All candles are hand-poured, so colour, surface texture and scent strength vary slightly between
          batches. Product photographs are representative. Burn times are estimates based on our testing and
          depend on wick trimming, draughts and burn duration.
        </p>

        <h2 className="pt-4 text-xl text-ink">3. Pricing and payment</h2>
        <p>
          Prices are in Indian Rupees and include 18% GST. Shipping is free on orders above ₹1,499 and ₹79
          otherwise. The price you pay is the price shown at checkout, calculated on our server at the moment
          the order is created. Payment is collected by Razorpay; the order is confirmed only once the payment
          signature is verified by us.
        </p>

        <h2 className="pt-4 text-xl text-ink">4. Orders and acceptance</h2>
        <p>
          Your order is an offer to buy. We accept it when payment is confirmed. If an item sells out between
          your checkout and payment, the transaction is rolled back and you are not charged. We may refuse an
          order where we suspect fraud or where a pricing error is obvious.
        </p>

        <h2 className="pt-4 text-xl text-ink">5. Delivery</h2>
        <p>
          We dispatch in 1-2 business days and delivery typically takes 3-6 business days. Risk passes to you
          on delivery. If a parcel arrives damaged, tell us within 48 hours with photographs and we will replace
          it.
        </p>

        <h2 className="pt-4 text-xl text-ink">6. Returns and refunds</h2>
        <p>
          Unlit candles may be returned within 7 days of delivery in their original packaging. Refunds are made
          to the original payment method within 5-7 business days of us receiving the return. See the{" "}
          <a href="/refund-policy" className="text-clay underline underline-offset-4">
            refund policy
          </a>{" "}
          for details.
        </p>

        <h2 className="pt-4 text-xl text-ink">7. Safe use</h2>
        <p>
          Never leave a burning candle unattended, keep it away from children, pets and draughts, and burn only
          on a heat-safe surface. Do not burn a candle for more than four hours at a time or when less than
          10 mm of wax remains.
        </p>

        <h2 className="pt-4 text-xl text-ink">8. Accounts</h2>
        <p>
          You are responsible for keeping your password confidential. Do not share your account. We may suspend
          an account used for abuse, fraudulent chargebacks or automated scraping.
        </p>

        <h2 className="pt-4 text-xl text-ink">9. Liability</h2>
        <p>
          Our liability for any order is limited to the amount you paid for it. Nothing in these terms limits
          liability that cannot be limited under Indian law, including for death or personal injury caused by
          negligence.
        </p>

        <h2 className="pt-4 text-xl text-ink">10. Governing law</h2>
        <p>
          These terms are governed by the laws of India. Disputes are subject to the exclusive jurisdiction of
          the courts at Bengaluru, Karnataka.
        </p>

        <h2 className="pt-4 text-xl text-ink">11. Contact</h2>
        <p>
          Questions about these terms: {BRAND.supportEmail}.
        </p>
      </div>
    </article>
  );
}
