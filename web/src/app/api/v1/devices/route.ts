import { z } from "zod";
import { getDb } from "@/lib/db";
import { randomId } from "@/lib/crypto";
import { assertSameOrigin, apiRoute, json, readJson } from "@/lib/http";
import { requireUser } from "@/lib/auth";

/**
 * Stores an Expo push token for the signed-in user. Re-registering the same
 * device updates ownership rather than creating duplicates.
 */
export const POST = apiRoute(async (request) => {
  assertSameOrigin(request);
  const { user } = await requireUser(request);
  const input = await readJson(
    request,
    z.object({
      token: z.string().min(8).max(400),
      platform: z.enum(["ios", "android"]),
    }),
  );

  const db = await getDb();
  const now = new Date().toISOString();
  await db
    .prepare(
      `INSERT INTO device_tokens (id, user_id, token, platform, created_at, last_seen_at)
       VALUES (?, ?, ?, ?, ?, ?)
       ON CONFLICT(token) DO UPDATE SET user_id = excluded.user_id, last_seen_at = excluded.last_seen_at`,
    )
    .bind(randomId("dev"), user.id, input.token, input.platform, now, now)
    .run();

  return json({ ok: true });
});

export const DELETE = apiRoute(async (request) => {
  assertSameOrigin(request);
  const { user } = await requireUser(request);
  const token = new URL(request.url).searchParams.get("token");
  if (!token) {
    return json({ error: { code: "validation_error", message: "token is required." } }, { status: 422 });
  }
  const db = await getDb();
  await db.prepare("DELETE FROM device_tokens WHERE token = ? AND user_id = ?").bind(token, user.id).run();
  return json({ ok: true });
});
