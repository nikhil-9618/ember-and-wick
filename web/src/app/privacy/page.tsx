import type { Metadata } from "next";
import { BRAND } from "@/lib/brand";

export const metadata: Metadata = {
  title: "Privacy policy",
  description: "How Ember & Wick collects, uses and protects your personal data.",
  alternates: { canonical: "/privacy" },
};

export default function PrivacyPage() {
  return (
    <article className="shell max-w-3xl py-12 md:py-16">
      <p className="eyebrow">Legal</p>
      <h1 className="mt-3 text-4xl">Privacy policy</h1>
      <p className="mt-2 text-xs text-ink-soft">Last updated 22 November 2026</p>

      <div className="mt-10 space-y-6 text-sm leading-relaxed text-ink-soft">
        <h2 className="text-xl text-ink">What we collect</h2>
        <p>
          Account details (name, email, phone), delivery addresses, order history, wishlist items and the
          technical information required to keep you signed in (a session cookie). If you contact us, we keep
          your message so we can reply.
        </p>
        <p>
          We do not collect or store card numbers, UPI IDs, CVVs or bank credentials. Payments are processed by
          Razorpay, which receives the payment details you enter on its own secure page.
        </p>

        <h2 className="pt-4 text-xl text-ink">How we use it</h2>
        <p>
          To create and secure your account, process and deliver orders, send order and shipping updates,
          handle returns and refunds, and meet tax and accounting obligations. We do not sell personal data, and
          we do not run third-party advertising pixels on this site.
        </p>

        <h2 className="pt-4 text-xl text-ink">Who we share it with</h2>
        <p>
          Only the processors needed to fulfil your order: our payment gateway (Razorpay), our courier partners
          (name, address and phone for delivery), and our hosting and database providers. Each is bound to use
          the data only for that purpose.
        </p>

        <h2 className="pt-4 text-xl text-ink">Cookies</h2>
        <p>
          We set one essential cookie, <code>ew_session</code>, which keeps you signed in. It is HttpOnly,
          SameSite=Lax and expires after 30 days. We do not use advertising or cross-site tracking cookies. The
          mobile app stores the same session token in the device&apos;s secure keychain instead.
        </p>

        <h2 className="pt-4 text-xl text-ink">How long we keep it</h2>
        <p>
          Order records are retained for eight years as required by Indian tax law. Account details are kept
          while your account is active. Session records are deleted when they expire or when you change your
          password.
        </p>

        <h2 className="pt-4 text-xl text-ink">Your rights</h2>
        <p>
          You can access and correct your profile and addresses in your account at any time. To request a copy
          of your data, a deletion of your account, or to object to processing, write to{" "}
          <a href={`mailto:${BRAND.supportEmail}`} className="text-clay underline underline-offset-4">
            {BRAND.supportEmail}
          </a>
          . We respond within 30 days. Deletion requests are honoured except where records must be kept for tax
          purposes.
        </p>

        <h2 className="pt-4 text-xl text-ink">Security</h2>
        <p>
          Passwords are stored as PBKDF2-SHA256 hashes and are never logged. Traffic is served over HTTPS.
          Sessions are revocable, and changing your password signs out every other device. Access to customer
          data is limited to studio staff who need it to fulfil orders.
        </p>

        <h2 className="pt-4 text-xl text-ink">Contact</h2>
        <p>
          Data controller: {BRAND.legalName}, {BRAND.address}. Email {BRAND.supportEmail}.
        </p>
      </div>
    </article>
  );
}
