"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { api, errorMessage } from "@/lib/client/api";

export function CartQuantityControls({
  variantId,
  quantity,
  max,
}: {
  variantId: string;
  quantity: number;
  max: number;
}) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function update(next: number) {
    setBusy(true);
    setError(null);
    try {
      await api("/api/v1/cart", { method: "PATCH", body: { variantId, quantity: next } });
      router.refresh();
    } catch (issue) {
      setError(errorMessage(issue));
    } finally {
      setBusy(false);
    }
  }

  return (
    <div>
      <div className="flex items-center border border-line">
        <button
          type="button"
          aria-label="Decrease quantity"
          disabled={busy}
          onClick={() => update(quantity - 1)}
          className="px-2.5 py-1 text-sm hover:bg-sand disabled:opacity-40"
        >
          −
        </button>
        <span className="min-w-8 text-center text-sm" aria-live="polite">
          {quantity}
        </span>
        <button
          type="button"
          aria-label="Increase quantity"
          disabled={busy || quantity >= max}
          onClick={() => update(quantity + 1)}
          className="px-2.5 py-1 text-sm hover:bg-sand disabled:opacity-40"
        >
          +
        </button>
      </div>
      <button
        type="button"
        disabled={busy}
        onClick={() => update(0)}
        className="mt-1 text-xs text-ink-soft underline underline-offset-4 hover:text-clay disabled:opacity-40"
      >
        Remove
      </button>
      {error ? (
        <p role="alert" className="mt-1 text-xs text-clay-dark">
          {error}
        </p>
      ) : null}
    </div>
  );
}
