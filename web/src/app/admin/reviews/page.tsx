import type { Metadata } from "next";
import { getDb } from "@/lib/db";
import { ReviewActions } from "@/components/admin/review-actions";
import { StarRating } from "@/components/site/star-rating";

export const metadata: Metadata = { title: "Reviews", robots: { index: false, follow: false } };

export default async function AdminReviewsPage({
  searchParams,
}: {
  searchParams: Promise<{ status?: string }>;
}) {
  const { status } = await searchParams;
  const filter = status && ["pending", "published", "rejected"].includes(status) ? status : "pending";
  const db = await getDb();
  const rows = await db.reviews.find({ status: filter } as any).sort({ created_at: -1 }).limit(200).toArray();
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

  return (
    <div>
      <h1 className="text-2xl">Reviews</h1>
      <p className="mt-1 text-sm text-ink-soft">
        Only published reviews appear on the storefront and count toward the product rating.
      </p>

      <nav aria-label="Filter reviews" className="mt-4 flex gap-2 text-xs">
        {["pending", "published", "rejected"].map((value) => (
          <a
            key={value}
            href={`/admin/reviews?status=${value}`}
            className={`border px-2.5 py-1 uppercase tracking-wider ${
              filter === value ? "border-ink bg-ink text-ivory" : "border-line text-ink-soft"
            }`}
          >
            {value}
          </a>
        ))}
      </nav>

      {reviews.length === 0 ? (
        <p className="mt-6 border border-line bg-sand/30 p-6 text-sm text-ink-soft">No {filter} reviews.</p>
      ) : (
        <ul className="mt-6 space-y-6">
          {reviews.map((review) => (
            <li key={review.id} className="border border-line p-4">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <p className="text-sm font-medium">{review.product_name}</p>
                  <p className="text-xs text-ink-soft">
                    {review.author} · {review.email} ·{" "}
                    {new Date(review.created_at).toLocaleDateString("en-IN", { dateStyle: "medium" })}
                  </p>
                </div>
                <StarRating value={review.rating} />
              </div>
              {review.title ? <p className="mt-2 text-sm font-medium">{review.title}</p> : null}
              <p className="mt-1 text-sm text-ink-soft">{review.body}</p>
              <ReviewActions reviewId={review.id} status={review.status} />
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
