"use client";

import { useState } from "react";
import { api, errorMessage } from "@/lib/client/api";

interface Item {
  id: string;
  type: string;
  title: string;
  body: string;
  readAt: string | null;
  createdAt: string;
}

export function NotificationList({ initial }: { initial: Item[] }) {
  const [items, setItems] = useState(initial);
  const [error, setError] = useState<string | null>(null);
  const unread = items.filter((item) => !item.readAt).length;

  async function markAllRead() {
    setError(null);
    try {
      await api("/api/v1/notifications", { method: "POST", body: {} });
      const now = new Date().toISOString();
      setItems(items.map((item) => ({ ...item, readAt: item.readAt ?? now })));
    } catch (issue) {
      setError(errorMessage(issue));
    }
  }

  if (items.length === 0) {
    return <p className="mt-4 text-sm text-ink-soft">No updates yet. Order confirmations and shipping notices appear here.</p>;
  }

  return (
    <div className="mt-4">
      {unread > 0 ? (
        <button type="button" onClick={markAllRead} className="mb-3 text-xs text-clay hover:underline">
          Mark all as read ({unread})
        </button>
      ) : null}
      <ul className="divide-y divide-line border-y border-line">
        {items.slice(0, 8).map((item) => (
          <li key={item.id} className={`py-3 text-sm ${item.readAt ? "opacity-70" : ""}`}>
            <p className="font-medium">{item.title}</p>
            <p className="mt-0.5 text-ink-soft">{item.body}</p>
            <p className="mt-1 text-xs text-ink-soft">
              {new Date(item.createdAt).toLocaleDateString("en-IN", { dateStyle: "medium" })}
            </p>
          </li>
        ))}
      </ul>
      {error ? <p role="alert" className="mt-2 text-xs text-clay-dark">{error}</p> : null}
    </div>
  );
}
