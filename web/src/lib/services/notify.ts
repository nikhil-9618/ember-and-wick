import type { D1Database, D1PreparedStatement } from "../types-d1";
import { randomId } from "../crypto";
import { getDb } from "../db";

export interface NotificationInput {
  userId: string;
  type: string;
  title: string;
  body: string;
  data?: Record<string, unknown>;
}

export function notificationStatement(db: D1Database, input: NotificationInput): D1PreparedStatement {
  return db
    .prepare(
      "INSERT INTO notifications (id, user_id, type, title, body, data_json, created_at) VALUES (?, ?, ?, ?, ?, ?, ?)",
    )
    .bind(
      randomId("ntf"),
      input.userId,
      input.type,
      input.title,
      input.body,
      input.data ? JSON.stringify(input.data) : null,
      new Date().toISOString(),
    );
}

export async function notify(db: D1Database, input: NotificationInput): Promise<void> {
  await notificationStatement(db, input).run();
}

export async function listNotifications(userId: string) {
  const db = await getDb();
  const rows = await db
    .prepare(
      "SELECT id, type, title, body, data_json, read_at, created_at FROM notifications WHERE user_id = ? ORDER BY created_at DESC LIMIT 50",
    )
    .bind(userId)
    .all<{
      id: string;
      type: string;
      title: string;
      body: string;
      data_json: string | null;
      read_at: string | null;
      created_at: string;
    }>();
  return (rows.results ?? []).map((row) => ({
    id: row.id,
    type: row.type,
    title: row.title,
    body: row.body,
    data: row.data_json ? (JSON.parse(row.data_json) as Record<string, unknown>) : null,
    readAt: row.read_at,
    createdAt: row.created_at,
  }));
}
