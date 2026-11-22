import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth";
import { ProfileForm, PasswordForm } from "@/components/account/profile-form";
import { NotificationList } from "@/components/account/notification-list";
import { listNotifications } from "@/lib/services/notify";
import { SignOutButton } from "@/components/account/sign-out-button";

export const metadata: Metadata = { title: "Profile", robots: { index: false, follow: false } };

export default async function AccountPage() {
  const user = await getCurrentUser();
  if (!user) redirect("/login?next=/account");

  const notifications = await listNotifications(user.id);

  return (
    <div className="grid gap-12 lg:grid-cols-[1.3fr_1fr]">
      <div className="space-y-12">
        <section aria-labelledby="profile-heading">
          <h2 id="profile-heading" className="text-xl">
            Profile
          </h2>
          <p className="mt-1 mb-5 text-sm text-ink-soft">
            Member since {new Date(user.created_at).toLocaleDateString("en-IN", { dateStyle: "medium" })}.
          </p>
          <ProfileForm name={user.name} phone={user.phone} />
        </section>

        <section aria-labelledby="security-heading" className="border-t border-line pt-8">
          <h2 id="security-heading" className="text-xl">
            Password
          </h2>
          <div className="mt-5">
            <PasswordForm />
          </div>
        </section>

        <section className="border-t border-line pt-8">
          <h2 className="text-xl">Session</h2>
          <p className="mt-1 mb-4 text-sm text-ink-soft">
            Signed in as {user.email}. Signing out ends this session on this device.
          </p>
          <SignOutButton />
        </section>
      </div>

      <aside className="space-y-8">
        <section aria-labelledby="notifications-heading">
          <div className="flex items-baseline justify-between">
            <h2 id="notifications-heading" className="text-xl">
              Updates
            </h2>
            <Link href="/account/orders" className="text-xs text-clay hover:underline">
              All orders
            </Link>
          </div>
          <NotificationList initial={notifications} />
        </section>
      </aside>
    </div>
  );
}
