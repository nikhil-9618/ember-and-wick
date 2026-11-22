import { allRows, firstRow } from "../db";

export interface AdminVariant {
  id: string;
  name: string;
  sku: string;
  price: number;
  stock: number;
  weightGrams: number | null;
  lowStockThreshold: number;
  isActive: boolean;
}

export interface AdminProduct {
  id: string;
  slug: string;
  name: string;
  tagline: string | null;
  description: string;
  categoryId: string | null;
  waxType: string | null;
  wickType: string | null;
  burnTimeHours: number | null;
  scentNotes: string | null;
  basePrice: number;
  compareAtPrice: number | null;
  status: string;
  isFeatured: boolean;
  images: { url: string; alt: string }[];
  variants: AdminVariant[];
}

export async function getAdminProduct(id: string): Promise<AdminProduct | null> {
  const product = await firstRow<{
    id: string;
    slug: string;
    name: string;
    tagline: string | null;
    description: string;
    category_id: string | null;
    wax_type: string | null;
    wick_type: string | null;
    burn_time_hours: number | null;
    scent_notes: string | null;
    base_price: number;
    compare_at_price: number | null;
    status: string;
    is_featured: number;
  }>("SELECT * FROM products WHERE id = ?", [id]);
  if (!product) return null;

  const [images, variants] = await Promise.all([
    allRows<{ url: string; alt: string }>(
      "SELECT url, alt FROM product_images WHERE product_id = ? ORDER BY position ASC",
      [id],
    ),
    allRows<{
      id: string;
      name: string;
      sku: string;
      price: number;
      stock: number;
      weight_grams: number | null;
      low_stock_threshold: number;
      is_active: number;
    }>("SELECT * FROM product_variants WHERE product_id = ? ORDER BY position ASC", [id]),
  ]);

  return {
    id: product.id,
    slug: product.slug,
    name: product.name,
    tagline: product.tagline,
    description: product.description,
    categoryId: product.category_id,
    waxType: product.wax_type,
    wickType: product.wick_type,
    burnTimeHours: product.burn_time_hours,
    scentNotes: product.scent_notes,
    basePrice: product.base_price,
    compareAtPrice: product.compare_at_price,
    status: product.status,
    isFeatured: product.is_featured === 1,
    images,
    variants: variants.map((variant) => ({
      id: variant.id,
      name: variant.name,
      sku: variant.sku,
      price: variant.price,
      stock: variant.stock,
      weightGrams: variant.weight_grams,
      lowStockThreshold: variant.low_stock_threshold,
      isActive: variant.is_active === 1,
    })),
  };
}
