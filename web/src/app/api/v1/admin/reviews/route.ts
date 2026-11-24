import { z } from "zod";
import { allRows, getDb } from "@/lib/db";
import { assertSameOrigin, apiRoute, json, readJson } from "@/lib/http";
import { reviewModerationSchema } from "@/lib/validation";
import { notFound } from "@/lib/errors";
import { requireAdmin } from "@/lib/auth";
import { refreshProductRating } from "@/lib/services/catalog";
import { auditActor, recordAudit } from "@/lib/services/audit";

export const GET = apiRoute(async (request) => {
  await requireAdmin(request);
  const status = new URL(request.url).searchParams.get("status");
  const where = status && ["pending", "published", "rejected"].includes(status) ? "WHERE r.status = ?" : "";
  const bindings = where ? [status] : [];
  const reviews = await allRows(
    `SELECT r.id, r.rating, r.title, r.body, r.status, r.created_at, p.name AS product_name, p.id AS product_id,
            u.name AS author, u.email
       FROM reviews r JOIN products p ON p.id = r.product_id JOIN users u ON u.id = r.user_id
       ${where}
      ORDER BY r.created_at DESC LIMIT 200`,
    bindings,
  );
  return json({ reviews });
});

export const PATCH = apiRoute(async (request) => {
  assertSameOrigin(request);
  const auth = await requireAdmin(request);
  const input = await readJson(
    request,
    reviewModerationSchema.extend({ reviewId: z.string().min(3).max(80) }),
  );
  const db = await getDb();

  const review = await db
    .prepare("SELECT id, product_id FROM reviews WHERE id = ?")
    .bind(input.reviewId)
    .first<{ id: string; product_id: string }>();
  if (!review) throw notFound("Review not found.");

  await db.prepare("UPDATE reviews SET status = ? WHERE id = ?").bind(input.status, review.id).run();
  await refreshProductRating(review.product_id);
  await recordAudit({
    actor: auditActor(auth),
    action: "review.moderated",
    entityType: "review",
    entityId: review.id,
    summary: `Review ${review.id} marked ${input.status}`,
    detail: { productId: review.product_id, status: input.status },
  });

  return json({ ok: true });
});
