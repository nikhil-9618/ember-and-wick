"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { api, errorMessage } from "@/lib/client/api";

interface Props {
  mode: "login" | "register";
  next: string;
}

export function AuthForm({ mode, next }: Props) {
  const router = useRouter();
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [password, setPassword] = useState("");
  const [state, setState] = useState<"idle" | "sending">("idle");
  const [error, setError] = useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    setState("sending");
    setError(null);
    setFieldErrors({});
    try {
      if (mode === "register") {
        await api("/api/v1/auth/register", {
          method: "POST",
          body: { name, email, password, phone: phone || undefined },
        });
      } else {
        await api("/api/v1/auth/login", { method: "POST", body: { email, password } });
      }
      router.replace(next.startsWith("/") ? next : "/account");
      router.refresh();
    } catch (issue) {
      const Errors = issue as { details?: { path: string; message: string }[] };
      if (Array.isArray(Errors.details)) {
        setFieldErrors(Object.fromEntries(Errors.details.map((detail) => [detail.path, detail.message])));
      }
      setError(errorMessage(issue));
      setState("idle");
    }
  }

  return (
    <form onSubmit={submit} className="space-y-4" noValidate>
      {mode === "register" ? (
        <div>
          <label htmlFor="name" className="eyebrow">
            Full name
          </label>
          <input
            id="name"
            name="name"
            autoComplete="name"
            required
            value={name}
            onChange={(event) => setName(event.target.value)}
            className="mt-1 block w-full border border-line bg-ivory px-3 py-2.5 text-sm"
            aria-invalid={Boolean(fieldErrors.name)}
          />
          {fieldErrors.name ? <p className="mt-1 text-xs text-clay-dark">{fieldErrors.name}</p> : null}
        </div>
      ) : null}

      <div>
        <label htmlFor="email" className="eyebrow">
          Email
        </label>
        <input
          id="email"
          name="email"
          type="email"
          autoComplete="email"
          required
          value={email}
          onChange={(event) => setEmail(event.target.value)}
          className="mt-1 block w-full border border-line bg-ivory px-3 py-2.5 text-sm"
          aria-invalid={Boolean(fieldErrors.email)}
        />
        {fieldErrors.email ? <p className="mt-1 text-xs text-clay-dark">{fieldErrors.email}</p> : null}
      </div>

      {mode === "register" ? (
        <div>
          <label htmlFor="phone" className="eyebrow">
            Phone (optional)
          </label>
          <input
            id="phone"
            name="phone"
            type="tel"
            autoComplete="tel"
            value={phone}
            onChange={(event) => setPhone(event.target.value)}
            className="mt-1 block w-full border border-line bg-ivory px-3 py-2.5 text-sm"
            aria-invalid={Boolean(fieldErrors.phone)}
          />
          {fieldErrors.phone ? <p className="mt-1 text-xs text-clay-dark">{fieldErrors.phone}</p> : null}
        </div>
      ) : null}

      <div>
        <label htmlFor="password" className="eyebrow">
          Password
        </label>
        <input
          id="password"
          name="password"
          type="password"
          autoComplete={mode === "register" ? "new-password" : "current-password"}
          required
          minLength={mode === "register" ? 8 : 1}
          value={password}
          onChange={(event) => setPassword(event.target.value)}
          className="mt-1 block w-full border border-line bg-ivory px-3 py-2.5 text-sm"
          aria-invalid={Boolean(fieldErrors.password)}
        />
        {mode === "register" ? (
          <p className="mt-1 text-xs text-ink-soft">At least 8 characters, with a letter and a number.</p>
        ) : null}
        {fieldErrors.password ? <p className="mt-1 text-xs text-clay-dark">{fieldErrors.password}</p> : null}
      </div>

      {error ? (
        <p role="alert" className="border border-clay/40 bg-clay/5 px-3 py-2 text-sm text-clay-dark">
          {error}
        </p>
      ) : null}

      <button
        type="submit"
        disabled={state === "sending"}
        className="w-full bg-ink px-6 py-3 text-sm font-medium text-ivory hover:bg-clay-dark disabled:opacity-50"
      >
        {state === "sending" ? "Please wait…" : mode === "register" ? "Create account" : "Sign in"}
      </button>

      <p className="text-center text-xs text-ink-soft">
        {mode === "register" ? (
          <>
            Already have an account?{" "}
            <Link href={`/login?next=${encodeURIComponent(next)}`} className="text-clay underline underline-offset-4">
              Sign in
            </Link>
          </>
        ) : (
          <>
            New here?{" "}
            <Link href={`/register?next=${encodeURIComponent(next)}`} className="text-clay underline underline-offset-4">
              Create an account
            </Link>
          </>
        )}
      </p>
    </form>
  );
}
