import { z } from "zod";
import { getDb } from "@/lib/db";
import { randomId } from "@/lib/crypto";
import { assertSameOrigin, apiRoute, json, readJson } from "@/lib/http";
import { requireUser } from "@/lib/auth";

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
  try {
    await db.device_tokens.insertOne({
      _id: randomId("dev"),
      user_id: user.id,
      token: input.token,
      platform: input.platform,
      created_at: now,
      last_seen_at: now,
    } as any);
  } catch {
    await db.device_tokens.updateOne(
      { token: input.token },
      { $set: { user_id: user.id, last_seen_at: now } },
    );
  }

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
  await db.device_tokens.deleteOne({ token, user_id: user.id });
  return json({ ok: true });
});