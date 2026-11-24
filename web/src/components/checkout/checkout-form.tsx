"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { api, errorMessage } from "@/lib/client/api";
import { formatMoney } from "@/lib/money";

interface Address {
  id: string;
  label: string | null;
  fullName: string;
  phone: string;
  line1: string;
  line2: string | null;
  city: string;
  state: string;
  postalCode: string;
  country: string;
  isDefault: boolean;
}

interface Totals {
  subtotal: number;
  discount: number;
  shippingFee: number;
  tax: number;
  total: number;
}

interface OrderResponse {
  order: { id: string; number: string; total: number; status: string };
  payment: { provider: "razorpay" | "test"; keyId: string | null; providerOrderId: string; amount: number; currency: string };
}

interface Props {
  addresses: Address[];
  initialTotals: Totals;
  itemCount: number;
  email: string;
  paymentMode: "razorpay" | "test" | "unconfigured";
}

const EMPTY_ADDRESS = {
  label: "",
  fullName: "",
  phone: "",
  line1: "",
  line2: "",
  city: "",
  state: "",
  postalCode: "",
  country: "IN",
};

type AddressDraft = typeof EMPTY_ADDRESS;

function loadRazorpayScript(): Promise<boolean> {
  return new Promise((resolve) => {
    if (window.Razorpay) return resolve(true);
    const script = document.createElement("script");
    script.src = "https://checkout.razorpay.com/v1/checkout.js";
    script.async = true;
    script.onload = () => resolve(true);
    script.onerror = () => resolve(false);
    document.body.appendChild(script);
  });
}

