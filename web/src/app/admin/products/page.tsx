import type { Metadata } from "next";
import Link from "next/link";
import { allRows } from "@/lib/db";
import { formatMoney } from "@/lib/money";

export const metadata: Metadata = { title: "Products", robots: { index: false, follow: false } };

export default async function AdminProductsPage() {
  const products = await allRows<{
    id: string;
    slug: string;
    name: string;
    status: string;
    base_price: number;
    variant_count: number;
    total_stock: number;
    category_name: string | null;
  }>(
    `SELECT p.id, p.slug, p.name, p.status, p.base_price, c.name AS category_name,
            (SELECT COUNT(*) FROM product_variants v WHERE v.product_id = p.id) AS variant_count,
            (SELECT COALESCE(SUM(stock), 0) FROM product_variants v WHERE v.product_id = p.id) AS total_stock
       FROM products p LEFT JOIN categories c ON c.id = p.category_id
      ORDER BY p.created_at DESC`,
  );

  return (
    <div>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-2xl">Products</h1>
        <Link href="/admin/products/new" className="bg-ink px-4 py-2 text-sm text-ivory hover:bg-clay-dark">
          New product
        </Link>
      </div>

      {products.length === 0 ? (
        <p className="mt-6 border border-line bg-sand/30 p-6 text-sm text-ink-soft">No products yet.</p>
      ) : (
        <div className="mt-6 overflow-x-auto">
          <table className="w-full min-w-[40rem] border-collapse text-sm">
            <thead>
              <tr className="border-b border-line text-left text-xs uppercase tracking-wider text-ink-soft">
                <th scope="col" className="py-2 font-medium">Product</th>
                <th scope="col" className="py-2 font-medium">Category</th>
                <th scope="col" className="py-2 font-medium">Status</th>
                <th scope="col" className="py-2 text-right font-medium">Variants</th>
                <th scope="col" className="py-2 text-right font-medium">Stock</th>
                <th scope="col" className="py-2 text-right font-medium">Base price</th>
              </tr>
            </thead>
            <tbody>
              {products.map((product) => (
                <tr key={product.id} className="border-b border-line/70">
                  <td className="py-3">
                    <Link href={`/admin/products/${product.id}`} className="hover:text-clay">
                      {product.name}
                    </Link>
                    <span className="block font-mono text-xs text-ink-soft">/{product.slug}</span>
                  </td>
                  <td className="py-3 text-ink-soft">{product.category_name ?? "—"}</td>
                  <td className="py-3">
                    <span
                      className={`px-2 py-0.5 text-xs uppercase tracking-wider ${
                        product.status === "active"
                          ? "bg-sage/15 text-sage"
                          : product.status === "draft"
                            ? "bg-sand text-ink-soft"
                            : "bg-clay/10 text-clay-dark"
                      }`}
                    >
                      {product.status}
                    </span>
                  </td>
                  <td className="py-3 text-right">{product.variant_count}</td>
                  <td className={`py-3 text-right ${product.total_stock === 0 ? "text-clay-dark" : ""}`}>
                    {product.total_stock}
                  </td>
                  <td className="py-3 text-right">{formatMoney(product.base_price)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
