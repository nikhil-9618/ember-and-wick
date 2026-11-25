import { getDb } from "../db";

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
  const db = await getDb();
  const product = await db.products.findOne({ _id: id });
  if (!product) return null;
  const p = product as any;
  const images = await db.product_images.find({ product_id: id }).sort({ position: 1 }).toArray();
  const variants = await db.product_variants.find({ product_id: id }).sort({ position: 1 }).toArray();
  return {
    id: p._id,
    slug: p.slug,
    name: p.name,
    tagline: p.tagline,
    description: p.description,
    categoryId: p.category_id,
    waxType: p.wax_type,
    wickType: p.wick_type,
    burnTimeHours: p.burn_time_hours,
    scentNotes: p.scent_notes,
    basePrice: p.base_price,
    compareAtPrice: p.compare_at_price,
    status: p.status,
    isFeatured: p.is_featured === 1,
    images: (images as any[]).map((i) => ({ url: i.url, alt: i.alt })),
    variants: (variants as any[]).map((v) => ({
      id: v._id,
      name: v.name,
      sku: v.sku,
      price: v.price,
      stock: v.stock,
      weightGrams: v.weight_grams,
      lowStockThreshold: v.low_stock_threshold,
      isActive: v.is_active === 1,
    })),
  };
}
