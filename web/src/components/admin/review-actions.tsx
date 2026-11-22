"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { api, errorMessage } from "@/lib/client/api";

export function ReviewActions({ reviewId, status }: { reviewId: string; status: string }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function moderate(next: "published" | "rejected") {
    setBusy(true);
    setError(null);
    try {
      await api("/api/v1/admin/reviews", { method: "PATCH", body: { reviewId, status: next } });
      router.refresh();
    } catch (issue) {
      setError(errorMessage(issue));
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="mt-3 flex items-center gap-3 text-xs">
      {status !== "published" ? (
        <button
          type="button"
          onClick={() => moderate("published")}
          disabled={busy}
          className="border border-sage px-3 py-1 text-sage disabled:opacity-50"
        >
          Publish
        </button>
      ) : null}
      {status !== "rejected" ? (
        <button
          type="button"
          onClick={() => moderate("rejected")}
          disabled={busy}
          className="border border-line px-3 py-1 text-ink-soft disabled:opacity-50"
        >
          Reject
        </button>
      ) : null}
      {error ? <span className="text-clay-dark">{error}</span> : null}
    </div>
  );
}
