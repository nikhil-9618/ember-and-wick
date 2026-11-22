import type { Metadata } from "next";
import Link from "next/link";
import { POLICIES } from "@/lib/brand";

export const metadata: Metadata = {
  title: "FAQs",
  description: "Answers about candle care, shipping, returns and payments at Ember & Wick.",
  alternates: { canonical: "/faq" },
};

const FAQS = [
  {
    q: "How do I get the best burn from a wooden wick?",
    a: "Trim the wick to 3-4 mm before every burn and pinch off the charred tip. Light it and let the flame establish for 20-30 seconds. Burn for 2-3 hours at a time so the melt pool reaches the edge of the vessel — this prevents tunnelling.",
  },
  {
    q: "Why does my candle smell stronger on the second burn?",
    a: "Our candles cure for seven days, but the first burn mostly evaporates the top layer of oil. From the second burn onward the scent throw settles and becomes more consistent.",
  },
  {
    q: "Is the wax really 100% natural?",
    a: "Our Signature line is a blend of Indian beeswax and natural soy wax. The Pure Beeswax line is 100% beeswax. We never use paraffin, palm wax or synthetic fragrance oils.",
  },
  {
    q: "When will my order ship?",
    a: `Orders are dispatched from Bengaluru in ${POLICIES.dispatchDays}. Delivery usually takes 3-6 business days depending on your PIN code. You will receive a tracking number by notification once it ships.`,
  },
  {
    q: "Can I return a candle?",
    a: "Unlit candles in their original packaging can be returned within 7 days of delivery. Because of hygiene and safety rules we can't accept candles that have been burned. Damaged-on-arrival orders are replaced free — send us a photo within 48 hours.",
  },
  {
    q: "What payment methods do you accept?",
    a: "UPI, all major credit and debit cards, netbanking and wallets through Razorpay. We never store your card details; payment is completed on Razorpay's secure page.",
  },
  {
    q: "Do you offer gift wrapping?",
    a: "Every order ships in recycled kraft with a hand-stamped card. Add a gift note at checkout and we'll write it for you at no charge.",
  },
  {
    q: "My tracking hasn't updated. What should I do?",
    a: "Courier scans can lag by 24 hours, especially on Sundays. If there is no movement for 3 business days, write to us with your order number and we'll chase it with the courier.",
  },
];

export default function FaqPage() {
  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "FAQPage",
    mainEntity: FAQS.map((item) => ({
      "@type": "Question",
      name: item.q,
      acceptedAnswer: { "@type": "Answer", text: item.a },
    })),
  };

  return (
    <div className="shell max-w-3xl py-12 md:py-16">
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }} />
      <p className="eyebrow">Help</p>
      <h1 className="mt-3 text-4xl">Frequently asked</h1>
      <p className="mt-4 text-ink-soft">
        Everything about burning, shipping and returns. Still stuck?{" "}
        <Link href="/contact" className="text-clay underline underline-offset-4">
          Write to the studio
        </Link>
        .
      </p>

      <div className="mt-10 divide-y divide-line border-y border-line">
        {FAQS.map((item) => (
          <details key={item.q} className="group py-4">
            <summary className="flex cursor-pointer items-start justify-between gap-4 text-[0.9375rem]">
              <span>{item.q}</span>
              <span aria-hidden className="text-ink-soft group-open:rotate-45">
                +
              </span>
            </summary>
            <p className="mt-3 max-w-2xl text-sm leading-relaxed text-ink-soft">{item.a}</p>
          </details>
        ))}
      </div>
    </div>
  );
}
