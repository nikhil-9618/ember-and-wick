import type { Metadata } from "next";
import Link from "next/link";
import { listCategories } from "@/lib/services/catalog";
import { ProductForm } from "@/components/admin/product-form";

export const metadata: Metadata = { title: "New product", robots: { index: false, follow: false } };

export default async function NewProductPage() {
  const categories = await listCategories();

  return (
    <div>
      <Link href="/admin/products" className="text-xs text-ink-soft hover:text-ink">
        ← Products
      </Link>
      <h1 className="mt-2 text-2xl">New product</h1>
      <p className="mt-1 text-sm text-ink-soft">
        Drafts are hidden from the storefront. Set status to active when you&apos;re ready to sell.
      </p>
      <div className="mt-8">
        <ProductForm categories={categories.map((category) => ({ id: category.id, name: category.name }))} />
      </div>
    </div>
  );
}
