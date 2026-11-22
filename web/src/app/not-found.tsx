import Link from "next/link";

export default function NotFound() {
  return (
    <div className="shell flex min-h-[50vh] flex-col items-start justify-center py-24">
      <p className="eyebrow">404</p>
      <h1 className="mt-3 text-4xl">This page burned out.</h1>
      <p className="mt-3 max-w-md text-ink-soft">
        The page you were looking for doesn&apos;t exist, or the candle has been retired from the collection.
      </p>
      <div className="mt-8 flex gap-3">
        <Link href="/shop" className="bg-ink px-5 py-3 text-sm text-ivory hover:bg-clay-dark">
          Shop candles
        </Link>
        <Link href="/" className="border border-line px-5 py-3 text-sm hover:border-ink">
          Back home
        </Link>
      </div>
    </div>
  );
}
