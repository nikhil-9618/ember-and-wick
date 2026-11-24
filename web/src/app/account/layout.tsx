import Link from "next/link";
import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth";
import { Icon, type IconName } from "@/components/ui/icons";

const LINKS: { href: string; label: string; icon: IconName }[] = [
  { href: "/account", label: "Profile", icon: "user" },
  { href: "/account/orders", label: "Orders", icon: "package" },
  { href: "/account/addresses", label: "Addresses", icon: "map-pin" },
  { href: "/account/wishlist", label: "Wishlist", icon: "heart" },
];

export const dynamic = "force-dynamic";

export default async function AccountLayout({ children }: { children: React.ReactNode }) {
  const user = await getCurrentUser();
  if (!user) redirect("/login?next=/account");

  return (
    <div className="shell py-10 md:py-14">
      <div className="flex flex-wrap items-baseline justify-between gap-3">
        <h1 className="text-3xl md:text-4xl">Your account</h1>
        <p className="text-sm text-ink-soft">{user.email}</p>
      </div>

      <nav aria-label="Account" className="mt-6 border-b border-line">
        <ul className="flex flex-wrap gap-6 pb-3 text-sm">
          {LINKS.map((link) => (
            <li key={link.href}>
              <Link href={link.href} className="flex items-center gap-1.5 text-ink-soft transition-colors hover:text-ink">
                <Icon name={link.icon} size={15} />
                {link.label}
              </Link>
            </li>
          ))}
          {user.role === "admin" ? (
            <li>
              <Link href="/admin" className="flex items-center gap-1.5 text-clay hover:underline">
                <Icon name="chart" size={15} />
                Admin dashboard
              </Link>
            </li>
          ) : null}
        </ul>
      </nav>

      <div className="mt-10">{children}</div>
    </div>
  );
}
