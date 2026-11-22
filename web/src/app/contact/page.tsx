import type { Metadata } from "next";
import { BRAND, POLICIES } from "@/lib/brand";
import { ContactForm } from "@/components/site/contact-form";

export const metadata: Metadata = {
  title: "Contact us",
  description: "Questions about an order, a candle or a bulk enquiry? Write to the Ember & Wick studio.",
  alternates: { canonical: "/contact" },
};

export default function ContactPage() {
  return (
    <div className="shell grid gap-12 py-12 md:grid-cols-2 md:py-16">
      <div>
        <p className="eyebrow">Say hello</p>
        <h1 className="mt-3 text-4xl">Contact the studio</h1>
        <p className="mt-4 text-ink-soft">
          We answer every message ourselves, usually within one business day. For order issues, include your
          order number so we can look it up quickly.
        </p>

        <dl className="mt-8 space-y-5 text-sm">
          <div>
            <dt className="eyebrow">Email</dt>
            <dd className="mt-1">
              <a href={`mailto:${BRAND.supportEmail}`} className="text-clay hover:underline">
                {BRAND.supportEmail}
              </a>
            </dd>
          </div>
          <div>
            <dt className="eyebrow">Phone</dt>
            <dd className="mt-1 text-ink-soft">{BRAND.supportPhone} · Mon-Sat, 10am-6pm IST</dd>
          </div>
          <div>
            <dt className="eyebrow">Studio</dt>
            <dd className="mt-1 text-ink-soft">{BRAND.address}</dd>
          </div>
          <div>
            <dt className="eyebrow">Dispatch</dt>
            <dd className="mt-1 text-ink-soft">
              {POLICIES.dispatchDays} · {POLICIES.deliveryEstimate}
            </dd>
          </div>
        </dl>
      </div>

      <div>
        <ContactForm />
      </div>
    </div>
  );
}
