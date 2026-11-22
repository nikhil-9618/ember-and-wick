import type { Metadata } from "next";
import Link from "next/link";
import { ProductCard } from "@/components/site/product-card";
import { listCategories, listProducts } from "@/lib/services/catalog";
import { productQuerySchema } from "@/lib/validation";

export const metadata: Metadata = {
  title: "Shop all candles",
  description:
    "Hand-poured beeswax and soy candles with wooden wicks and essential oil blends. Filter by mood, price and collection.",
  alternates: { canonical: "/shop" },
};

interface PageProps {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}

const SORT_OPTIONS = [
  { value: "featured", label: "Featured" },
  { value: "newest", label: "Newest" },
  { value: "price_asc", label: "Price: low to high" },
  { value: "price_desc", label: "Price: high to low" },
  { value: "rating", label: "Top rated" },
] as const;

const PRICE_BANDS = [
  { label: "Under ₹900", min: 0, max: 89999 },
  { label: "₹900 – ₹1,200", min: 90000, max: 120000 },
  { label: "₹1,200 and above", min: 120000, max: 500000 },
];

function param(value: string | string[] | undefined): string | undefined {
  return typeof value === "string" ? value : undefined;
}

export default async function ShopPage({ searchParams }: PageProps) {
  const raw = await searchParams;
  const parsed = productQuerySchema.safeParse({
    q: param(raw.q),
    category: param(raw.category),
    minPrice: param(raw.minPrice),
    maxPrice: param(raw.maxPrice),
    sort: param(raw.sort) ?? "featured",
    page: param(raw.page) ?? "1",
    perPage: "12",
  });

  const query = parsed.success
    ? parsed.data
    : { sort: "featured" as const, page: 1, perPage: 12 };

  const [result, categories] = await Promise.all([listProducts(query), listCategories()]);
  const activeCategory = categories.find((category) => category.slug === query.category);

  const buildHref = (overrides: Record<string, string | undefined>) => {
    const params = new URLSearchParams();
    const base: Record<string, string | undefined> = {
      q: query.q,
      category: query.category,
      minPrice: query.minPrice !== undefined ? String(query.minPrice) : undefined,
      maxPrice: query.maxPrice !== undefined ? String(query.maxPrice) : undefined,
      sort: query.sort,
      page: String(query.page),
      ...overrides,
    };
    for (const [key, value] of Object.entries(base)) {
      if (value) params.set(key, value);
    }
    const queryString = params.toString();
    return queryString ? `/shop?${queryString}` : "/shop";
  };

  return (
    <div className="shell py-10 md:py-14">
      <header className="max-w-2xl">
        <p className="eyebrow">The collection</p>
        <h1 className="mt-3 text-4xl md:text-5xl">{activeCategory ? activeCategory.name : "All candles"}</h1>
        <p className="mt-4 text-ink-soft">
          {activeCategory?.description ??
            "Six blends, poured by hand in Bengaluru. Every candle is made with natural wax, a wooden wick and essential oils."}
        </p>
      </header>

      <div className="mt-10 grid gap-10 lg:grid-cols-[16rem_1fr]">
        <aside aria-label="Filters" className="space-y-8">
          <form action="/shop" method="get" className="space-y-3">
            <label htmlFor="q" className="eyebrow">
              Search
            </label>
            <div className="flex gap-2">
              <input
                id="q"
                name="q"
                type="search"
                defaultValue={query.q ?? ""}
                placeholder="Cedar, lavender…"
                className="min-w-0 flex-1 border border-line bg-ivory px-3 py-2 text-sm"
              />
              <button type="submit" className="border border-ink px-3 py-2 text-xs uppercase tracking-wider">
                Go
              </button>
            </div>
            {query.category ? <input type="hidden" name="category" value={query.category} /> : null}
            <input type="hidden" name="sort" value={query.sort} />
          </form>

          <nav aria-label="Categories">
            <h2 className="eyebrow">Collections</h2>
            <ul className="mt-3 space-y-2 text-sm">
              <li>
                <Link
                  href={buildHref({ category: undefined, page: "1" })}
                  className={!query.category ? "text-ink underline underline-offset-4" : "text-ink-soft hover:text-ink"}
                >
                  All candles
                </Link>
              </li>
              {categories.map((category) => (
                <li key={category.id}>
                  <Link
                    href={buildHref({ category: category.slug, page: "1" })}
                    className={
                      query.category === category.slug
                        ? "text-ink underline underline-offset-4"
                        : "text-ink-soft hover:text-ink"
                    }
                  >
                    {category.name} <span className="text-xs text-ink-soft">({category.productCount})</span>
                  </Link>
                </li>
              ))}
            </ul>
          </nav>

          <div>
            <h2 className="eyebrow">Price</h2>
            <ul className="mt-3 space-y-2 text-sm">
              {PRICE_BANDS.map((band) => (
                <li key={band.label}>
                  <Link
                    href={buildHref({
                      minPrice: String(band.min),
                      maxPrice: String(band.max),
                      page: "1",
                    })}
                    className="text-ink-soft hover:text-ink"
                  >
                    {band.label}
                  </Link>
                </li>
              ))}
              {query.minPrice !== undefined || query.maxPrice !== undefined ? (
                <li>
                  <Link href={buildHref({ minPrice: undefined, maxPrice: undefined })} className="text-clay">
                    Clear price
                  </Link>
                </li>
              ) : null}
            </ul>
          </div>

          <form action="/shop" method="get">
            <label htmlFor="sort" className="eyebrow">
              Sort by
            </label>
            <div className="mt-2 flex gap-2">
              <select
                id="sort"
                name="sort"
                defaultValue={query.sort}
                className="min-w-0 flex-1 border border-line bg-ivory px-3 py-2 text-sm"
              >
                {SORT_OPTIONS.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>
              <button type="submit" className="border border-ink px-3 py-2 text-xs uppercase tracking-wider">
                Apply
              </button>
            </div>
            {query.q ? <input type="hidden" name="q" value={query.q} /> : null}
            {query.category ? <input type="hidden" name="category" value={query.category} /> : null}
          </form>
        </aside>

        <section aria-live="polite">
          <div className="flex items-baseline justify-between border-b border-line pb-3">
            <p className="text-sm text-ink-soft">
              {result.total} candle{result.total === 1 ? "" : "s"}
              {query.q ? ` for “${query.q}”` : ""}
            </p>
            <p className="text-xs text-ink-soft">
              Page {result.page} of {result.pages}
            </p>
          </div>

          {result.items.length === 0 ? (
            <div className="mt-12 border border-line bg-sand/40 p-8 text-center">
              <p className="text-lg">No candles match that search.</p>
              <p className="mt-2 text-sm text-ink-soft">Try a broader term, or browse the full collection.</p>
              <Link href="/shop" className="mt-5 inline-block bg-ink px-5 py-2.5 text-sm text-ivory">
                Reset filters
              </Link>
            </div>
          ) : (
            <div className="mt-8 grid grid-cols-1 gap-x-6 gap-y-12 sm:grid-cols-2 xl:grid-cols-3">
              {result.items.map((product, index) => (
                <ProductCard key={product.id} product={product} priority={index < 3} />
              ))}
            </div>
          )}

          {result.pages > 1 ? (
            <nav aria-label="Pagination" className="mt-14 flex items-center justify-between border-t border-line pt-6">
              {result.page > 1 ? (
                <Link href={buildHref({ page: String(result.page - 1) })} className="text-sm hover:text-clay">
                  ← Previous
                </Link>
              ) : (
                <span />
              )}
              <span className="text-xs text-ink-soft">
                {result.page} / {result.pages}
              </span>
              {result.page < result.pages ? (
                <Link href={buildHref({ page: String(result.page + 1) })} className="text-sm hover:text-clay">
                  Next →
                </Link>
              ) : (
                <span />
              )}
            </nav>
          ) : null}
        </section>
      </div>
    </div>
  );
}
