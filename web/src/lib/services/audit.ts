import { randomId } from "../crypto";
import { getDb } from "../db";
import type { Store } from "../db";
import type { AuthContext } from "../auth";

export interface AuditActor {
  id: string;
  email: string;
}

export interface AuditEntry {
  actor: AuditActor;
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

export async function insertAuditLog(db: Store, entry: AuditEntry): Promise<void> {
  const at = entry.at ?? new Date().toISOString();
  await db.admin_audit_log.insertOne({
    _id: randomId("aud"),
    actor_id: entry.actor.id,
    actor_email: entry.actor.email,
    action: entry.action,
    entity_type: entry.entityType,
    entity_id: entry.entityId ?? null,
    summary: entry.summary,
    detail_json: entry.detail ? JSON.stringify(entry.detail) : null,
    created_at: at,
  } as any);
}

export async function recordAudit(entry: AuditEntry): Promise<void> {
  const db = await getDb();
  await insertAuditLog(db, entry);
}

export async function listAuditEntries(filter: {
  limit?: number;
  entityType?: string;
  entityId?: string;
  action?: string;
} = {}): Promise<AuditLogRow[]> {
  const db = await getDb();
  const query: Record<string, unknown> = {};
  if (filter.entityType) query.entity_type = filter.entityType;
  if (filter.entityId) query.entity_id = filter.entityId;
  if (filter.action) query.action = filter.action;
  const rows = await db.admin_audit_log
    .find(query)
    .sort({ created_at: -1, _id: -1 })
    .limit(Math.min(Math.max(filter.limit ?? 100, 1), 500))
    .toArray();
  return rows.map((row: any) => ({
    id: row._id,
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
