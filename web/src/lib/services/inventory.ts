import type { D1Database, D1PreparedStatement } from "../types-d1";
import { randomId } from "../crypto";
import { allRows } from "../db";

export type InventoryReason = "order_reserved" | "order_released" | "admin_adjustment" | "restock";
export type InventoryActorType = "customer" | "admin" | "system";

export interface InventoryMovementInput {
  variantId: string;
  /** Signed: negative reserves stock, positive returns it. Zero is rejected. */
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

/**
 * Returns one movement row. Callers must include it in the same batch as the
 * `product_variants.stock` change so the ledger and the balance never disagree.
 */
export function inventoryMovementStatement(db: D1Database, input: InventoryMovementInput): D1PreparedStatement {
  if (!Number.isInteger(input.delta) || input.delta === 0) {
    throw new Error("inventory movement delta must be a non-zero integer");
  }
  return db
    .prepare(
      `INSERT INTO inventory_movements (id, variant_id, delta, reason, reference_type, reference_id, actor_type, actor_id, note, created_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    )
    .bind(
      randomId("inv"),
      input.variantId,
      input.delta,
      input.reason,
      input.referenceType ?? null,
      input.referenceId ?? null,
      input.actor.type,
      input.actor.id ?? null,
      input.note ?? null,
      input.at ?? new Date().toISOString(),
    );
}

export async function listVariantMovements(variantId: string, limit = 50): Promise<InventoryMovementRow[]> {
  const rows = await allRows<{
    id: string;
    variant_id: string;
    delta: number;
    reason: string;
    reference_type: string | null;
    reference_id: string | null;
    actor_type: string;
    actor_id: string | null;
    note: string | null;
    created_at: string;
  }>(
    `SELECT id, variant_id, delta, reason, reference_type, reference_id, actor_type, actor_id, note, created_at
       FROM inventory_movements WHERE variant_id = ? ORDER BY created_at DESC, id DESC LIMIT ?`,
    [variantId, Math.min(Math.max(limit, 1), 200)],
  );
  return rows.map((row) => ({
    id: row.id,
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
