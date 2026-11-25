import { z } from "zod";
import { getDb } from "@/lib/db";
import { assertSameOrigin, apiRoute, json, readJson } from "@/lib/http";
import { reviewModerationSchema } from "@/lib/validation";
import { notFound } from "@/lib/errors";
import { requireAdmin } from "@/lib/auth";
import { refreshProductRating } from "@/lib/services/catalog";
import { auditActor, recordAudit } from "@/lib/services/audit";

export const GET = apiRoute(async (request) => {
  await requireAdmin(request);
  const status = new URL(request.url).searchParams.get("status");
  const filter = status && ["pending", "published", "rejected"].includes(status) ? status : null;
  const db = await getDb();
  const query = filter ? ({ status: filter } as any) : {};
  const rows = await db.reviews.find(query).sort({ created_at: -1 }).limit(200).toArray();
  const productIds = [...new Set((rows as any[]).map((r) => r.product_id))];
  const userIds = [...new Set((rows as any[]).map((r) => r.user_id))];
  const [products, users] = await Promise.all([
    productIds.length ? db.products.find({ _id: { $in: productIds } }).toArray() : Promise.resolve([]),
    userIds.length ? db.users.find({ _id: { $in: userIds } }).toArray() : Promise.resolve([]),
  ]);
  const productMap = new Map((products as any[]).map((p) => [p._id, p]));
  const userMap = new Map((users as any[]).map((u) => [u._id, u]));
  const reviews = (rows as any[]).map((r) => ({
    id: r._id,
    rating: r.rating,
    title: r.title,
    body: r.body,
    status: r.status,
    created_at: r.created_at,
    product_name: productMap.get(r.product_id)?.name ?? "",
    product_id: r.product_id,
    author: userMap.get(r.user_id)?.name ?? "",
    email: userMap.get(r.user_id)?.email ?? "",
  }));
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

  const review = await db.reviews.findOne({ _id: input.reviewId });
  if (!review) throw notFound("Review not found.");

  await db.reviews.updateOne({ _id: input.reviewId }, { $set: { status: input.status } });
  await refreshProductRating((review as any).product_id);
  await recordAudit({
    actor: auditActor(auth),
    action: "review.moderated",
    entityType: "review",
    entityId: input.reviewId,
    summary: `Review ${input.reviewId} marked ${input.status}`,
    detail: { productId: (review as any).product_id, status: input.status },
  });

  return json({ ok: true });
});