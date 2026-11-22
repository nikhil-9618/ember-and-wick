import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { AuthForm } from "@/components/auth/auth-form";
import { getCurrentUser } from "@/lib/auth";

export const metadata: Metadata = { title: "Sign in", robots: { index: false, follow: false } };

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ next?: string }>;
}) {
  const { next } = await searchParams;
  const user = await getCurrentUser().catch(() => null);
  if (user) redirect(next && next.startsWith("/") ? next : "/account");

  return (
    <div className="shell flex min-h-[60vh] items-center justify-center py-16">
      <div className="w-full max-w-sm">
        <p className="eyebrow">Welcome back</p>
        <h1 className="mt-3 text-3xl">Sign in</h1>
        <p className="mt-2 text-sm text-ink-soft">Your cart, wishlist and orders are waiting.</p>
        <div className="mt-8">
          <AuthForm mode="login" next={next && next.startsWith("/") ? next : "/account"} />
        </div>
      </div>
    </div>
  );
}
