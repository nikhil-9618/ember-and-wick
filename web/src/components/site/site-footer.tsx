import Link from "next/link";
import { BRAND, POLICIES } from "@/lib/brand";
import { Icon, type IconName } from "@/components/ui/icons";

const SHOP_LINKS: { href: string; label: string }[] = [
  { href: "/shop", label: "All candles" },
  { href: "/shop?category=signature", label: "Signature blends" },
  { href: "/shop?category=pure-beeswax", label: "Pure beeswax" },
  { href: "/shop?category=gifting", label: "Gifting" },
];

const HELP_LINKS: { href: string; label: string; icon: IconName }[] = [
  { href: "/faq", label: "FAQs", icon: "message" },
  { href: "/contact", label: "Contact us", icon: "mail" },
  { href: "/refund-policy", label: "Returns & refunds", icon: "refresh" },
  { href: "/account/orders", label: "Track an order", icon: "truck" },
];

const LEGAL_LINKS: { href: string; label: string; icon: IconName }[] = [
  { href: "/privacy", label: "Privacy policy", icon: "shield" },
  { href: "/terms", label: "Terms of service", icon: "clipboard" },
  { href: "/refund-policy", label: "Refund policy", icon: "refresh" },
];

export function SiteFooter() {
  return (
    <footer className="mt-24 border-t border-line bg-sand/40">
      <div className="shell grid gap-10 py-14 md:grid-cols-4">
        <div>
          <p className="font-display text-lg">
            {BRAND.name}
            <span className="text-clay">.</span>
          </p>
          <p className="mt-3 max-w-xs text-sm text-ink-soft">{BRAND.description}</p>
          <p className="mt-4 text-xs text-ink-soft">
            Hand-poured in {BRAND.shippingOrigin}. Dispatch in {POLICIES.dispatchDays}.
          </p>
        </div>

        <nav aria-label="Shop">
          <h2 className="eyebrow">Shop</h2>
          <ul className="mt-4 space-y-2 text-sm text-ink-soft">
            {SHOP_LINKS.map((link) => (
              <li key={link.href}>
                <Link href={link.href} className="hover:text-ink">
                  {link.label}
                </Link>
              </li>
            ))}
          </ul>
        </nav>

        <nav aria-label="Help">
          <h2 className="eyebrow">Help</h2>
          <ul className="mt-4 space-y-2 text-sm text-ink-soft">
            {HELP_LINKS.map((link) => (
              <li key={link.href}>
                <Link href={link.href} className="flex items-center gap-2 hover:text-ink">
                  <Icon name={link.icon} size={14} />
                  {link.label}
                </Link>
              </li>
            ))}
          </ul>
        </nav>

        <div>
          <h2 className="eyebrow">Get in touch</h2>
          <ul className="mt-4 space-y-2 text-sm text-ink-soft">
            <li>
              <a href={`mailto:${BRAND.supportEmail}`} className="flex items-center gap-2 hover:text-ink">
                <Icon name="mail" size={14} />
                {BRAND.supportEmail}
              </a>
            </li>
            <li className="flex items-center gap-2">
              <Icon name="phone" size={14} />
              {BRAND.supportPhone}
            </li>
            <li className="flex items-start gap-2 pt-1 text-xs leading-relaxed">
              <Icon name="map-pin" size={14} className="mt-0.5 shrink-0" />
              {BRAND.address}
            </li>
          </ul>
        </div>
      </div>

      <div className="border-t border-line">
        <div className="shell flex flex-col gap-3 py-6 text-xs text-ink-soft sm:flex-row sm:items-center sm:justify-between">
          <p>
            © {new Date().getFullYear()} {BRAND.legalName}. All rights reserved.
          </p>
          <ul className="flex flex-wrap gap-4">
            {LEGAL_LINKS.map((link) => (
              <li key={link.href}>
                <Link href={link.href} className="flex items-center gap-1.5 hover:text-ink">
                  <Icon name={link.icon} size={13} />
                  {link.label}
                </Link>
              </li>
            ))}
          </ul>
        </div>
      </div>
    </footer>
  );
}
