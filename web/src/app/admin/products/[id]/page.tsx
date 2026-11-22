import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { listCategories } from "@/lib/services/catalog";
import { getAdminProduct } from "@/lib/services/admin";
import { ProductForm } from "@/components/admin/product-form";
import { VariantEditor } from "@/components/admin/variant-editor";

export const metadata: Metadata = { title: "Edit product", robots: { index: false, follow: false } };

export default async function EditProductPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const [product, categories] = await Promise.all([getAdminProduct(id), listCategories()]);
  if (!product) notFound();

  return (
    <div>
      <Link href="/admin/products" className="text-xs text-ink-soft hover:text-ink">
        ← Products
      </Link>
      <div className="mt-2 flex flex-wrap items-baseline justify-between gap-2">
        <h1 className="text-2xl">{product.name}</h1>
        <Link href={`/products/${product.slug}`} className="text-xs text-clay hover:underline">
          View on storefront →
        </Link>
      </div>

      <section className="mt-8" aria-labelledby="inventory-heading">
        <h2 id="inventory-heading" className="text-lg">
          Inventory &amp; pricing
        </h2>
        <p className="mb-4 text-xs text-ink-soft">
          Updates apply immediately. Stock can never go below zero — the database rejects it.
        </p>
        <VariantEditor variants={product.variants} productId={product.id} />
      </section>

      <section className="mt-12 border-t border-line pt-8" aria-labelledby="details-heading">
        <h2 id="details-heading" className="text-lg">
          Product details
        </h2>
        <div className="mt-4">
          <ProductForm
            categories={categories.map((category) => ({ id: category.id, name: category.name }))}
            initial={product}
          />
        </div>
      </section>
    </div>
  );
}
