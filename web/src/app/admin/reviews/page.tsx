import type { Metadata } from "next";
import { allRows } from "@/lib/db";
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
  const reviews = await allRows<{
    id: string;
    rating: number;
    title: string | null;
    body: string;
    status: string;
    created_at: string;
    product_name: string;
    product_id: string;
    author: string;
    email: string;
  }>(
    `SELECT r.id, r.rating, r.title, r.body, r.status, r.created_at, p.name AS product_name, p.id AS product_id,
            u.name AS author, u.email
       FROM reviews r JOIN products p ON p.id = r.product_id JOIN users u ON u.id = r.user_id
      WHERE r.status = ?
      ORDER BY r.created_at DESC LIMIT 200`,
    [filter],
  );

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
