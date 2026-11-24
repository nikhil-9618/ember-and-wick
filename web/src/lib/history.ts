import type { D1Database, D1PreparedStatement } from "./types-d1";
import { randomId } from "./crypto";
import { allRows } from "./db";

export type HistoryActorType = "customer" | "admin" | "system" | "webhook";

export interface StatusActor {
  type: HistoryActorType;
  id?: string | null;
  /** Human-readable who: an email, "Razorpay webhook", "Ember & Wick". */
  label?: string | null;
}

export interface StatusHistoryEvent {
  orderId: string;
  fromStatus: string | null;
  toStatus: string;
  actor: StatusActor;
  reason?: string | null;
  at?: string;
}

export interface StatusHistoryEntry {
  id: string;
  fromStatus: string | null;
  toStatus: string;
  actorType: string;
  actorLabel: string | null;
  reason: string | null;
  createdAt: string;
}

export const SYSTEM_ACTOR: StatusActor = { type: "system", label: "Ember & Wick" };

/**
 * Statement form so a status change and its history row are written in the same
 * D1 batch. If the status update fails, the history row cannot survive without it.
 */
export function statusHistoryStatement(db: D1Database, event: StatusHistoryEvent): D1PreparedStatement {
  return db
    .prepare(
      `INSERT INTO order_status_history (id, order_id, from_status, to_status, actor_type, actor_id, actor_label, reason, created_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    )
    .bind(
      randomId("osh"),
      event.orderId,
      event.fromStatus,
      event.toStatus,
      event.actor.type,
      event.actor.id ?? null,
      event.actor.label ?? null,
      event.reason ?? null,
      event.at ?? new Date().toISOString(),
    );
}

export async function listStatusHistory(orderId: string): Promise<StatusHistoryEntry[]> {
  const rows = await allRows<{
    id: string;
    from_status: string | null;
    to_status: string;
    actor_type: string;
    actor_label: string | null;
    reason: string | null;
    created_at: string;
  }>(
    `SELECT id, from_status, to_status, actor_type, actor_label, reason, created_at
       FROM order_status_history WHERE order_id = ? ORDER BY created_at ASC, id ASC`,
    [orderId],
  );
  return rows.map((row) => ({
    id: row.id,
    fromStatus: row.from_status,
    toStatus: row.to_status,
    actorType: row.actor_type,
    actorLabel: row.actor_label,
    reason: row.reason,
    createdAt: row.created_at,
  }));
}
