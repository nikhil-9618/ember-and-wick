"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { api, errorMessage } from "@/lib/client/api";
import { formatMoney } from "@/lib/money";
import type { ProductVariant } from "@/lib/services/catalog";

interface Props {
  productId: string;
  variants: ProductVariant[];
  compareAtPrice: number | null;
  signedIn: boolean;
  initiallyWishlisted: boolean;
}

export function PurchasePanel({ productId, variants, compareAtPrice, signedIn, initiallyWishlisted }: Props) {
  const router = useRouter();
  const inStock = variants.filter((variant) => variant.stock > 0);
  const [variantId, setVariantId] = useState(inStock[0]?.id ?? variants[0]?.id ?? "");
  const [quantity, setQuantity] = useState(1);
  const [status, setStatus] = useState<"idle" | "adding" | "added">("idle");
  const [error, setError] = useState<string | null>(null);
  const [wishlisted, setWishlisted] = useState(initiallyWishlisted);
  const [wishlistBusy, setWishlistBusy] = useState(false);

  const variant = useMemo(() => variants.find((item) => item.id === variantId) ?? variants[0], [variants, variantId]);
  const maxQuantity = Math.min(10, variant?.stock ?? 0);
  const soldOut = !variant || variant.stock === 0;

  async function addToCart() {
    if (!variant) return;
    if (!signedIn) {
      router.push(`/login?next=/products/${window.location.pathname.split("/").pop() ?? ""}`);
      return;
    }
    setStatus("adding");
    setError(null);
    try {
      await api("/api/v1/cart", {
        method: "POST",
        body: { variantId: variant.id, quantity },
      });
      setStatus("added");
      router.refresh();
    } catch (issue) {
      setError(errorMessage(issue));
      setStatus("idle");
    }
  }

  async function toggleWishlist() {
    if (!signedIn) {
      router.push("/login?next=/account/wishlist");
      return;
    }
    setWishlistBusy(true);
    setError(null);
    try {
      if (wishlisted) {
        await api(`/api/v1/wishlist?productId=${encodeURIComponent(productId)}`, { method: "DELETE" });
      } else {
        await api("/api/v1/wishlist", { method: "POST", body: { productId } });
      }
      setWishlisted(!wishlisted);
    } catch (issue) {
      setError(errorMessage(issue));
    } finally {
      setWishlistBusy(false);
    }
  }

  return (
    <div className="mt-6">
      <p className="flex items-baseline gap-3">
        <span className="text-2xl">{variant ? formatMoney(variant.price) : "—"}</span>
        {compareAtPrice && variant && compareAtPrice > variant.price ? (
          <span className="text-sm text-ink-soft line-through">{formatMoney(compareAtPrice)}</span>
        ) : null}
        <span className="text-xs text-ink-soft">incl. GST</span>
      </p>

      <fieldset className="mt-6">
        <legend className="eyebrow">Size</legend>
        <div className="mt-3 flex flex-wrap gap-2">
          {variants.map((item) => {
            const disabled = item.stock === 0;
            const selected = item.id === variantId;
            return (
              <button
                key={item.id}
                type="button"
                disabled={disabled}
                aria-pressed={selected}
                onClick={() => {
                  setVariantId(item.id);
                  setQuantity(1);
                  setStatus("idle");
                }}
                className={`border px-4 py-2 text-sm transition-colors ${
                  selected ? "border-ink bg-ink text-ivory" : "border-line text-ink hover:border-ink"
                } ${disabled ? "cursor-not-allowed opacity-40 line-through" : ""}`}
              >
                {item.name}
                <span className="ml-2 text-xs opacity-70">{formatMoney(item.price)}</span>
              </button>
            );
          })}
        </div>
      </fieldset>

      <div className="mt-6 flex flex-wrap items-center gap-3">
        <label htmlFor="quantity" className="eyebrow">
          Quantity
        </label>
        <select
          id="quantity"
          value={quantity}
          onChange={(event) => setQuantity(Number(event.target.value))}
          disabled={soldOut}
          className="border border-line bg-ivory px-3 py-2 text-sm"
        >
          {Array.from({ length: Math.max(1, maxQuantity) }, (_, index) => index + 1).map((value) => (
            <option key={value} value={value}>
              {value}
            </option>
          ))}
        </select>
        <span className="text-xs text-ink-soft">
          {soldOut ? "Sold out" : variant.stock <= 5 ? `Only ${variant.stock} left` : "In stock"}
        </span>
      </div>

      <div className="mt-6 flex flex-col gap-3 sm:flex-row">
        <button
          type="button"
          onClick={addToCart}
          disabled={soldOut || status === "adding"}
          className="flex-1 bg-ink px-6 py-3.5 text-[0.8125rem] font-medium tracking-wide text-ivory transition-colors hover:bg-clay-dark disabled:cursor-not-allowed disabled:opacity-50"
        >
          {soldOut ? "Sold out" : status === "adding" ? "Adding…" : status === "added" ? "Added to cart ✓" : "Add to cart"}
        </button>
        <button
          type="button"
          onClick={toggleWishlist}
          disabled={wishlistBusy}
          aria-pressed={wishlisted}
          className="border border-line px-5 py-3.5 text-[0.8125rem] transition-colors hover:border-ink disabled:opacity-50"
        >
          {wishlisted ? "♥ Saved" : "♡ Save"}
        </button>
      </div>

      {status === "added" ? (
        <p className="mt-3 text-sm text-sage">
          Added.{" "}
          <Link href="/cart" className="underline underline-offset-4">
            View cart
          </Link>
        </p>
      ) : null}

      {error ? (
        <p role="alert" className="mt-3 border border-clay/40 bg-clay/5 px-3 py-2 text-sm text-clay-dark">
          {error}
        </p>
      ) : null}

      <ul className="mt-5 space-y-1.5 text-xs text-ink-soft">
        <li>Free shipping over ₹1,499 · dispatched in 1-2 business days</li>
        <li>7-day returns on unlit candles · secure UPI and card payments</li>
      </ul>
    </div>
  );
}
