"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { api, errorMessage } from "@/lib/client/api";

export function ProfileForm({ name, phone }: { name: string; phone: string | null }) {
  const router = useRouter();
  const [values, setValues] = useState({ name, phone: phone ?? "" });
  const [state, setState] = useState<"idle" | "saving" | "saved">("idle");
  const [error, setError] = useState<string | null>(null);

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    setState("saving");
    setError(null);
    try {
      await api("/api/v1/auth/me", { method: "PATCH", body: { name: values.name, phone: values.phone || null } });
      setState("saved");
      router.refresh();
    } catch (issue) {
      setError(errorMessage(issue));
      setState("idle");
    }
  }

  return (
    <form onSubmit={submit} className="max-w-md space-y-4">
      <label className="block">
        <span className="eyebrow">Full name</span>
        <input
          value={values.name}
          onChange={(event) => setValues({ ...values, name: event.target.value })}
          required
          minLength={2}
          className="mt-1 w-full border border-line bg-ivory px-3 py-2.5 text-sm"
        />
      </label>
      <label className="block">
        <span className="eyebrow">Phone</span>
        <input
          value={values.phone}
          onChange={(event) => setValues({ ...values, phone: event.target.value })}
          type="tel"
          className="mt-1 w-full border border-line bg-ivory px-3 py-2.5 text-sm"
        />
      </label>
      {error ? <p role="alert" className="text-sm text-clay-dark">{error}</p> : null}
      <button
        type="submit"
        disabled={state === "saving"}
        className="bg-ink px-5 py-2.5 text-sm text-ivory hover:bg-clay-dark disabled:opacity-50"
      >
        {state === "saving" ? "Saving…" : state === "saved" ? "Saved ✓" : "Save changes"}
      </button>
    </form>
  );
}

export function PasswordForm() {
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [state, setState] = useState<"idle" | "saving" | "saved">("idle");
  const [error, setError] = useState<string | null>(null);

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    setState("saving");
    setError(null);
    try {
      await api("/api/v1/auth/password", { method: "POST", body: { currentPassword, newPassword } });
      setCurrentPassword("");
      setNewPassword("");
      setState("saved");
    } catch (issue) {
      setError(errorMessage(issue));
      setState("idle");
    }
  }

  return (
    <form onSubmit={submit} className="max-w-md space-y-4">
      <label className="block">
        <span className="eyebrow">Current password</span>
        <input
          type="password"
          value={currentPassword}
          onChange={(event) => setCurrentPassword(event.target.value)}
          required
          autoComplete="current-password"
          className="mt-1 w-full border border-line bg-ivory px-3 py-2.5 text-sm"
        />
      </label>
      <label className="block">
        <span className="eyebrow">New password</span>
        <input
          type="password"
          value={newPassword}
          onChange={(event) => setNewPassword(event.target.value)}
          required
          minLength={8}
          autoComplete="new-password"
          className="mt-1 w-full border border-line bg-ivory px-3 py-2.5 text-sm"
        />
        <span className="mt-1 block text-xs text-ink-soft">
          At least 8 characters with a letter and a number. Other devices will be signed out.
        </span>
      </label>
      {error ? <p role="alert" className="text-sm text-clay-dark">{error}</p> : null}
      <button
        type="submit"
        disabled={state === "saving"}
        className="border border-ink px-5 py-2.5 text-sm hover:bg-sand disabled:opacity-50"
      >
        {state === "saving" ? "Updating…" : state === "saved" ? "Password updated ✓" : "Update password"}
      </button>
    </form>
  );
}
