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
    await db
      .prepare("UPDATE notifications SET read_at = ? WHERE id = ? AND user_id = ?")
      .bind(now, input.notificationId, user.id)
      .run();
  } else {
    await db
      .prepare("UPDATE notifications SET read_at = ? WHERE user_id = ? AND read_at IS NULL")
      .bind(now, user.id)
      .run();
  }

  return json({ ok: true });
});
