"use client";

import { useState } from "react";
import Link from "next/link";
import { api, errorMessage } from "@/lib/client/api";

export function ReviewForm({ slug, signedIn }: { slug: string; signedIn: boolean }) {
  const [rating, setRating] = useState(5);
  const [title, setTitle] = useState("");
  const [body, setBody] = useState("");
  const [state, setState] = useState<"idle" | "sending" | "sent">("idle");
  const [error, setError] = useState<string | null>(null);

  if (!signedIn) {
    return (
      <p className="mt-3 text-sm text-ink-soft">
        <Link href="/login" className="underline underline-offset-4">
          Sign in
        </Link>{" "}
        to share how this candle burned for you.
      </p>
    );
  }

  if (state === "sent") {
    return (
      <p className="mt-3 border border-sage/40 bg-sage/10 px-4 py-3 text-sm text-ink">
        Thank you — your review will appear once it has been checked.
      </p>
    );
  }

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    setState("sending");
    setError(null);
    try {
      await api(`/api/v1/products/${encodeURIComponent(slug)}/reviews`, {
        method: "POST",
        body: { rating, title: title || undefined, body },
      });
      setState("sent");
    } catch (issue) {
      setError(errorMessage(issue));
      setState("idle");
    }
  }

  return (
    <form onSubmit={submit} className="mt-3 space-y-3">
      <div>
        <label htmlFor="rating" className="eyebrow">
          Rating
        </label>
        <select
          id="rating"
          value={rating}
          onChange={(event) => setRating(Number(event.target.value))}
          className="mt-1 block w-full border border-line bg-ivory px-3 py-2 text-sm"
        >
          {[5, 4, 3, 2, 1].map((value) => (
            <option key={value} value={value}>
              {value} star{value === 1 ? "" : "s"}
            </option>
          ))}
        </select>
      </div>
      <div>
        <label htmlFor="review-title" className="eyebrow">
          Headline (optional)
        </label>
        <input
          id="review-title"
          value={title}
          onChange={(event) => setTitle(event.target.value)}
          maxLength={100}
          className="mt-1 block w-full border border-line bg-ivory px-3 py-2 text-sm"
        />
      </div>
      <div>
        <label htmlFor="review-body" className="eyebrow">
          Your review
        </label>
        <textarea
          id="review-body"
          value={body}
          onChange={(event) => setBody(event.target.value)}
          rows={4}
          required
          minLength={10}
          maxLength={2000}
          className="mt-1 block w-full border border-line bg-ivory px-3 py-2 text-sm"
        />
      </div>
      {error ? (
        <p role="alert" className="text-sm text-clay-dark">
          {error}
        </p>
      ) : null}
      <button
        type="submit"
        disabled={state === "sending"}
        className="bg-ink px-5 py-2.5 text-sm text-ivory hover:bg-clay-dark disabled:opacity-50"
      >
        {state === "sending" ? "Sending…" : "Submit review"}
      </button>
    </form>
  );
}