export function CheckoutForm({ addresses, initialTotals, itemCount, email, paymentMode }: Props) {
  const router = useRouter();
  const idempotencyKey = useMemo(() => crypto.randomUUID(), []);
  const defaultAddress = addresses.find((address) => address.isDefault) ?? addresses[0];

  const [mode, setMode] = useState<"saved" | "new">(defaultAddress ? "saved" : "new");
  const [addressId, setAddressId] = useState(defaultAddress?.id ?? "");
  const [draft, setDraft] = useState<AddressDraft>({ ...EMPTY_ADDRESS, fullName: "", country: "IN" });
  const [couponCode, setCouponCode] = useState("");
  const [appliedCoupon, setAppliedCoupon] = useState<string | null>(null);
  const [totals, setTotals] = useState<Totals>(initialTotals);
  const [notes, setNotes] = useState("");
  const [busy, setBusy] = useState(false);
  const [couponBusy, setCouponBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pendingOrder, setPendingOrder] = useState<OrderResponse["order"] | null>(null);
  const [createdPayment, setCreatedPayment] = useState<OrderResponse["payment"] | null>(null);

  useEffect(() => {
    if (!appliedCoupon) setTotals(initialTotals);
  }, [initialTotals, appliedCoupon]);

  async function applyCoupon() {
    if (!couponCode.trim()) return;
    setCouponBusy(true);
    setError(null);
    try {
      const quote = await api<{ totals: Totals; couponApplied: string | null }>("/api/v1/checkout/quote", {
        method: "POST",
        body: { couponCode: couponCode.trim() },
      });
      setTotals(quote.totals);
      setAppliedCoupon(quote.couponApplied);
    } catch (issue) {
      setAppliedCoupon(null);
      setTotals(initialTotals);
      setError(errorMessage(issue));
    } finally {
      setCouponBusy(false);
    }
  }

  function clearCoupon() {
    setAppliedCoupon(null);
    setCouponCode("");
    setTotals(initialTotals);
  }

  async function openRazorpay(order: OrderResponse) {
    const loaded = await loadRazorpayScript();
    if (!loaded || !order.payment.keyId) {
      setError("We couldn't load the secure payment window. Your order is saved — retry from your orders page.");
      router.push(`/account/orders/${order.order.number}`);
      return;
    }

    const razorpay = new window.Razorpay!({
      key: order.payment.keyId,
      amount: order.payment.amount,
      currency: order.payment.currency,
      name: "Ember & Wick",
      description: `Order ${order.order.number}`,
      order_id: order.payment.providerOrderId,
      prefill: { email },
      notes: { orderNumber: order.order.number },
      theme: { color: "#a45c2b" },
      handler: async (response) => {
        try {
          await api("/api/v1/payments/verify", {
            method: "POST",
            body: {
              orderNumber: order.order.number,
              razorpayOrderId: response.razorpay_order_id,
              razorpayPaymentId: response.razorpay_payment_id,
              razorpaySignature: response.razorpay_signature,
            },
          });
          router.push(`/account/orders/${order.order.number}?paid=1`);
        } catch (issue) {
          setError(
            `${errorMessage(issue)} If money was deducted it will be confirmed automatically — check your order page.`,
          );
          router.push(`/account/orders/${order.order.number}`);
        }
      },
      modal: {
        ondismiss: () => {
          setError("Payment was not completed. Your order is saved and you can retry payment from your orders page.");
          router.push(`/account/orders/${order.order.number}`);
        },
      },
    });

    razorpay.open();
  }

  async function placeOrder(event: React.FormEvent) {
    event.preventDefault();
    setBusy(true);
    setError(null);
    try {
      const body: Record<string, unknown> = {
        couponCode: appliedCoupon ?? undefined,
        notes: notes || undefined,
        idempotencyKey,
      };
      if (mode === "saved") {
        if (!addressId) throw new Error("Choose a delivery address.");
        body.addressId = addressId;
      } else {
        body.address = {
          fullName: draft.fullName,
          phone: draft.phone,
          line1: draft.line1,
          line2: draft.line2 || undefined,
          city: draft.city,
          state: draft.state,
          postalCode: draft.postalCode,
          country: "IN",
        };
      }

      const order = await api<OrderResponse>("/api/v1/orders", { method: "POST", body });
      setPendingOrder(order.order);
      setCreatedPayment(order.payment);

      if (order.payment.provider === "razorpay") {
        await openRazorpay(order);
      }
      // Test mode stops here: the user must press the clearly-labelled test button.
    } catch (issue) {
      setError(errorMessage(issue));
    } finally {
      setBusy(false);
    }
  }

  async function completeTestPayment() {
    if (!pendingOrder) return;
    setBusy(true);
    setError(null);
    try {
      await api("/api/v1/payments/test-confirm", {
        method: "POST",
        body: { orderNumber: pendingOrder.number },
      });
      router.push(`/account/orders/${pendingOrder.number}?paid=1`);
    } catch (issue) {
      setError(errorMessage(issue));
      setBusy(false);
    }
  }

  const field = (key: keyof AddressDraft) => ({
    value: draft[key],
    onChange: (event: React.ChangeEvent<HTMLInputElement>) =>
      setDraft((current) => ({ ...current, [key]: event.target.value })),
  });

  return (
    <form onSubmit={placeOrder} className="grid gap-10 lg:grid-cols-[1.4fr_1fr]">
      <div className="space-y-8">
        <section aria-labelledby="delivery-heading">
          <h2 id="delivery-heading" className="text-xl">
            Delivery
          </h2>

          {paymentMode === "unconfigured" ? (
            <p className="mt-4 border border-clay/40 bg-clay/5 px-4 py-3 text-sm text-clay-dark">
              Online payments are not connected yet, so checkout is paused. Nothing will be charged. Please contact{" "}
              <a href="mailto:hello@emberandwick.com" className="underline">
                hello@emberandwick.com
              </a>{" "}
              to order.
            </p>
          ) : paymentMode === "test" ? (
            <p className="mt-4 border border-sage/50 bg-sage/10 px-4 py-3 text-sm text-ink">
              <strong>Test mode.</strong> No real payment will be taken. Use the test button to confirm the order.
            </p>
          ) : null}

          {addresses.length > 0 ? (
            <div className="mt-4 flex gap-2">
              <button
                type="button"
                onClick={() => setMode("saved")}
                className={`border px-3 py-1.5 text-xs uppercase tracking-wider ${
                  mode === "saved" ? "border-ink bg-ink text-ivory" : "border-line"
                }`}
              >
                Saved address
              </button>
              <button
                type="button"
                onClick={() => setMode("new")}
                className={`border px-3 py-1.5 text-xs uppercase tracking-wider ${
                  mode === "new" ? "border-ink bg-ink text-ivory" : "border-line"
                }`}
              >
                New address
              </button>
            </div>
          ) : null}

          {mode === "saved" && addresses.length > 0 ? (
            <ul className="mt-4 space-y-3">
              {addresses.map((address) => (
                <li key={address.id}>
                  <label className="flex cursor-pointer gap-3 border border-line p-4 has-checked:border-ink">
                    <input
                      type="radio"
                      name="address"
                      value={address.id}
                      checked={addressId === address.id}
                      onChange={() => setAddressId(address.id)}
                      className="mt-1"
                    />
                    <span className="text-sm">
                      <span className="block font-medium">
                        {address.fullName}
                        {address.isDefault ? <span className="ml-2 text-xs text-sage">Default</span> : null}
                      </span>
                      <span className="block text-ink-soft">
                        {address.line1}
                        {address.line2 ? `, ${address.line2}` : ""}, {address.city}, {address.state}{" "}
                        {address.postalCode}
                      </span>
                      <span className="block text-xs text-ink-soft">{address.phone}</span>
                    </span>
                  </label>
                </li>
              ))}
            </ul>
          ) : (
            <div className="mt-4 grid gap-4 sm:grid-cols-2">
              <label className="block sm:col-span-2">
                <span className="eyebrow">Full name</span>
                <input {...field("fullName")} required autoComplete="name" className="mt-1 w-full border border-line bg-ivory px-3 py-2.5 text-sm" />
              </label>
              <label className="block">
                <span className="eyebrow">Phone</span>
                <input {...field("phone")} required type="tel" autoComplete="tel" className="mt-1 w-full border border-line bg-ivory px-3 py-2.5 text-sm" />
              </label>
              <label className="block">
                <span className="eyebrow">PIN code</span>
                <input {...field("postalCode")} required inputMode="numeric" pattern="[1-9][0-9]{5}" autoComplete="postal-code" className="mt-1 w-full border border-line bg-ivory px-3 py-2.5 text-sm" />
              </label>
              <label className="block sm:col-span-2">
                <span className="eyebrow">Address line 1</span>
                <input {...field("line1")} required autoComplete="address-line1" className="mt-1 w-full border border-line bg-ivory px-3 py-2.5 text-sm" />
              </label>
              <label className="block sm:col-span-2">
                <span className="eyebrow">Address line 2 (optional)</span>
                <input {...field("line2")} autoComplete="address-line2" className="mt-1 w-full border border-line bg-ivory px-3 py-2.5 text-sm" />
              </label>
              <label className="block">
                <span className="eyebrow">City</span>
                <input {...field("city")} required autoComplete="address-level2" className="mt-1 w-full border border-line bg-ivory px-3 py-2.5 text-sm" />
              </label>
              <label className="block">
                <span className="eyebrow">State</span>
                <input {...field("state")} required autoComplete="address-level1" className="mt-1 w-full border border-line bg-ivory px-3 py-2.5 text-sm" />
              </label>
            </div>
          )}

          <label className="mt-6 block">
            <span className="eyebrow">Gift note (optional)</span>
            <textarea
              value={notes}
              onChange={(event) => setNotes(event.target.value)}
              rows={2}
              maxLength={500}
              className="mt-1 w-full border border-line bg-ivory px-3 py-2.5 text-sm"
              placeholder="We'll write this on the card by hand."
            />
          </label>
        </section>

        <section aria-labelledby="coupon-heading">
          <h2 id="coupon-heading" className="text-xl">
            Coupon
          </h2>
          <div className="mt-3 flex gap-2">
            {appliedCoupon ? (
              <>
                <p className="flex-1 border border-sage/50 bg-sage/10 px-3 py-2.5 text-sm">
                  {appliedCoupon} applied — {formatMoney(totals.discount)} off
                </p>
                <button type="button" onClick={clearCoupon} className="border border-line px-4 text-sm">
                  Remove
                </button>
              </>
            ) : (
              <>
                <input
                  value={couponCode}
                  onChange={(event) => setCouponCode(event.target.value.toUpperCase())}
                  placeholder="WELCOME10"
                  className="min-w-0 flex-1 border border-line bg-ivory px-3 py-2.5 text-sm uppercase"
                  aria-label="Coupon code"
                />
                <button
                  type="button"
                  onClick={applyCoupon}
                  disabled={couponBusy || !couponCode.trim()}
                  className="border border-ink px-4 text-sm uppercase tracking-wider disabled:opacity-50"
                >
                  {couponBusy ? "…" : "Apply"}
                </button>
              </>
            )}
          </div>
        </section>
      </div>

      <aside aria-label="Order summary" className="h-fit border border-line bg-sand/30 p-6">
        <h2 className="text-lg">Order summary</h2>
        <p className="mt-1 text-xs text-ink-soft">{itemCount} item{itemCount === 1 ? "" : "s"}</p>
        <dl className="mt-4 space-y-2 text-sm">
          <div className="flex justify-between">
            <dt className="text-ink-soft">Subtotal</dt>
            <dd>{formatMoney(totals.subtotal)}</dd>
          </div>
          {totals.discount > 0 ? (
            <div className="flex justify-between text-sage">
              <dt>Discount</dt>
              <dd>− {formatMoney(totals.discount)}</dd>
            </div>
          ) : null}
          <div className="flex justify-between">
            <dt className="text-ink-soft">Shipping</dt>
            <dd>{totals.shippingFee === 0 ? "Free" : formatMoney(totals.shippingFee)}</dd>
          </div>
          <div className="flex justify-between border-t border-line pt-2 text-base">
            <dt>Total</dt>
            <dd>{formatMoney(totals.total)}</dd>
          </div>
          <p className="text-xs text-ink-soft">Includes {formatMoney(totals.tax)} GST</p>
        </dl>

        {error ? (
          <p role="alert" className="mt-4 border border-clay/40 bg-clay/5 px-3 py-2 text-sm text-clay-dark">
            {error}
          </p>
        ) : null}

        {pendingOrder && createdPayment && createdPayment.provider !== "razorpay" ? (
          <button
            type="button"
            onClick={completeTestPayment}
            disabled={busy}
            className="mt-5 w-full bg-sage px-6 py-3.5 text-sm font-medium text-ivory hover:opacity-90 disabled:opacity-50"
          >
            {busy ? "Confirming…" : "Complete simulated payment (no money taken)"}
          </button>
        ) : (
          <button
            type="submit"
            disabled={busy || paymentMode === "unconfigured"}
            className="mt-5 w-full bg-ink px-6 py-3.5 text-sm font-medium text-ivory hover:bg-clay-dark disabled:cursor-not-allowed disabled:opacity-50"
          >
            {busy ? "Starting secure payment…" : `Pay ${formatMoney(totals.total)}`}
          </button>
        )}

        <p className="mt-3 text-center text-xs text-ink-soft">
          Secure payment by Razorpay · UPI, cards, netbanking
        </p>
        <p className="mt-2 text-center text-xs text-ink-soft">
          <Link href="/refund-policy" className="underline underline-offset-4">
            Returns &amp; refund policy
          </Link>
        </p>
      </aside>
    </form>
  );
}
