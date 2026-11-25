import { randomId } from "./crypto";
import { getDb } from "./db";
import type { Store } from "./db";

export type HistoryActorType = "customer" | "admin" | "system" | "webhook";

export interface StatusActor {
  type: HistoryActorType;
  id?: string | null;
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

export async function insertStatusHistory(db: Store, event: StatusHistoryEvent): Promise<void> {
  const at = event.at ?? new Date().toISOString();
  await db.order_status_history.insertOne({
    _id: randomId("osh"),
    order_id: event.orderId,
    from_status: event.fromStatus,
    to_status: event.toStatus,
    actor_type: event.actor.type,
    actor_id: event.actor.id ?? null,
    actor_label: event.actor.label ?? null,
    reason: event.reason ?? null,
    created_at: at,
  } as any);
}

export async function listStatusHistory(orderId: string): Promise<StatusHistoryEntry[]> {
  const db = await getDb();
  const rows = await db.order_status_history.find({ order_id: orderId }).sort({ created_at: 1, _id: 1 }).toArray();
  return rows.map((row: any) => ({
    id: row._id,
    fromStatus: row.from_status,
    toStatus: row.to_status,
    actorType: row.actor_type,
    actorLabel: row.actor_label,
    reason: row.reason,
    createdAt: row.created_at,
  }));
}
