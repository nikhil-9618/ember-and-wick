import Link from "next/link";
import { getCurrentUser } from "@/lib/auth";
import { getCart } from "@/lib/services/cart";
import { BRAND } from "@/lib/brand";

const NAV = [
  { href: "/shop", label: "Shop all" },
  { href: "/shop?category=pure-beeswax", label: "Beeswax" },
  { href: "/shop?category=gifting", label: "Gifting" },
  { href: "/about", label: "Our story" },
  { href: "/faq", label: "FAQs" },
];

async function headerState() {
  try {
    const user = await getCurrentUser();
    if (!user) return { user: null, itemCount: 0 };
    const cart = await getCart(user.id);
    return { user, itemCount: cart.itemCount };
  } catch {
    // Database not reachable (e.g. during build): render a signed-out header.
    return { user: null, itemCount: 0 };
  }
}

export async function SiteHeader() {
  const { user, itemCount } = await headerState();

  return (
    <header className="sticky top-0 z-40 border-b border-line/70 bg-ivory/90 backdrop-blur">
      <div className="shell flex h-16 items-center justify-between gap-6">
        <Link href="/" className="font-display text-xl tracking-tight text-ink">
          {BRAND.name}
          <span className="ml-1 text-clay">.</span>
        </Link>

        <nav aria-label="Primary" className="hidden items-center gap-7 md:flex">
          {NAV.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              className="nav-link text-[0.8125rem] text-ink-soft transition-colors hover:text-ink"
            >
              {item.label}
            </Link>
          ))}
        </nav>

        <div className="flex items-center gap-5">
          <Link
            href="/shop"
            className="hidden text-[0.8125rem] text-ink-soft transition-colors hover:text-ink sm:block"
            aria-label="Search candles"
          >
            Search
          </Link>
          <Link
            href={user ? "/account" : "/login"}
            className="text-[0.8125rem] text-ink-soft transition-colors hover:text-ink"
          >
            {user ? user.name.split(" ")[0] : "Sign in"}
          </Link>
          <Link href="/cart" className="relative text-[0.8125rem] text-ink-soft hover:text-ink">
            Cart
            {itemCount > 0 ? (
              <span className="absolute -right-3 -top-2 flex h-4 min-w-4 items-center justify-center rounded-full bg-clay px-1 text-[0.625rem] font-medium text-ivory">
                {itemCount}
              </span>
            ) : null}
            <span className="sr-only">{itemCount} items in cart</span>
          </Link>
        </div>
      </div>

      <details className="border-t border-line/70 md:hidden">
        <summary className="shell cursor-pointer list-none py-2 text-[0.75rem] uppercase tracking-[0.14em] text-ink-soft">
          Browse
        </summary>
        <nav aria-label="Primary mobile" className="shell flex flex-col gap-3 pb-4">
          {NAV.map((item) => (
            <Link key={item.href} href={item.href} className="text-sm text-ink-soft">
              {item.label}
            </Link>
          ))}
        </nav>
      </details>
    </header>
  );
}
