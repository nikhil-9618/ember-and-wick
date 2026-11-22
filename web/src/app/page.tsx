import Image from "next/image";
import Link from "next/link";
import { ProductCard } from "@/components/site/product-card";
import { listCategories, listProducts } from "@/lib/services/catalog";
import { BRAND, POLICIES } from "@/lib/brand";
import { FREE_SHIPPING_THRESHOLD, formatMoney } from "@/lib/money";

export default async function HomePage() {
  const [featured, categories] = await Promise.all([
    listProducts({ sort: "featured", page: 1, perPage: 4 }),
    listCategories(),
  ]);

  return (
    <>
      <section className="relative isolate">
        <div className="relative h-[62vh] min-h-[26rem] w-full overflow-hidden md:h-[74vh]">
          <Image
            src="/images/atelier.jpg"
            alt="The Ember & Wick studio: handmade candles on a wooden workbench in morning light"
            fill
            priority
            sizes="100vw"
            className="object-cover"
          />
          <div className="absolute inset-0 bg-gradient-to-r from-ink/65 via-ink/35 to-transparent" />
        </div>

        <div className="shell absolute inset-0 flex items-center">
          <div className="max-w-xl text-ivory">
            <p className="eyebrow text-ivory/80">Small-batch · Poured in Bengaluru</p>
            <h1 className="mt-4 text-4xl leading-[1.05] sm:text-5xl md:text-6xl">
              Candles that behave like furniture.
            </h1>
            <p className="mt-5 max-w-md text-[0.9375rem] leading-relaxed text-ivory/85">
              Pure beeswax and natural soy, wooden wicks, and steam-distilled essential oils. Poured by
              hand, cured for a week, and made to burn slowly enough to notice.
            </p>
            <div className="mt-8 flex flex-wrap gap-3">
              <Link
                href="/shop"
                className="bg-ivory px-6 py-3 text-[0.8125rem] font-medium tracking-wide text-ink transition-colors hover:bg-sand"
              >
                Shop the collection
              </Link>
              <Link
                href="/about"
                className="border border-ivory/40 px-6 py-3 text-[0.8125rem] font-medium tracking-wide text-ivory transition-colors hover:border-ivory"
              >
                Our story
              </Link>
            </div>
          </div>
        </div>
      </section>

      <section aria-label="What makes our candles different" className="border-b border-line bg-sand/40">
        <div className="shell grid grid-cols-2 gap-4 py-5 text-center text-[0.75rem] uppercase tracking-[0.12em] text-ink-soft md:grid-cols-4">
          <p>100% beeswax &amp; soy</p>
          <p>FSC wooden wicks</p>
          <p>Essential oil blends</p>
          <p>Free shipping over {formatMoney(FREE_SHIPPING_THRESHOLD)}</p>
        </div>
      </section>

      <section className="shell py-16 md:py-24">
        <div className="flex flex-wrap items-end justify-between gap-4">
          <div>
            <p className="eyebrow">The signature pours</p>
            <h2 className="mt-3 text-3xl md:text-4xl">Made to be lived with</h2>
          </div>
          <Link href="/shop" className="text-sm text-clay underline-offset-4 hover:underline">
            View all candles →
          </Link>
        </div>

        {featured.items.length === 0 ? (
          <p className="mt-10 border border-line bg-sand/40 p-6 text-sm text-ink-soft">
            The catalogue is being restocked. Please check back shortly.
          </p>
        ) : (
          <div className="mt-10 grid grid-cols-1 gap-x-6 gap-y-12 sm:grid-cols-2 lg:grid-cols-4">
            {featured.items.map((product, index) => (
              <ProductCard key={product.id} product={product} priority={index < 2} />
            ))}
          </div>
        )}
      </section>

      <section className="border-y border-line bg-sand/30">
        <div className="shell grid gap-10 py-16 md:grid-cols-2 md:items-center md:py-24">
          <div className="relative aspect-4/3 overflow-hidden">
            <Image
              src="/images/atelier.jpg"
              alt="Beeswax blocks, wooden wicks and a brass pouring pitcher on the studio bench"
              fill
              sizes="(min-width: 768px) 45vw, 100vw"
              className="object-cover"
            />
          </div>
          <div>
            <p className="eyebrow">How we pour</p>
            <h2 className="mt-3 text-3xl md:text-4xl">Slow wax, honest materials</h2>
            <p className="mt-5 text-ink-soft">
              We melt in small batches, pour by hand at 62°C, and cure every candle for seven days before it
              leaves the studio. No paraffin, no synthetic fragrance oils, no plastic in the shipping box.
            </p>
            <dl className="mt-8 grid gap-6 sm:grid-cols-3">
              <div>
                <dt className="eyebrow">Wax</dt>
                <dd className="mt-1 text-sm">Indian beeswax blended with natural soy for an even, clean burn.</dd>
              </div>
              <div>
                <dt className="eyebrow">Wick</dt>
                <dd className="mt-1 text-sm">FSC-certified wooden wicks that crackle gently as they burn.</dd>
              </div>
              <div>
                <dt className="eyebrow">Scent</dt>
                <dd className="mt-1 text-sm">Steam-distilled essential oils, blended at 6-8% load.</dd>
              </div>
            </dl>
            <Link
              href="/about"
              className="mt-8 inline-block border-b border-ink pb-1 text-sm transition-colors hover:border-clay hover:text-clay"
            >
              Read the full story
            </Link>
          </div>
        </div>
      </section>

      <section className="shell py-16 md:py-24">
        <p className="eyebrow">Browse by mood</p>
        <h2 className="mt-3 text-3xl md:text-4xl">Find your evening</h2>
        <div className="mt-10 grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-4">
          {categories.map((category) => (
            <Link
              key={category.id}
              href={`/shop?category=${category.slug}`}
              className="group relative block aspect-[5/4] overflow-hidden bg-sand"
            >
              {category.imageUrl ? (
                <Image
                  src={category.imageUrl}
                  alt={category.name}
                  fill
                  sizes="(min-width: 1024px) 25vw, (min-width: 640px) 50vw, 100vw"
                  className="object-cover transition-transform duration-700 group-hover:scale-[1.04]"
                />
              ) : null}
              <div className="absolute inset-0 bg-gradient-to-t from-ink/70 via-ink/10 to-transparent" />
              <div className="absolute inset-x-0 bottom-0 p-5 text-ivory">
                <h3 className="text-xl">{category.name}</h3>
                <p className="text-xs text-ivory/75">{category.productCount} candles</p>
              </div>
            </Link>
          ))}
        </div>
      </section>

      <section className="border-t border-line bg-sand/40">
        <div className="shell flex flex-col items-start justify-between gap-6 py-16 md:flex-row md:items-center">
          <div>
            <p className="eyebrow">Gifting</p>
            <h2 className="mt-3 text-3xl md:text-4xl">Wrapped, ribboned, ready to give.</h2>
            <p className="mt-3 max-w-lg text-ink-soft">
              Every order ships in recycled kraft with a hand-stamped card. Add a note at checkout and we&apos;ll
              write it for you. Delivery across India in {POLICIES.deliveryEstimate.replace(" across India", "")}.
            </p>
          </div>
          <Link
            href="/shop?category=gifting"
            className="bg-ink px-6 py-3 text-[0.8125rem] font-medium tracking-wide text-ivory transition-colors hover:bg-clay-dark"
          >
            Shop gifting
          </Link>
        </div>
      </section>

      <section className="shell py-14">
        <p className="text-center text-xs text-ink-soft">
          Questions before you buy? Write to{" "}
          <a href={`mailto:${BRAND.supportEmail}`} className="text-clay hover:underline">
            {BRAND.supportEmail}
          </a>{" "}
          — we reply within one business day.
        </p>
      </section>
    </>
  );
}
