import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth";
import { listAddresses } from "@/lib/services/addresses";
import { AddressManager } from "@/components/account/address-manager";

export const metadata: Metadata = { title: "Addresses", robots: { index: false, follow: false } };

export default async function AddressesPage() {
  const user = await getCurrentUser();
  if (!user) redirect("/login?next=/account/addresses");
  const addresses = await listAddresses(user.id);

  return (
    <section aria-labelledby="addresses-heading">
      <h2 id="addresses-heading" className="text-xl">
        Delivery addresses
      </h2>
      <p className="mt-1 mb-6 text-sm text-ink-soft">
        Saved addresses are used at checkout. You can also enter a new address there without saving it.
      </p>
      <AddressManager initial={addresses} />
    </section>
  );
}
