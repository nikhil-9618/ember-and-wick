"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { api, errorMessage } from "@/lib/client/api";

export function SignOutButton() {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function signOut() {
    setBusy(true);
    setError(null);
    try {
      await api("/api/v1/auth/logout", { method: "POST" });
      router.replace("/");
      router.refresh();
    } catch (issue) {
      setError(errorMessage(issue));
      setBusy(false);
    }
  }

  return (
    <div>
      <button
        type="button"
        onClick={signOut}
        disabled={busy}
        className="border border-line px-5 py-2.5 text-sm hover:border-ink disabled:opacity-50"
      >
        {busy ? "Signing out…" : "Sign out"}
      </button>
      {error ? <p role="alert" className="mt-2 text-xs text-clay-dark">{error}</p> : null}
    </div>
  );
}
