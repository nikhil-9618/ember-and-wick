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
  await db.contact_messages.insertOne({
    _id: randomId("msg"),
    name: input.name,
    email: input.email,
    subject: input.subject || null,
    message: input.message,
    status: "new",
    created_at: new Date().toISOString(),
  } as any);

  return json({ ok: true, message: "Thanks for writing in. We reply within one business day." }, { status: 201 });
});
