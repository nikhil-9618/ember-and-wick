import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import { notFound } from "next/navigation";
import { PurchasePanel } from "@/components/product/purchase-panel";
import { ReviewForm } from "@/components/product/review-form";
import { StarRating } from "@/components/site/star-rating";
import { getProductBySlug, listPublishedReviews, listProducts } from "@/lib/services/catalog";
import { getCurrentUser } from "@/lib/auth";
import { getDb } from "@/lib/db";
import { BRAND } from "@/lib/brand";
import { formatMoney } from "@/lib/money";

interface PageProps {
  params: Promise<{ slug: string }>;
}

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { slug } = await params;
  const product = await getProductBySlug(slug).catch(() => null);
  if (!product) return { title: "Candle not found" };
  return {
    title: product.name,
    description: product.tagline ?? product.description.slice(0, 150),
    alternates: { canonical: `/products/${product.slug}` },
    openGraph: {
      title: `${product.name} — ${BRAND.name}`,
      description: product.tagline ?? product.description.slice(0, 150),
      images: product.images[0] ? [{ url: product.images[0].url, alt: product.images[0].alt }] : [],
      type: "website",
    },
  };
}

export default async function ProductPage({ params }: PageProps) {
  const { slug } = await params;
  const product = await getProductBySlug(slug);
  if (!product) notFound();

  const [reviews, user, related] = await Promise.all([
    listPublishedReviews(product.id),
    getCurrentUser().catch(() => null),
    listProducts({
      sort: "featured",
      page: 1,
      perPage: 3,
      category: product.categorySlug ?? undefined,
    }).catch(() => ({ items: [] })),
  ]);

  let wishlisted = false;
  if (user) {
    try {
      const db = await getDb();
      const row = await db.wishlist_items.findOne({ user_id: user.id, product_id: product.id });
      wishlisted = Boolean(row);
    } catch {
      wishlisted = false;
    }
  }

  const primary = product.images[0];
  const price = Math.min(...product.variants.map((variant) => variant.price));
  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "Product",
    name: product.name,
    description: product.description,
    image: product.images.map((image) => image.url),
    brand: { "@type": "Brand", name: BRAND.name },
    sku: product.variants[0]?.sku,
    offers: {
      "@type": "Offer",
      priceCurrency: "INR",
      price: (price / 100).toFixed(2),
      availability: product.variants.some((variant) => variant.stock > 0)
        ? "https://schema.org/InStock"
        : "https://schema.org/OutOfStock",
      url: `/products/${product.slug}`,
    },
    ...(product.ratingCount > 0
      ? {
          aggregateRating: {
            "@type": "AggregateRating",
            ratingValue: product.ratingAvg.toFixed(1),
            reviewCount: product.ratingCount,
          },
        }
      : {}),
  };

  return (
    <div className="shell py-10 md:py-16">
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }} />

      <nav aria-label="Breadcrumb" className="mb-8 text-xs text-ink-soft">
        <ol className="flex flex-wrap items-center gap-2">
          <li>
            <Link href="/" className="hover:text-ink">
              Home
            </Link>
          </li>
          <li aria-hidden>/</li>
          <li>
            <Link href="/shop" className="hover:text-ink">
              Shop
            </Link>
          </li>
          {product.categorySlug ? (
            <>
              <li aria-hidden>/</li>
              <li>
                <Link href={`/shop?category=${product.categorySlug}`} className="hover:text-ink">
                  {product.categoryName}
                </Link>
              </li>
            </>
          ) : null}
          <li aria-hidden>/</li>
          <li aria-current="page" className="text-ink">
            {product.name}
          </li>
        </ol>
      </nav>

      <div className="grid gap-10 md:grid-cols-2 md:gap-16">
        <div>
          <div className="relative aspect-4/3 overflow-hidden bg-sand">
            {primary ? (
              <Image
                src={primary.url}
                alt={primary.alt}
                fill
                priority
                sizes="(min-width: 768px) 50vw, 100vw"
                className="object-cover"
              />
            ) : (
              <div className="flex h-full items-center justify-center text-xs text-ink-soft">Image coming soon</div>
            )}
          </div>
          {product.images.length > 1 ? (
            <div className="mt-3 grid grid-cols-4 gap-3">
              {product.images.slice(1).map((image) => (
                <div key={image.url} className="relative aspect-square overflow-hidden bg-sand">
                  <Image src={image.url} alt={image.alt} fill sizes="20vw" className="object-cover" />
                </div>
              ))}
            </div>
          ) : null}
        </div>

        <div>
          <p className="eyebrow">{product.categoryName ?? "Candles"}</p>
          <h1 className="mt-3 text-3xl md:text-4xl">{product.name}</h1>
          {product.tagline ? <p className="mt-2 text-ink-soft">{product.tagline}</p> : null}

          {product.ratingCount > 0 ? (
            <p className="mt-3 flex items-center gap-2 text-sm text-ink-soft">
              <StarRating value={product.ratingAvg} />
              <span>
                {product.ratingAvg.toFixed(1)} · {product.ratingCount} review{product.ratingCount === 1 ? "" : "s"}
              </span>
            </p>
          ) : null}

          <PurchasePanel
            productId={product.id}
            variants={product.variants}
            compareAtPrice={product.compareAtPrice}
            signedIn={Boolean(user)}
            initiallyWishlisted={wishlisted}
          />

          <dl className="mt-8 grid grid-cols-2 gap-4 border-t border-line pt-6 text-sm">
            {product.waxType ? (
              <div>
                <dt className="eyebrow">Wax</dt>
                <dd className="mt-1 text-ink-soft">{product.waxType}</dd>
              </div>
            ) : null}
            {product.wickType ? (
              <div>
                <dt className="eyebrow">Wick</dt>
                <dd className="mt-1 text-ink-soft">{product.wickType}</dd>
              </div>
            ) : null}
            {product.burnTimeHours ? (
              <div>
                <dt className="eyebrow">Burn time</dt>
                <dd className="mt-1 text-ink-soft">up to {product.burnTimeHours} hours</dd>
              </div>
            ) : null}
            {product.scentNotes ? (
              <div>
                <dt className="eyebrow">Scent notes</dt>
                <dd className="mt-1 text-ink-soft">{product.scentNotes}</dd>
              </div>
            ) : null}
          </dl>

          <div className="mt-8 border-t border-line pt-6">
            <h2 className="text-lg">About this candle</h2>
            <div className="mt-3 space-y-3 text-sm leading-relaxed text-ink-soft">
              {product.description.split("\n\n").map((paragraph, index) => (
                <p key={index}>{paragraph}</p>
              ))}
            </div>
          </div>

          <details className="mt-6 border-t border-line pt-4">
            <summary className="cursor-pointer text-sm">Burning instructions</summary>
            <div className="mt-3 space-y-2 text-sm text-ink-soft">
              <p>Trim the wooden wick to 3-4 mm before every burn and remove the charred tip.</p>
              <p>Burn for 2-3 hours at a time, until the melt pool reaches the edge of the vessel.</p>
              <p>Never burn for more than 4 hours or leave a burning candle unattended.</p>
            </div>
          </details>

          <details className="mt-4 border-t border-line pt-4">
            <summary className="cursor-pointer text-sm">Shipping &amp; returns</summary>
            <div className="mt-3 space-y-2 text-sm text-ink-soft">
              <p>Dispatched from Bengaluru in 1-2 business days. Free shipping over {formatMoney(149900)}.</p>
              <p>
                Unlit candles can be returned within 7 days.{" "}
                <Link href="/refund-policy" className="underline underline-offset-4">
                  Read the full policy
                </Link>
                .
              </p>
            </div>
          </details>
        </div>
      </div>

      <section className="mt-20 border-t border-line pt-12" aria-labelledby="reviews-heading">
        <div className="flex flex-wrap items-baseline justify-between gap-4">
          <h2 id="reviews-heading" className="text-2xl">
            Customer notes
          </h2>
          {product.ratingCount > 0 ? (
            <p className="flex items-center gap-2 text-sm text-ink-soft">
              <StarRating value={product.ratingAvg} />
              {product.ratingAvg.toFixed(1)} out of 5
            </p>
          ) : null}
        </div>

        {reviews.length === 0 ? (
          <p className="mt-6 text-sm text-ink-soft">No reviews yet. Be the first to write one.</p>
        ) : (
          <ul className="mt-8 grid gap-8 md:grid-cols-2">
            {reviews.map((review) => (
              <li key={review.id} className="border-t border-line pt-4">
                <StarRating value={review.rating} />
                {review.title ? <p className="mt-2 text-sm font-medium">{review.title}</p> : null}
                <p className="mt-2 text-sm text-ink-soft">{review.body}</p>
                <p className="mt-2 text-xs text-ink-soft">
                  {review.author} · {new Date(review.createdAt).toLocaleDateString("en-IN", { dateStyle: "medium" })}
                </p>
              </li>
            ))}
          </ul>
        )}

        <div className="mt-10 max-w-xl">
          <h3 className="text-lg">Write a review</h3>
          <ReviewForm slug={product.slug} signedIn={Boolean(user)} />
        </div>
      </section>

      {related.items.filter((item) => item.slug !== product.slug).length > 0 ? (
        <section className="mt-20 border-t border-line pt-12">
          <h2 className="text-2xl">You may also like</h2>
          <div className="mt-8 grid grid-cols-1 gap-6 sm:grid-cols-3">
            {related.items
              .filter((item) => item.slug !== product.slug)
              .slice(0, 3)
              .map((item) => (
                <Link key={item.id} href={`/products/${item.slug}`} className="group">
                  <div className="relative aspect-4/3 overflow-hidden bg-sand">
                    {item.imageUrl ? (
                      <Image
                        src={item.imageUrl}
                        alt={item.imageAlt ?? item.name}
                        fill
                        sizes="(min-width: 640px) 33vw, 100vw"
                        className="object-cover transition-transform duration-700 group-hover:scale-[1.03]"
                      />
                    ) : null}
                  </div>
                  <h3 className="mt-3 text-base">{item.name}</h3>
                  <p className="text-sm text-ink-soft">{formatMoney(item.price)}</p>
                </Link>
              ))}
          </div>
        </section>
      ) : null}
    </div>
  );
}
