"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { api, errorMessage } from "@/lib/client/api";

interface Props {
  mode: "login" | "register";
  next: string;
}

interface OtpChallenge {
  challengeId: string;
  email: string;
  expiresAt: string;
  expiresInSeconds: number;
  delivery: "email" | "demo";
  demoCode?: string;
}

/**
 * Sign-in happens in two steps: password, then a single-use code. The code is
 * emailed when a mail provider is configured; a demo deployment shows it on
 * screen instead and says so plainly.
 */
export function AuthForm({ mode, next }: Props) {
  const router = useRouter();
  const [step, setStep] = useState<"credentials" | "code">("credentials");
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [password, setPassword] = useState("");
  const [code, setCode] = useState("");
  const [challenge, setChallenge] = useState<OtpChallenge | null>(null);
  const [resendIn, setResendIn] = useState(0);
  const [state, setState] = useState<"idle" | "sending">("idle");
  const [error, setError] = useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});

  useEffect(() => {
    if (resendIn <= 0) return;
    const timer = window.setTimeout(() => setResendIn((seconds) => seconds - 1), 1000);
    return () => window.clearTimeout(timer);
  }, [resendIn]);

  function handleError(issue: unknown) {
    const withDetails = issue as { details?: { path: string; message: string }[] };
    if (Array.isArray(withDetails.details)) {
      setFieldErrors(Object.fromEntries(withDetails.details.map((detail) => [detail.path, detail.message])));
    }
    setError(errorMessage(issue));
  }

  async function requestCode() {
    const started = await api<OtpChallenge>("/api/v1/auth/login", {
      method: "POST",
      body: { email, password },
    });
    setChallenge(started);
    setCode("");
    setStep("code");
    setResendIn(30);
    setError(null);
  }

  async function submitCredentials(event: React.FormEvent) {
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
        router.replace(next.startsWith("/") ? next : "/account");
        router.refresh();
        return;
      }
      await requestCode();
    } catch (issue) {
      handleError(issue);
    } finally {
      setState("idle");
    }
  }

  async function submitCode(event: React.FormEvent) {
    event.preventDefault();
    if (!challenge) return;
    setState("sending");
    setError(null);
    try {
      await api("/api/v1/auth/otp/verify", {
        method: "POST",
        body: { challengeId: challenge.challengeId, code },
      });
      router.replace(next.startsWith("/") ? next : "/account");
      router.refresh();
    } catch (issue) {
      handleError(issue);
      setState("idle");
    }
  }

  async function resendCode() {
    if (resendIn > 0) return;
    setState("sending");
    setError(null);
    try {
      await requestCode();
    } catch (issue) {
      handleError(issue);
      setState("idle");
    }
  }

  if (step === "code" && challenge) {
    return (
      <form onSubmit={submitCode} className="space-y-4 page-enter" noValidate>
        <div>
          <p className="eyebrow">Step 2 of 2</p>
          <p className="mt-2 text-sm text-ink-soft">
            Enter the 6-digit code we sent to <span className="text-ink">{challenge.email}</span>. It expires in 10
            minutes.
          </p>
        </div>

        {challenge.delivery === "demo" && challenge.demoCode ? (
          <p className="border border-sand-deep bg-sand/50 px-3 py-2 text-xs text-ink-soft">
            Demo store: email delivery is off, so your code is{" "}
            <span className="font-medium tracking-[0.2em] text-ink">{challenge.demoCode}</span>
          </p>
        ) : (
          <p className="border border-sage/40 bg-sage/10 px-3 py-2 text-xs text-ink-soft">
            Check your inbox and spam folder. The code is valid for 10 minutes and works once.
          </p>
        )}

        <div>
          <label htmlFor="otp" className="eyebrow">
            Sign-in code
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
            aria-invalid={Boolean(error)}
          />
          {fieldErrors.code ? <p className="mt-1 text-xs text-clay-dark">{fieldErrors.code}</p> : null}
        </div>

        {error ? (
          <p role="alert" className="border border-clay/40 bg-clay/5 px-3 py-2 text-sm text-clay-dark">
            {error}
          </p>
        ) : null}

        <button
          type="submit"
          disabled={state === "sending" || code.length !== 6}
          className="w-full bg-ink px-6 py-3 text-sm font-medium text-ivory hover:bg-clay-dark disabled:opacity-50"
        >
          {state === "sending" ? "Verifying…" : "Verify and sign in"}
        </button>

        <div className="flex items-center justify-between text-xs">
          <button
            type="button"
            onClick={() => {
              setStep("credentials");
              setChallenge(null);
              setCode("");
              setError(null);
            }}
            className="text-ink-soft underline underline-offset-4 hover:text-ink"
          >
            Use a different email
          </button>
          <button
            type="button"
            onClick={resendCode}
            disabled={resendIn > 0 || state === "sending"}
            className="text-clay underline underline-offset-4 disabled:no-underline disabled:opacity-60"
          >
            {resendIn > 0 ? `Resend code in ${resendIn}s` : "Resend code"}
          </button>
        </div>
      </form>
    );
  }

  return (
    <form onSubmit={submitCredentials} className="space-y-4" noValidate>
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
        ) : (
          <p className="mt-1 text-xs text-ink-soft">We&apos;ll send a one-time code next.</p>
        )}
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
        {state === "sending"
          ? "Please wait…"
          : mode === "register"
            ? "Create account"
            : "Continue"}
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
