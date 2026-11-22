"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { api, errorMessage } from "@/lib/client/api";
import { openRazorpayCheckout, type PaymentIntentView } from "@/lib/client/razorpay";

interface Props {
  orderNumber: string;
  canCancel: boolean;
  canRetryPayment: boolean;
  email: string;
}

export function OrderActions({ orderNumber, canCancel, canRetryPayment, email }: Props) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function retryPayment() {
    setBusy(true);
    setError(null);
    try {
      const { payment } = await api<{ payment: PaymentIntentView }>(
        `/api/v1/orders/${encodeURIComponent(orderNumber)}/retry-payment`,
        { method: "POST" },
      );

      if (payment.provider === "test") {
        await api("/api/v1/payments/test-confirm", { method: "POST", body: { orderNumber } });
        router.refresh();
        return;
      }

      const opened = await openRazorpayCheckout({
        intent: payment,
        orderNumber,
        email,
        onSuccess: async (response) => {
          try {
            await api("/api/v1/payments/verify", {
              method: "POST",
              body: {
                orderNumber,
                razorpayOrderId: response.razorpay_order_id,
                razorpayPaymentId: response.razorpay_payment_id,
                razorpaySignature: response.razorpay_signature,
              },
            });
          } catch (issue) {
            setError(errorMessage(issue));
          }
          router.refresh();
        },
        onDismiss: () => setError("Payment window closed before completing. You can retry any time."),
      });

      if (!opened) setError("We couldn't open the secure payment window. Please try again.");
    } catch (issue) {
      setError(errorMessage(issue));
    } finally {
      setBusy(false);
    }
  }

  async function cancelOrder() {
    if (!window.confirm("Cancel this order? Any reserved items will be released.")) return;
    setBusy(true);
    setError(null);
    try {
      await api(`/api/v1/orders/${encodeURIComponent(orderNumber)}/cancel`, { method: "POST" });
      router.refresh();
    } catch (issue) {
      setError(errorMessage(issue));
    } finally {
      setBusy(false);
    }
  }

  if (!canCancel && !canRetryPayment) return error ? <p className="text-xs text-clay-dark">{error}</p> : null;

  return (
    <div className="space-y-2">
      {canRetryPayment ? (
        <button
          type="button"
          onClick={retryPayment}
          disabled={busy}
          className="w-full bg-ink px-5 py-3 text-sm text-ivory hover:bg-clay-dark disabled:opacity-50"
        >
          {busy ? "Please wait…" : "Complete payment"}
        </button>
      ) : null}
      {canCancel ? (
        <button
          type="button"
          onClick={cancelOrder}
          disabled={busy}
          className="w-full border border-line px-5 py-3 text-sm hover:border-ink disabled:opacity-50"
        >
          Cancel order
        </button>
      ) : null}
      {error ? (
        <p role="alert" className="text-xs text-clay-dark">
          {error}
        </p>
      ) : null}
    </div>
  );
}
