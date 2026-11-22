"use client";

import { useState } from "react";
import { api, errorMessage } from "@/lib/client/api";

export function ContactForm() {
  const [values, setValues] = useState({ name: "", email: "", subject: "", message: "" });
  const [state, setState] = useState<"idle" | "sending" | "sent">("idle");
  const [error, setError] = useState<string | null>(null);

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    setState("sending");
    setError(null);
    try {
      await api("/api/v1/contact", { method: "POST", body: values });
      setState("sent");
      setValues({ name: "", email: "", subject: "", message: "" });
    } catch (issue) {
      setError(errorMessage(issue));
      setState("idle");
    }
  }

  if (state === "sent") {
    return (
      <div className="border border-sage/50 bg-sage/10 p-6">
        <p className="text-lg">Thank you for writing in.</p>
        <p className="mt-2 text-sm text-ink-soft">We reply within one business day, Monday to Saturday.</p>
        <button type="button" onClick={() => setState("idle")} className="mt-4 text-sm underline underline-offset-4">
          Send another message
        </button>
      </div>
    );
  }

  return (
    <form onSubmit={submit} className="space-y-4 border border-line p-6">
      <label className="block">
        <span className="eyebrow">Your name</span>
        <input
          required
          minLength={2}
          value={values.name}
          onChange={(event) => setValues({ ...values, name: event.target.value })}
          autoComplete="name"
          className="mt-1 w-full border border-line bg-ivory px-3 py-2.5 text-sm"
        />
      </label>
      <label className="block">
        <span className="eyebrow">Email</span>
        <input
          required
          type="email"
          value={values.email}
          onChange={(event) => setValues({ ...values, email: event.target.value })}
          autoComplete="email"
          className="mt-1 w-full border border-line bg-ivory px-3 py-2.5 text-sm"
        />
      </label>
      <label className="block">
        <span className="eyebrow">Order number or subject (optional)</span>
        <input
          value={values.subject}
          onChange={(event) => setValues({ ...values, subject: event.target.value })}
          className="mt-1 w-full border border-line bg-ivory px-3 py-2.5 text-sm"
        />
      </label>
      <label className="block">
        <span className="eyebrow">Message</span>
        <textarea
          required
          minLength={10}
          rows={5}
          maxLength={2000}
          value={values.message}
          onChange={(event) => setValues({ ...values, message: event.target.value })}
          className="mt-1 w-full border border-line bg-ivory px-3 py-2.5 text-sm"
        />
      </label>
      {error ? (
        <p role="alert" className="text-sm text-clay-dark">
          {error}
        </p>
      ) : null}
      <button
        type="submit"
        disabled={state === "sending"}
        className="w-full bg-ink px-6 py-3 text-sm text-ivory hover:bg-clay-dark disabled:opacity-50"
      >
        {state === "sending" ? "Sending…" : "Send message"}
      </button>
    </form>
  );
}
