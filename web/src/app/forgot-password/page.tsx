import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { ForgotPasswordForm } from "@/components/auth/forgot-password-form";
import { getCurrentUser } from "@/lib/auth";

export const metadata: Metadata = { title: "Reset your password", robots: { index: false, follow: false } };

export default async function ForgotPasswordPage() {
  const user = await getCurrentUser().catch(() => null);
  if (user) redirect("/account");

  return (
    <div className="shell flex min-h-[60vh] items-center justify-center py-16">
      <div className="w-full max-w-sm">
        <p className="eyebrow">Account recovery</p>
        <h1 className="mt-3 text-3xl">Forgot your password?</h1>
        <p className="mt-2 text-sm text-ink-soft">
          Enter the email on your account and we&apos;ll send a one-time code to that address. You never need to
          share your password with anyone.
        </p>
        <div className="mt-8">
          <ForgotPasswordForm />
        </div>
      </div>
    </div>
  );
}
