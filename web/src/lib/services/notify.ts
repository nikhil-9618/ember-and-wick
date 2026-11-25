import { randomId } from "../crypto";
import { getDb } from "../db";
import type { Store } from "../db";

export interface NotificationInput {
  userId: string;
  type: string;
  title: string;
  body: string;
  data?: Record<string, unknown>;
}

export async function insertNotification(db: Store, input: NotificationInput): Promise<void> {
  await db.notifications.insertOne({
    _id: randomId("ntf"),
    user_id: input.userId,
    type: input.type,
    title: input.title,
    body: input.body,
    data_json: input.data ? JSON.stringify(input.data) : null,
    read_at: null,
    created_at: new Date().toISOString(),
  } as any);
}

export async function notify(db: Store, input: NotificationInput): Promise<void> {
  await insertNotification(db, input);
}

export async function listNotifications(userId: string) {
  const db = await getDb();
  const rows = await db.notifications
    .find({ user_id: userId })
    .sort({ created_at: -1 })
    .limit(50)
    .toArray();
  return rows.map((row: any) => ({
    id: row._id,
    type: row.type,
    title: row.title,
    body: row.body,
    data: row.data_json ? (JSON.parse(row.data_json) as Record<string, unknown>) : null,
    readAt: row.read_at,
    createdAt: row.created_at,
  }));
}
