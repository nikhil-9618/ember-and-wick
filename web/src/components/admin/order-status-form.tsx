"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { api, errorMessage } from "@/lib/client/api";

interface Props {
  orderNumber: string;
  currentStatus: string;
  transitions: { value: string; label: string }[];
  trackingNumber: string;
  carrier: string;
}

export function OrderStatusForm({ orderNumber, currentStatus, transitions, trackingNumber, carrier }: Props) {
  const router = useRouter();
  const [status, setStatus] = useState(transitions[0]?.value ?? "");
  const [tracking, setTracking] = useState(trackingNumber);
  const [courier, setCourier] = useState(carrier);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    setBusy(true);
    setError(null);
    setSaved(false);
    try {
      const body: Record<string, unknown> = {};
      if (status && status !== currentStatus) body.status = status;
      if (tracking !== trackingNumber) body.trackingNumber = tracking;
      if (courier !== carrier) body.carrier = courier;
      if (Object.keys(body).length === 0) {
        setError("Nothing to update.");
        setBusy(false);
        return;
      }
      await api(`/api/v1/admin/orders/${encodeURIComponent(orderNumber)}`, { method: "PATCH", body });
      setSaved(true);
      router.refresh();
    } catch (issue) {
      setError(errorMessage(issue));
    } finally {
      setBusy(false);
    }
  }

  return (
    <form onSubmit={submit} className="border border-line p-4">
      <h2 className="text-lg">Update order</h2>

      <label className="mt-3 block">
        <span className="eyebrow">Next status</span>
        <select
          value={status}
          onChange={(event) => setStatus(event.target.value)}
          disabled={transitions.length === 0}
          className="mt-1 w-full border border-line bg-ivory px-3 py-2 text-sm disabled:opacity-60"
        >
          {transitions.length === 0 ? <option value="">No further transitions</option> : null}
          {transitions.map((transition) => (
            <option key={transition.value} value={transition.value}>
              {transition.label}
            </option>
          ))}
        </select>
      </label>

      <label className="mt-3 block">
        <span className="eyebrow">Tracking number</span>
        <input
          value={tracking}
          onChange={(event) => setTracking(event.target.value)}
          className="mt-1 w-full border border-line bg-ivory px-3 py-2 text-sm"
        />
      </label>
      <label className="mt-3 block">
        <span className="eyebrow">Carrier</span>
        <input
          value={courier}
          onChange={(event) => setCourier(event.target.value)}
          placeholder="Delhivery, Bluedart…"
          className="mt-1 w-full border border-line bg-ivory px-3 py-2 text-sm"
        />
      </label>

      {error ? <p role="alert" className="mt-3 text-sm text-clay-dark">{error}</p> : null}
      {saved ? <p className="mt-3 text-sm text-sage">Order updated.</p> : null}

      <button
        type="submit"
        disabled={busy || transitions.length === 0}
        className="mt-4 w-full bg-ink px-4 py-2.5 text-sm text-ivory hover:bg-clay-dark disabled:opacity-50"
      >
        {busy ? "Updating…" : "Save update"}
      </button>
      <p className="mt-2 text-xs text-ink-soft">
        Status changes are validated against the order state machine and the customer is notified.
      </p>
    </form>
  );
}
