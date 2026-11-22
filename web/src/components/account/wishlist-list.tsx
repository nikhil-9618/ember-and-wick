"use client";

import { useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { api, errorMessage } from "@/lib/client/api";
import { formatMoney } from "@/lib/money";

interface Item {
  productId: string;
  slug: string;
  name: string;
  tagline: string | null;
  price: number;
  imageUrl: string | null;
  imageAlt: string | null;
  inStock: boolean;
}

export function WishlistList({ initial }: { initial: Item[] }) {
  const [items, setItems] = useState(initial);
  const [error, setError] = useState<string | null>(null);

  async function remove(productId: string) {
    setError(null);
    try {
      await api(`/api/v1/wishlist?productId=${encodeURIComponent(productId)}`, { method: "DELETE" });
      setItems(items.filter((item) => item.productId !== productId));
    } catch (issue) {
      setError(errorMessage(issue));
    }
  }

  if (items.length === 0) {
    return (
      <div className="border border-line bg-sand/30 p-8 text-center text-sm text-ink-soft">
        Nothing saved yet. Tap “Save” on any candle to keep it here.
      </div>
    );
  }

  return (
    <div>
      <ul className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
        {items.map((item) => (
          <li key={item.productId} className="border border-line">
            <Link href={`/products/${item.slug}`} className="block">
              <div className="relative aspect-4/3 bg-sand">
                {item.imageUrl ? (
                  <Image src={item.imageUrl} alt={item.imageAlt ?? item.name} fill sizes="33vw" className="object-cover" />
                ) : null}
              </div>
              <div className="p-4">
                <p className="text-base">{item.name}</p>
                <p className="text-sm text-ink-soft">{formatMoney(item.price)}</p>
                <p className="mt-1 text-xs text-ink-soft">{item.inStock ? "In stock" : "Currently sold out"}</p>
              </div>
            </Link>
            <div className="flex items-center justify-between border-t border-line px-4 py-2 text-xs">
              <Link href={`/products/${item.slug}`} className="underline underline-offset-4">
                View candle
              </Link>
              <button type="button" onClick={() => remove(item.productId)} className="text-clay-dark underline underline-offset-4">
                Remove
              </button>
            </div>
          </li>
        ))}
      </ul>
      {error ? <p role="alert" className="mt-3 text-sm text-clay-dark">{error}</p> : null}
    </div>
  );
}
