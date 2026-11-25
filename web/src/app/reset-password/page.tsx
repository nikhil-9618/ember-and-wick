import type { Metadata } from "next";
import Link from "next/link";
import { ResetPasswordForm } from "@/components/auth/reset-password-form";

export const metadata: Metadata = { title: "Choose a new password", robots: { index: false, follow: false } };

export default async function ResetPasswordPage({
  searchParams,
}: {
  searchParams: Promise<{ challenge?: string; email?: string }>;
}) {
  const { challenge, email } = await searchParams;

  return (
    <div className="shell flex min-h-[60vh] items-center justify-center py-16">
      <div className="w-full max-w-sm">
        <p className="eyebrow">Account recovery</p>
        <h1 className="mt-3 text-3xl">Choose a new password</h1>
        {challenge ? (
          <div className="mt-8">
            <ResetPasswordForm challengeId={challenge} email={email ?? ""} />
          </div>
        ) : (
          <div className="mt-8 border border-line bg-sand/40 p-6 text-sm text-ink-soft">
            <p>This reset link is incomplete. Start again to receive a fresh code.</p>
            <Link href="/forgot-password" className="mt-4 inline-block bg-ink px-5 py-2.5 text-sm text-ivory">
              Request a reset code
            </Link>
          </div>
        )}
      </div>
    </div>
  );
}
