"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { api, errorMessage } from "@/lib/client/api";

export function RefundForm({ mode }: { mode: "razorpay" | "test" | "unconfigured" }) {
  const router = useRouter();
  const [form, setForm] = useState({ orderId: "", amount: "", reason: "" });
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState<string | null>(null);

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    setBusy(true);
    setError(null);
    setDone(null);
    try {
      const result = await api<{ id: string; status: string }>("/api/v1/admin/refunds", {
        method: "POST",
        body: {
          orderId: form.orderId.trim(),
          amount: Math.round(Number(form.amount) * 100),
          reason: form.reason,
        },
      });
      setDone(`Refund ${result.status}.`);
      setForm({ orderId: "", amount: "", reason: "" });
      router.refresh();
    } catch (issue) {
      setError(errorMessage(issue));
    } finally {
      setBusy(false);
    }
  }

  return (
    <form onSubmit={submit} className="h-fit border border-line p-4">
      <h2 className="text-lg">Issue a refund</h2>
      {mode === "test" ? (
        <p className="mt-1 text-xs text-sage">
          Simulated payments: refunds complete instantly and take no real money.
        </p>
      ) : null}

      <label className="mt-3 block">
        <span className="eyebrow">Order number</span>
        <input
          required
          value={form.orderId}
          onChange={(event) => setForm({ ...form, orderId: event.target.value.toUpperCase() })}
          placeholder="EW-261122-AB12C"
          className="mt-1 w-full border border-line bg-ivory px-2 py-1.5 text-sm"
        />
      </label>
      <label className="mt-3 block">
        <span className="eyebrow">Amount (₹)</span>
        <input
          required
          inputMode="decimal"
          value={form.amount}
          onChange={(event) => setForm({ ...form, amount: event.target.value })}
          className="mt-1 w-full border border-line bg-ivory px-2 py-1.5 text-sm"
        />
      </label>
      <label className="mt-3 block">
        <span className="eyebrow">Reason</span>
        <textarea
          required
          minLength={5}
          rows={3}
          value={form.reason}
          onChange={(event) => setForm({ ...form, reason: event.target.value })}
          className="mt-1 w-full border border-line bg-ivory px-2 py-1.5 text-sm"
        />
      </label>

      {error ? <p role="alert" className="mt-3 text-sm text-clay-dark">{error}</p> : null}
      {done ? <p className="mt-3 text-sm text-sage">{done}</p> : null}

      <button
        type="submit"
        disabled={busy || mode === "unconfigured"}
        className="mt-4 w-full bg-ink px-4 py-2.5 text-sm text-ivory hover:bg-clay-dark disabled:opacity-50"
      >
        {busy ? "Processing…" : "Issue refund"}
      </button>
      <p className="mt-2 text-xs text-ink-soft">
        The order is marked refunded or partially refunded automatically and the customer is notified.
      </p>
    </form>
  );
}
