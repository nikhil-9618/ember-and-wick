import Image from "next/image";
import Link from "next/link";
import { formatMoney } from "@/lib/money";
import type { ProductListItem } from "@/lib/services/catalog";

export function ProductCard({ product, priority = false }: { product: ProductListItem; priority?: boolean }) {
  const onSale = product.compareAtPrice !== null && product.compareAtPrice > product.price;
  const soldOut = product.totalStock === 0;
  const lowStock = !soldOut && product.totalStock <= 6;

  return (
    <article className="group">
      <Link href={`/products/${product.slug}`} className="block">
        <div className="relative aspect-4/3 overflow-hidden bg-sand">
          {product.imageUrl ? (
            <Image
              src={product.imageUrl}
              alt={product.imageAlt ?? product.name}
              fill
              sizes="(min-width: 1024px) 25vw, (min-width: 640px) 50vw, 100vw"
              priority={priority}
              className="object-cover transition-transform duration-700 group-hover:scale-[1.03]"
            />
          ) : (
            <div className="flex h-full items-center justify-center text-xs text-ink-soft">Image coming soon</div>
          )}

          <div className="absolute left-3 top-3 flex flex-col gap-1">
            {soldOut ? (
              <span className="bg-ink/90 px-2 py-1 text-[0.625rem] uppercase tracking-[0.12em] text-ivory">
                Sold out
              </span>
            ) : null}
            {lowStock ? (
              <span className="bg-clay px-2 py-1 text-[0.625rem] uppercase tracking-[0.12em] text-ivory">
                Only {product.totalStock} left
              </span>
            ) : null}
            {onSale ? (
              <span className="bg-ivory/95 px-2 py-1 text-[0.625rem] uppercase tracking-[0.12em] text-clay-dark">
                On offer
              </span>
            ) : null}
          </div>
        </div>

        <div className="mt-4 space-y-1">
          <p className="eyebrow">{product.categoryName ?? "Candles"}</p>
          <h3 className="text-lg leading-snug">{product.name}</h3>
          {product.tagline ? <p className="text-sm text-ink-soft">{product.tagline}</p> : null}
          <p className="flex items-baseline gap-2 pt-1 text-sm">
            <span>{formatMoney(product.price)}</span>
            {onSale ? (
              <span className="text-xs text-ink-soft line-through">{formatMoney(product.compareAtPrice!)}</span>
            ) : null}
            {product.variantCount > 1 ? (
              <span className="text-xs text-ink-soft">· {product.variantCount} sizes</span>
            ) : null}
          </p>
        </div>
      </Link>
    </article>
  );
}
