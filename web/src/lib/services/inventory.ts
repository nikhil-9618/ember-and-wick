import { randomId } from "../crypto";
import type { Store } from "../db";

export type InventoryReason = "order_reserved" | "order_released" | "admin_adjustment" | "restock";
export type InventoryActorType = "customer" | "admin" | "system";

export interface InventoryMovementInput {
  variantId: string;
  delta: number;
  reason: InventoryReason;
  actor: { type: InventoryActorType; id?: string | null };
  referenceType?: string | null;
  referenceId?: string | null;
  note?: string | null;
  at?: string;
}

export interface InventoryMovementRow {
  id: string;
  variantId: string;
  delta: number;
  reason: string;
  referenceType: string | null;
  referenceId: string | null;
  actorType: string;
  actorId: string | null;
  note: string | null;
  createdAt: string;
}

export async function insertInventoryMovement(db: Store, input: InventoryMovementInput): Promise<void> {
  if (!Number.isInteger(input.delta) || input.delta === 0) {
    throw new Error("inventory movement delta must be a non-zero integer");
  }
  await db.inventory_movements.insertOne({
    _id: randomId("inv"),
    variant_id: input.variantId,
    delta: input.delta,
    reason: input.reason,
    reference_type: input.referenceType ?? null,
    reference_id: input.referenceId ?? null,
    actor_type: input.actor.type,
    actor_id: input.actor.id ?? null,
    note: input.note ?? null,
    created_at: input.at ?? new Date().toISOString(),
  } as any);
}

export async function listVariantMovements(variantId: string, limit = 50): Promise<InventoryMovementRow[]> {
  const { getDb } = await import("../db");
  const db = await getDb();
  const rows = await db.inventory_movements
    .find({ variant_id: variantId })
    .sort({ created_at: -1, _id: -1 })
    .limit(Math.min(Math.max(limit, 1), 200))
    .toArray();
  return rows.map((row: any) => ({
    id: row._id,
    variantId: row.variant_id,
    delta: row.delta,
    reason: row.reason,
    referenceType: row.reference_type,
    referenceId: row.reference_id,
    actorType: row.actor_type,
    actorId: row.actor_id,
    note: row.note,
    createdAt: row.created_at,
  }));
}
