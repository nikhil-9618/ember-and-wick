import { z } from "zod";
import { getDb } from "@/lib/db";
import { assertSameOrigin, apiRoute, json, readJson } from "@/lib/http";
import { requireUser } from "@/lib/auth";
import { listNotifications } from "@/lib/services/notify";

export const GET = apiRoute(async (request) => {
  const { user } = await requireUser(request);
  const items = await listNotifications(user.id);
  return json({ items, unread: items.filter((item) => !item.readAt).length });
});

export const POST = apiRoute(async (request) => {
  assertSameOrigin(request);
  const { user } = await requireUser(request);
  const input = await readJson(request, z.object({ notificationId: z.string().min(3).max(80).optional() }));
  const db = await getDb();
  const now = new Date().toISOString();

  if (input.notificationId) {
    await db.notifications.updateOne({ _id: input.notificationId, user_id: user.id }, { $set: { read_at: now } });
  } else {
    await db.notifications.updateMany({ user_id: user.id, read_at: null }, { $set: { read_at: now } });
  }

  return json({ ok: true });
});
