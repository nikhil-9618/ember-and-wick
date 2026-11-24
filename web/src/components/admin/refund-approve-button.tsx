"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { api, errorMessage } from "@/lib/client/api";

export function RefundApproveButton({
  refundId,
  disabledReason,
}: {
  refundId: string;
  disabledReason?: string | null;
}) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function approve() {
    setBusy(true);
    setError(null);
    try {
      await api(`/api/v1/admin/refunds/${refundId}/approve`, { method: "POST" });
      router.refresh();
    } catch (issue) {
      setError(errorMessage(issue));
    } finally {
      setBusy(false);
    }
  }

  if (disabledReason) {
    return <span className="text-xs text-ink-soft">{disabledReason}</span>;
  }

  return (
    <div>
      <button
        type="button"
        onClick={approve}
        disabled={busy}
        className="border border-ink px-3 py-1 text-xs uppercase tracking-wider hover:bg-ink hover:text-ivory disabled:opacity-50"
      >
        {busy ? "Approving…" : "Approve refund"}
      </button>
      {error ? (
        <p role="alert" className="mt-1 text-xs text-clay-dark">
          {error}
        </p>
      ) : null}
    </div>
  );
}
