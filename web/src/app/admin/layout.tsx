import Link from "next/link";
import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth";
import { SignOutButton } from "@/components/account/sign-out-button";
import { Icon, type IconName } from "@/components/ui/icons";

const LINKS: { href: string; label: string; icon: IconName }[] = [
  { href: "/admin", label: "Dashboard", icon: "chart" },
  { href: "/admin/products", label: "Products", icon: "package" },
  { href: "/admin/orders", label: "Orders", icon: "clipboard" },
  { href: "/admin/customers", label: "Customers", icon: "users" },
  { href: "/admin/coupons", label: "Coupons", icon: "ticket" },
  { href: "/admin/refunds", label: "Refunds", icon: "refresh" },
  { href: "/admin/reviews", label: "Reviews", icon: "message" },
  { href: "/admin/audit", label: "Audit log", icon: "shield" },
];

export const dynamic = "force-dynamic";

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const user = await getCurrentUser();
  if (!user) redirect("/login?next=/admin");
  if (user.role !== "admin") redirect("/account");

  return (
    <div className="shell py-8">
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-line pb-4">
        <div>
          <p className="eyebrow">Studio admin</p>
          <p className="text-lg">Ember &amp; Wick</p>
        </div>
        <div className="flex items-center gap-4 text-xs">
          <Link href="/" className="flex items-center gap-1.5 text-ink-soft hover:text-ink">
            <Icon name="bag" size={14} />
            View storefront
          </Link>
          <SignOutButton />
        </div>
      </div>

      <div className="mt-6 grid gap-8 lg:grid-cols-[13rem_1fr]">
        <nav aria-label="Admin" className="h-fit">
          <ul className="flex flex-wrap gap-x-5 gap-y-2 text-sm lg:flex-col lg:gap-y-3">
            {LINKS.map((link) => (
              <li key={link.href}>
                <Link href={link.href} className="flex items-center gap-2 text-ink-soft transition-colors hover:text-ink">
                  <Icon name={link.icon} size={15} />
                  {link.label}
                </Link>
              </li>
            ))}
          </ul>
        </nav>
        <div className="min-w-0">{children}</div>
      </div>
    </div>
  );
}
