import type { D1Database, D1PreparedStatement } from "../types-d1";
import { randomId } from "../crypto";
import { allRows, getDb } from "../db";
import type { AuthContext } from "../auth";

export interface AuditActor {
  id: string;
  email: string;
}

export interface AuditEntry {
  actor: AuditActor;
  /** Dotted action name, e.g. "order.status_changed" or "refund.approved". */
  action: string;
  entityType: string;
  entityId?: string | null;
  summary: string;
  detail?: Record<string, unknown> | null;
  at?: string;
}

export interface AuditLogRow {
  id: string;
  actorId: string | null;
  actorEmail: string;
  action: string;
  entityType: string;
  entityId: string | null;
  summary: string;
  detail: Record<string, unknown> | null;
  createdAt: string;
}

export function auditActor(auth: AuthContext): AuditActor {
  return { id: auth.user.id, email: auth.user.email };
}

/** Batching form: the audit row commits with the change it describes, or not at all. */
export function auditStatement(db: D1Database, entry: AuditEntry): D1PreparedStatement {
  return db
    .prepare(
      `INSERT INTO admin_audit_log (id, actor_id, actor_email, action, entity_type, entity_id, summary, detail_json, created_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    )
    .bind(
      randomId("aud"),
      entry.actor.id,
      entry.actor.email,
      entry.action,
      entry.entityType,
      entry.entityId ?? null,
      entry.summary,
      entry.detail ? JSON.stringify(entry.detail) : null,
      entry.at ?? new Date().toISOString(),
    );
}

export async function recordAudit(entry: AuditEntry): Promise<void> {
  const db = await getDb();
  await auditStatement(db, entry).run();
}

export async function listAuditEntries(filter: {
  limit?: number;
  entityType?: string;
  entityId?: string;
  action?: string;
} = {}): Promise<AuditLogRow[]> {
  const where: string[] = [];
  const bindings: unknown[] = [];
  if (filter.entityType) {
    where.push("entity_type = ?");
    bindings.push(filter.entityType);
  }
  if (filter.entityId) {
    where.push("entity_id = ?");
    bindings.push(filter.entityId);
  }
  if (filter.action) {
    where.push("action = ?");
    bindings.push(filter.action);
  }
  const rows = await allRows<{
    id: string;
    actor_id: string | null;
    actor_email: string;
    action: string;
    entity_type: string;
    entity_id: string | null;
    summary: string;
    detail_json: string | null;
    created_at: string;
  }>(
    `SELECT id, actor_id, actor_email, action, entity_type, entity_id, summary, detail_json, created_at
       FROM admin_audit_log
       ${where.length ? `WHERE ${where.join(" AND ")}` : ""}
      ORDER BY created_at DESC, id DESC LIMIT ?`,
    [...bindings, Math.min(Math.max(filter.limit ?? 100, 1), 500)],
  );

  return rows.map((row) => ({
    id: row.id,
    actorId: row.actor_id,
    actorEmail: row.actor_email,
    action: row.action,
    entityType: row.entity_type,
    entityId: row.entity_id,
    summary: row.summary,
    detail: row.detail_json ? (JSON.parse(row.detail_json) as Record<string, unknown>) : null,
    createdAt: row.created_at,
  }));
}
