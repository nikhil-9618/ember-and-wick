import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import { BRAND } from "@/lib/brand";

export const metadata: Metadata = {
  title: "Our story",
  description:
    "Ember & Wick is a small candle studio in Bengaluru pouring beeswax and soy candles with wooden wicks and essential oils.",
  alternates: { canonical: "/about" },
};

export default function AboutPage() {
  return (
    <article className="shell max-w-3xl py-12 md:py-16">
      <p className="eyebrow">Since 2021</p>
      <h1 className="mt-3 text-4xl md:text-5xl">A small studio, a slow craft.</h1>
      <p className="mt-5 text-lg text-ink-soft">
        {BRAND.name} began with one pouring jug, a block of beeswax and a rented kitchen in Indiranagar. We
        wanted a candle that smelled like a room rather than a perfume counter — and that burned cleanly enough
        to sit on a dinner table.
      </p>

      <div className="relative mt-10 aspect-16/9 overflow-hidden bg-sand">
        <Image
          src="/images/atelier.jpg"
          alt="The Ember & Wick studio bench with candles, wicks and beeswax"
          fill
          sizes="(min-width: 768px) 768px, 100vw"
          className="object-cover"
        />
      </div>

      <div className="mt-12 space-y-6 text-[0.9375rem] leading-relaxed text-ink-soft">
        <h2 className="text-2xl text-ink">What goes in</h2>
        <p>
          Our Signature blends are a 70/30 mix of Indian beeswax and natural soy wax. The beeswax brings a
          warm honeyed base and a slower burn; the soy keeps the pour smooth and the scent even. Our Pure
          Beeswax line is exactly that — nothing else.
        </p>
        <p>
          We use FSC-certified wooden wicks, which crackle quietly and need trimming to 3-4 mm before each
          burn. Scents come from steam-distilled essential oils, blended at 6-8% load. No paraffin, no
          phthalates, no synthetic musk.
        </p>

        <h2 className="pt-4 text-2xl text-ink">How we pour</h2>
        <p>
          Wax is melted in 12 kg batches and poured by hand at 62°C. Every candle cures for seven days before
          it is wicked, labelled and boxed. That week matters: it lets the fragrance bind to the wax so the
          first burn smells the way the twentieth does.
        </p>
        <p>
          Vessels are amber or ivory glass, chosen so they can be washed and reused as brush pots or spice
          jars. Shipping boxes are recycled kraft with paper tape — no bubble wrap, no plastic film.
        </p>

        <h2 className="pt-4 text-2xl text-ink">Where to find us</h2>
        <p>
          Our studio is at {BRAND.address}. We don&apos;t have a walk-in shop yet, but you can collect a
          pre-paid order by arrangement — write to{" "}
          <a href={`mailto:${BRAND.supportEmail}`} className="text-clay underline underline-offset-4">
            {BRAND.supportEmail}
          </a>
          .
        </p>
      </div>

      <div className="mt-12 border-t border-line pt-8">
        <Link href="/shop" className="bg-ink px-6 py-3 text-sm text-ivory hover:bg-clay-dark">
          Shop the collection
        </Link>
      </div>
    </article>
  );
}
