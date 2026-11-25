import { getDb } from "@/lib/db";
import { randomId } from "@/lib/crypto";
import { assertSameOrigin, apiRoute, json, readJson } from "@/lib/http";
import { reviewSchema } from "@/lib/validation";
import { conflict, notFound } from "@/lib/errors";
import { requireUser } from "@/lib/auth";
import { getProductBySlug, listPublishedReviews } from "@/lib/services/catalog";

export const GET = apiRoute<{ params: Promise<{ slug: string }> }>(async (_request, { params }) => {
  const { slug } = await params;
  const product = await getProductBySlug(slug);
  if (!product) throw notFound("We couldn't find that candle.");
  return json({ reviews: await listPublishedReviews(product.id) });
});

export const POST = apiRoute<{ params: Promise<{ slug: string }> }>(async (request, { params }) => {
  assertSameOrigin(request);
  const { user } = await requireUser(request);
  const { slug } = await params;
  const product = await getProductBySlug(slug);
  if (!product) throw notFound("We couldn't find that candle.");

  const input = await readJson(request, reviewSchema);
  const db = await getDb();
  const existing = await db.reviews.findOne({ product_id: product.id, user_id: user.id });
  if (existing) throw conflict("You've already reviewed this candle.");

  await db.reviews.insertOne({
    _id: randomId("rev"),
    product_id: product.id,
    user_id: user.id,
    rating: input.rating,
    title: input.title || null,
    body: input.body,
    status: "pending",
    created_at: new Date().toISOString(),
  } as any);

  return json(
    { ok: true, message: "Thank you — your review will appear once it has been checked." },
    { status: 201 },
  );
});
