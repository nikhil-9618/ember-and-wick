"use client";

import { useCallback, useEffect, useState } from "react";
import { useParams } from "next/navigation";
import { api, errorMessage } from "@/lib/client/api";
import { openRazorpayCheckout, type PaymentIntentView } from "@/lib/client/razorpay";
import { formatMoney } from "@/lib/money";

interface OrderView {
  number: string;
  status: string;
  paymentStatus: string;
  total: number;
  email: string;
}

/**
 * Hosted payment hand-off for the native app.
 *
 * The mobile app opens this page in an in-app browser and passes its session
 * token in the URL fragment (`#t=...`), which browsers never send to a server.
 * Nothing here is trusted by the API: every call is authenticated and the
 * payment is only confirmed after server-side signature verification.
 */
export default function PayPage() {
  const params = useParams<{ number: string }>();
  const orderNumber = String(params.number ?? "");
  const [token, setToken] = useState<string | null>(null);
  const [order, setOrder] = useState<OrderView | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [status, setStatus] = useState<"checking" | "ready" | "paid">("checking");

  const withToken = useCallback(async <T,>(path: string, init: { method?: "GET" | "POST"; body?: unknown } = {}) => {
    const headers: Record<string, string> = { Accept: "application/json" };
    if (init.body !== undefined) headers["Content-Type"] = "application/json";
    if (token) headers.Authorization = `Bearer ${token}`;
    const response = await fetch(path, {
      method: init.method ?? "GET",
      headers,
      body: init.body === undefined ? undefined : JSON.stringify(init.body),
      credentials: "same-origin",
      cache: "no-store",
    });
    const text = await response.text();
    const payload = text ? JSON.parse(text) : null;
    if (!response.ok) {
      throw new Error(payload?.error?.message ?? "Request failed");
    }
    return payload as T;
  }, [token]);

  useEffect(() => {
    const hash = window.location.hash.replace(/^#/, "");
    const params = new URLSearchParams(hash);
    setToken(params.get("t"));
  }, []);

  useEffect(() => {
    if (token === null) return;
    let active = true;
    (async () => {
      try {
        const result = await withToken<{ order: OrderView }>(`/api/v1/orders/${encodeURIComponent(orderNumber)}`);
        if (!active) return;
        setOrder(result.order);
        setStatus(result.order.paymentStatus === "paid" ? "paid" : "ready");
      } catch (issue) {
        if (active) setError(errorMessage(issue));
      }
    })();
    return () => {
      active = false;
    };
  }, [token, orderNumber, withToken]);

  async function pay() {
    setBusy(true);
    setError(null);
    try {
      const { payment } = await withToken<{ payment: PaymentIntentView }>(
        `/api/v1/orders/${encodeURIComponent(orderNumber)}/retry-payment`,
        { method: "POST" },
      );

      if (payment.provider === "test") {
        await withToken(`/api/v1/payments/test-confirm`, { method: "POST", body: { orderNumber } });
        setStatus("paid");
        return;
      }

      const opened = await openRazorpayCheckout({
        intent: payment,
        orderNumber,
        email: order?.email ?? "",
        onSuccess: async (response) => {
          try {
            await withToken("/api/v1/payments/verify", {
              method: "POST",
              body: {
                orderNumber,
                razorpayOrderId: response.razorpay_order_id,
                razorpayPaymentId: response.razorpay_payment_id,
                razorpaySignature: response.razorpay_signature,
              },
            });
            setStatus("paid");
          } catch (issue) {
            setError(errorMessage(issue));
          }
        },
        onDismiss: () => setError("Payment window closed before completing. You can retry."),
      });
      if (!opened) setError("The payment window could not load. Please try again.");
    } catch (issue) {
      setError(errorMessage(issue));
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="shell flex min-h-[70vh] max-w-lg flex-col justify-center py-16">
      <p className="eyebrow">Secure payment</p>
      <h1 className="mt-3 text-3xl">Order {orderNumber}</h1>

      {status === "paid" ? (
        <div className="mt-6 border border-sage/50 bg-sage/10 p-5">
          <p className="text-lg">Payment confirmed.</p>
          <p className="mt-1 text-sm text-ink-soft">You can close this window and return to the app.</p>
        </div>
      ) : null}

      {order && status !== "paid" ? (
        <>
          <p className="mt-2 text-sm text-ink-soft">
            {order.total ? formatMoney(order.total) : ""} · {order.paymentStatus.replace("_", " ")}
          </p>
          <button
            type="button"
            onClick={pay}
            disabled={busy}
            className="mt-8 bg-ink px-6 py-3.5 text-sm font-medium text-ivory hover:bg-clay-dark disabled:opacity-50"
          >
            {busy ? "Opening payment…" : "Pay now"}
          </button>
        </>
      ) : null}

      {status === "checking" && !error ? <p className="mt-6 text-sm text-ink-soft">Checking your order…</p> : null}

      {error ? (
        <div className="mt-6 border border-clay/40 bg-clay/5 px-4 py-3 text-sm text-clay-dark">
          <p>{error}</p>
          <p className="mt-2 text-xs">
            If this keeps happening, open the app from your signed-in session and retry from the order page.
          </p>
        </div>
      ) : null}
    </div>
  );
}
