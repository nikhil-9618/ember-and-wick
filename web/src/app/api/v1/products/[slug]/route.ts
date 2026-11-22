import { apiRoute, json } from "@/lib/http";
import { notFound } from "@/lib/errors";
import { getProductBySlug, listPublishedReviews } from "@/lib/services/catalog";

export const GET = apiRoute<{ params: Promise<{ slug: string }> }>(async (_request, { params }) => {
  const { slug } = await params;
  const product = await getProductBySlug(slug);
  if (!product) throw notFound("We couldn't find that candle.");
  const reviews = await listPublishedReviews(product.id);
  return json({ product, reviews }, { cache: "public" });
});
