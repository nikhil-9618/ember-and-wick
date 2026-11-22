"use client";

import { useEffect } from "react";

export default function GlobalError({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  useEffect(() => {
    // Only the message is logged: never tokens, cookies or customer data.
    console.error("[web] route error:", error.message);
  }, [error]);

  return (
    <div className="shell flex min-h-[50vh] flex-col items-start justify-center py-24">
      <p className="eyebrow">Something went wrong</p>
      <h1 className="mt-3 text-3xl">We hit a snag.</h1>
      <p className="mt-3 max-w-md text-ink-soft">
        This page couldn&apos;t load. Your cart and orders are safe — please try again, or contact us if it keeps
        happening.
      </p>
      <div className="mt-8 flex gap-3">
        <button
          type="button"
          onClick={reset}
          className="bg-ink px-5 py-3 text-sm text-ivory hover:bg-clay-dark"
        >
          Try again
        </button>
        <a href="/contact" className="border border-line px-5 py-3 text-sm hover:border-ink">
          Contact support
        </a>
      </div>
    </div>
  );
}
