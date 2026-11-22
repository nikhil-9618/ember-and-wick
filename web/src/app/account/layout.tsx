import Link from "next/link";
import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth";

const LINKS = [
  { href: "/account", label: "Profile" },
  { href: "/account/orders", label: "Orders" },
  { href: "/account/addresses", label: "Addresses" },
  { href: "/account/wishlist", label: "Wishlist" },
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
              <Link href={link.href} className="text-ink-soft hover:text-ink">
                {link.label}
              </Link>
            </li>
          ))}
          {user.role === "admin" ? (
            <li>
              <Link href="/admin" className="text-clay hover:underline">
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
