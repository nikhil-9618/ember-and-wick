"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { api, errorMessage } from "@/lib/client/api";
import { Icon } from "@/components/ui/icons";

interface StartedReset {
  challengeId: string;
  email: string;
  expiresAt: string;
  expiresInSeconds: number;
}

export function ForgotPasswordForm() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    setBusy(true);
    setError(null);
    try {
      const started = await api<StartedReset>("/api/v1/auth/forgot-password", {
        method: "POST",
        body: { email },
      });
      router.push(
        `/reset-password?challenge=${encodeURIComponent(started.challengeId)}&email=${encodeURIComponent(started.email)}`,
      );
    } catch (issue) {
      setError(errorMessage(issue));
      setBusy(false);
    }
  }

  return (
    <form onSubmit={submit} className="space-y-4" noValidate>
      <div>
        <label htmlFor="email" className="eyebrow">
          Email
        </label>
        <div className="relative">
          <Icon
            name="mail"
            size={16}
            className="pointer-events-none absolute left-3 top-1/2 mt-0.5 -translate-y-1/2 text-ink-soft"
          />
          <input
            id="email"
            name="email"
            type="email"
            autoComplete="email"
            required
            value={email}
            onChange={(event) => setEmail(event.target.value)}
            className="mt-1 block w-full border border-line bg-ivory py-2.5 pl-10 pr-3 text-sm outline-none transition-colors focus:border-clay"
          />
        </div>
      </div>

      {error ? (
        <p role="alert" className="border border-clay/40 bg-clay/5 px-3 py-2 text-sm text-clay-dark">
          {error}
        </p>
      ) : null}

      <button
        type="submit"
        disabled={busy}
        className="flex w-full items-center justify-center gap-2 bg-ink px-6 py-3 text-sm font-medium text-ivory transition-colors hover:bg-clay-dark disabled:opacity-50"
      >
        <Icon name="mail" size={16} />
        {busy ? "Sending…" : "Email me a reset code"}
      </button>

      <p className="text-xs text-ink-soft">
        The 6-digit code comes from our store address, <span className="text-ink">no-reply@emberandwick.com</span>, and
        expires in 10 minutes. If an account exists for the address, you will receive one.
      </p>

      <p className="text-center text-xs text-ink-soft">
        Remembered it?{" "}
        <Link href="/login" className="text-clay underline underline-offset-4">
          Sign in
        </Link>
      </p>
    </form>
  );
}
