"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { api, errorMessage } from "@/lib/client/api";
import { Icon } from "@/components/ui/icons";

interface Props {
  mode: "login" | "register";
  next: string;
}

interface SignupChallenge {
  challengeId: string;
  email: string;
  expiresAt: string;
  expiresInSeconds: number;
}

/**
 * Sign-in is password only for an account whose address was already verified.
 * Sign-up is two steps: details, then the six-digit code emailed to the address
 * being claimed. Only the code creates the session.
 */
export function AuthForm({ mode, next }: Props) {
  const router = useRouter();
  const [step, setStep] = useState<"details" | "verify">("details");
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [password, setPassword] = useState("");
  const [code, setCode] = useState("");
  const [challenge, setChallenge] = useState<SignupChallenge | null>(null);
  const [resendIn, setResendIn] = useState(0);
  const [state, setState] = useState<"idle" | "sending">("idle");
  const [error, setError] = useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});

  useEffect(() => {
    if (resendIn <= 0) return;
    const timer = window.setTimeout(() => setResendIn((seconds) => seconds - 1), 1000);
    return () => window.clearTimeout(timer);
  }, [resendIn]);

  const target = next.startsWith("/") ? next : "/account";

  function handleError(issue: unknown) {
    const withDetails = issue as { details?: { path: string; message: string }[] };
    if (Array.isArray(withDetails.details)) {
      setFieldErrors(Object.fromEntries(withDetails.details.map((detail) => [detail.path, detail.message])));
    }
    setError(errorMessage(issue));
  }

  function requestVerification() {
    return api<SignupChallenge>("/api/v1/auth/register", {
      method: "POST",
      body: { name, email, password, phone: phone || undefined },
    });
  }

  async function submitDetails(event: React.FormEvent) {
    event.preventDefault();
    setState("sending");
    setError(null);
    setFieldErrors({});
    try {
      if (mode === "register") {
        const started = await requestVerification();
        setChallenge(started);
        setCode("");
        setStep("verify");
        setResendIn(30);
        return;
      }
      await api("/api/v1/auth/login", { method: "POST", body: { email, password } });
      router.replace(target);
      router.refresh();
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
      await api("/api/v1/auth/register/verify", {
        method: "POST",
        body: { challengeId: challenge.challengeId, code },
      });
      router.replace(target);
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
      const started = await requestVerification();
      setChallenge(started);
      setCode("");
      setResendIn(30);
    } catch (issue) {
      handleError(issue);
    } finally {
      setState("idle");
    }
  }

  if (step === "verify" && challenge) {
    return (
      <form onSubmit={submitCode} className="space-y-4 page-enter" noValidate>
        <div className="flex items-start gap-3">
          <span className="mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center border border-line bg-sand/40 text-clay">
            <Icon name="mail" size={18} />
          </span>
          <div>
            <p className="eyebrow">Step 2 of 2 · Verify email</p>
            <p className="mt-2 text-sm text-ink-soft">
              We emailed a 6-digit code to <span className="text-ink">{challenge.email}</span>. Enter it to finish
              creating your account. It expires in 10 minutes.
            </p>
          </div>
        </div>

        <div>
          <label htmlFor="otp" className="eyebrow">
            Verification code
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
          className="flex w-full items-center justify-center gap-2 bg-ink px-6 py-3 text-sm font-medium text-ivory transition-colors hover:bg-clay-dark disabled:opacity-50"
        >
          <Icon name="check" size={16} />
          {state === "sending" ? "Verifying…" : "Verify and create account"}
        </button>

        <div className="flex items-center justify-between text-xs">
          <button
            type="button"
            onClick={() => {
              setStep("details");
              setChallenge(null);
              setCode("");
              setError(null);
            }}
            className="text-ink-soft underline underline-offset-4 hover:text-ink"
          >
            Change details
          </button>
          <button
            type="button"
            onClick={resendCode}
            disabled={resendIn > 0 || state === "sending"}
            className="flex items-center gap-1 text-clay underline underline-offset-4 disabled:no-underline disabled:opacity-60"
          >
            <Icon name="refresh" size={13} />
            {resendIn > 0 ? `Resend in ${resendIn}s` : "Resend code"}
          </button>
        </div>
      </form>
    );
  }

  const fieldClass =
    "mt-1 block w-full border border-line bg-ivory py-2.5 pl-10 pr-3 text-sm outline-none transition-colors focus:border-clay";

  return (
    <form onSubmit={submitDetails} className="space-y-4" noValidate>
      {mode === "register" ? (
        <div>
          <label htmlFor="name" className="eyebrow">
            Full name
          </label>
          <div className="relative">
            <Icon name="user" size={16} className="pointer-events-none absolute left-3 top-1/2 mt-0.5 -translate-y-1/2 text-ink-soft" />
            <input
              id="name"
              name="name"
              autoComplete="name"
              required
              value={name}
              onChange={(event) => setName(event.target.value)}
              className={fieldClass}
              aria-invalid={Boolean(fieldErrors.name)}
            />
          </div>
          {fieldErrors.name ? <p className="mt-1 text-xs text-clay-dark">{fieldErrors.name}</p> : null}
        </div>
      ) : null}

      <div>
        <label htmlFor="email" className="eyebrow">
          Email
        </label>
        <div className="relative">
          <Icon name="mail" size={16} className="pointer-events-none absolute left-3 top-1/2 mt-0.5 -translate-y-1/2 text-ink-soft" />
          <input
            id="email"
            name="email"
            type="email"
            autoComplete="email"
            required
            value={email}
            onChange={(event) => setEmail(event.target.value)}
            className={fieldClass}
            aria-invalid={Boolean(fieldErrors.email)}
          />
        </div>
        {fieldErrors.email ? <p className="mt-1 text-xs text-clay-dark">{fieldErrors.email}</p> : null}
      </div>

      {mode === "register" ? (
        <div>
          <label htmlFor="phone" className="eyebrow">
            Phone (optional)
          </label>
          <div className="relative">
            <Icon name="phone" size={16} className="pointer-events-none absolute left-3 top-1/2 mt-0.5 -translate-y-1/2 text-ink-soft" />
            <input
              id="phone"
              name="phone"
              type="tel"
              autoComplete="tel"
              value={phone}
              onChange={(event) => setPhone(event.target.value)}
              className={fieldClass}
              aria-invalid={Boolean(fieldErrors.phone)}
            />
          </div>
          {fieldErrors.phone ? <p className="mt-1 text-xs text-clay-dark">{fieldErrors.phone}</p> : null}
        </div>
      ) : null}

      <div>
        <label htmlFor="password" className="eyebrow">
          Password
        </label>
        <div className="relative">
          <Icon name="lock" size={16} className="pointer-events-none absolute left-3 top-1/2 mt-0.5 -translate-y-1/2 text-ink-soft" />
          <input
            id="password"
            name="password"
            type="password"
            autoComplete={mode === "register" ? "new-password" : "current-password"}
            required
            minLength={mode === "register" ? 8 : 1}
            value={password}
            onChange={(event) => setPassword(event.target.value)}
            className={fieldClass}
            aria-invalid={Boolean(fieldErrors.password)}
          />
        </div>
        {mode === "register" ? (
          <p className="mt-1 flex items-center gap-1.5 text-xs text-ink-soft">
            <Icon name="shield" size={13} />
            At least 8 characters, with a letter and a number. We&apos;ll email a code to verify the address.
          </p>
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
        className="flex w-full items-center justify-center gap-2 bg-ink px-6 py-3 text-sm font-medium text-ivory transition-colors hover:bg-clay-dark disabled:opacity-50"
      >
        <Icon name={mode === "register" ? "mail" : "arrow-right"} size={16} />
        {state === "sending" ? "Please wait…" : mode === "register" ? "Send verification code" : "Sign in"}
      </button>

      {mode === "login" ? (
        <p className="text-center text-xs text-ink-soft">
          <Link href="/forgot-password" className="text-clay underline underline-offset-4">
            Forgot your password?
          </Link>
        </p>
      ) : null}

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
