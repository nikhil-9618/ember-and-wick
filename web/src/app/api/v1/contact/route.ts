import { getDb } from "@/lib/db";
import { randomId } from "@/lib/crypto";
import { assertSameOrigin, apiRoute, clientIp, json, readJson } from "@/lib/http";
import { contactSchema } from "@/lib/validation";
import { rateLimited } from "@/lib/errors";
import { checkRateLimit } from "@/lib/rate-limit";

export const POST = apiRoute(async (request) => {
  assertSameOrigin(request);
  const db = await getDb();

  const limit = await checkRateLimit(db, `contact:${clientIp(request)}`, 5, 60 * 60);
  if (!limit.allowed) throw rateLimited("You've already sent us a few messages. Please try again later.");

  const input = await readJson(request, contactSchema);
  await db
    .prepare("INSERT INTO contact_messages (id, name, email, subject, message, status, created_at) VALUES (?, ?, ?, ?, ?, 'new', ?)")
    .bind(randomId("msg"), input.name, input.email, input.subject || null, input.message, new Date().toISOString())
    .run();

  return json({ ok: true, message: "Thanks for writing in. We reply within one business day." }, { status: 201 });
});
