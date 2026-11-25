"use client";

import { useState } from "react";
import Link from "next/link";
import { api, errorMessage } from "@/lib/client/api";
import { Icon } from "@/components/ui/icons";

export function ResetPasswordForm({ challengeId, email }: { challengeId: string; email: string }) {
  const [code, setCode] = useState("");
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    setError(null);
    if (password !== confirm) {
      setError("The two passwords do not match.");
      return;
    }
    setBusy(true);
    try {
      await api("/api/v1/auth/reset-password", {
        method: "POST",
        body: { challengeId, code, newPassword: password },
      });
      setDone(true);
    } catch (issue) {
      setError(errorMessage(issue));
    } finally {
      setBusy(false);
    }
  }

  if (done) {
    return (
      <div className="space-y-4 page-enter">
        <div className="flex items-start gap-3 border border-sage/50 bg-sage/10 px-4 py-3">
          <Icon name="check" size={18} className="mt-0.5 shrink-0 text-sage" />
          <p className="text-sm text-ink">
            Your password has been updated. Every other device has been signed out.
          </p>
        </div>
        <Link
          href="/login"
          className="flex w-full items-center justify-center gap-2 bg-ink px-6 py-3 text-sm font-medium text-ivory transition-colors hover:bg-clay-dark"
        >
          <Icon name="arrow-right" size={16} />
          Sign in with your new password
        </Link>
      </div>
    );
  }

  const fieldClass =
    "mt-1 block w-full border border-line bg-ivory px-3 py-2.5 text-sm outline-none transition-colors focus:border-clay";

  return (
    <form onSubmit={submit} className="space-y-4 page-enter" noValidate>
      <p className="text-sm text-ink-soft">
        Enter the 6-digit code sent to{" "}
        <span className="text-ink">{email || "your account email"}</span>, then choose a new password.
      </p>

      <div>
        <label htmlFor="otp" className="eyebrow">
          Reset code
        </label>
        <input
          id="otp"
          name="otp"
          inputMode="numeric"
          autoComplete="one-time-code"
          autoFocus
          required
          maxLength={6}
          value={code}
          onChange={(event) => setCode(event.target.value.replace(/\D/g, "").slice(0, 6))}
          className="mt-1 block w-full border border-line bg-ivory px-3 py-3 text-center text-xl tracking-[0.5em]"
        />
      </div>

      <div>
        <label htmlFor="password" className="eyebrow">
          New password
        </label>
        <input
          id="password"
          name="password"
          type="password"
          autoComplete="new-password"
          required
          minLength={8}
          value={password}
          onChange={(event) => setPassword(event.target.value)}
          className={fieldClass}
        />
        <p className="mt-1 text-xs text-ink-soft">At least 8 characters, with a letter and a number.</p>
      </div>

      <div>
        <label htmlFor="confirm" className="eyebrow">
          Confirm new password
        </label>
        <input
          id="confirm"
          name="confirm"
          type="password"
          autoComplete="new-password"
          required
          value={confirm}
          onChange={(event) => setConfirm(event.target.value)}
          className={fieldClass}
        />
      </div>

      {error ? (
        <p role="alert" className="border border-clay/40 bg-clay/5 px-3 py-2 text-sm text-clay-dark">
          {error}
        </p>
      ) : null}

      <button
        type="submit"
        disabled={busy || code.length !== 6}
        className="flex w-full items-center justify-center gap-2 bg-ink px-6 py-3 text-sm font-medium text-ivory transition-colors hover:bg-clay-dark disabled:opacity-50"
      >
        <Icon name="lock" size={16} />
        {busy ? "Updating…" : "Update password"}
      </button>

      <p className="text-center text-xs text-ink-soft">
        Need a new code?{" "}
        <Link href="/forgot-password" className="text-clay underline underline-offset-4">
          Request another
        </Link>
      </p>
    </form>
  );
}
