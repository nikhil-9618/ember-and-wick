import Link from "next/link";
import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth";
import { SignOutButton } from "@/components/account/sign-out-button";

const LINKS = [
  { href: "/admin", label: "Dashboard" },
  { href: "/admin/products", label: "Products" },
  { href: "/admin/orders", label: "Orders" },
  { href: "/admin/customers", label: "Customers" },
  { href: "/admin/coupons", label: "Coupons" },
  { href: "/admin/refunds", label: "Refunds" },
  { href: "/admin/reviews", label: "Reviews" },
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
          <Link href="/" className="text-ink-soft hover:text-ink">
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
                <Link href={link.href} className="text-ink-soft hover:text-ink">
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
