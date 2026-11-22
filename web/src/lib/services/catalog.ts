import { allRows, firstRow } from "../db";

export interface ProductListItem {
  id: string;
  slug: string;
  name: string;
  tagline: string | null;
  basePrice: number;
  compareAtPrice: number | null;
  price: number;
  ratingAvg: number;
  ratingCount: number;
  isFeatured: boolean;
  scentNotes: string | null;
  categoryName: string | null;
  categorySlug: string | null;
  imageUrl: string | null;
  imageAlt: string | null;
  totalStock: number;
  variantCount: number;
}

export interface ListProductsParams {
  q?: string;
  category?: string;
  minPrice?: number;
  maxPrice?: number;
  scent?: string;
  sort: "newest" | "price_asc" | "price_desc" | "rating" | "featured";
  page: number;
  perPage: number;
}

interface ProductRow {
  id: string;
  slug: string;
  name: string;
  tagline: string | null;
  base_price: number;
  compare_at_price: number | null;
  min_price: number | null;
  rating_avg: number;
  rating_count: number;
  is_featured: number;
  scent_notes: string | null;
  category_name: string | null;
  category_slug: string | null;
  image_url: string | null;
  image_alt: string | null;
  total_stock: number | null;
  variant_count: number;
}

function mapProduct(row: ProductRow): ProductListItem {
  return {
    id: row.id,
    slug: row.slug,
    name: row.name,
    tagline: row.tagline,
    basePrice: row.base_price,
    compareAtPrice: row.compare_at_price,
    price: row.min_price ?? row.base_price,
    ratingAvg: row.rating_avg,
    ratingCount: row.rating_count,
    isFeatured: row.is_featured === 1,
    scentNotes: row.scent_notes,
    categoryName: row.category_name,
    categorySlug: row.category_slug,
    imageUrl: row.image_url,
    imageAlt: row.image_alt,
    totalStock: row.total_stock ?? 0,
    variantCount: row.variant_count,
  };
}

const SORT_SQL: Record<ListProductsParams["sort"], string> = {
  featured: "p.is_featured DESC, p.created_at DESC",
  newest: "p.created_at DESC",
  price_asc: "min_price ASC",
  price_desc: "min_price DESC",
  rating: "p.rating_avg DESC, p.rating_count DESC",
};

export async function listProducts(params: ListProductsParams): Promise<{
  items: ProductListItem[];
  total: number;
  page: number;
  perPage: number;
  pages: number;
}> {
  const where: string[] = ["p.status = 'active'"];
  const bindings: unknown[] = [];

  if (params.q) {
    where.push("(p.name LIKE ? OR p.description LIKE ? OR p.scent_notes LIKE ?)");
    const like = `%${params.q}%`;
    bindings.push(like, like, like);
  }
  if (params.category) {
    where.push("c.slug = ?");
    bindings.push(params.category);
  }
  if (params.scent) {
    where.push("p.scent_notes LIKE ?");
    bindings.push(`%${params.scent}%`);
  }
  if (params.minPrice !== undefined) {
    where.push("COALESCE(min_price, p.base_price) >= ?");
    bindings.push(params.minPrice);
  }
  if (params.maxPrice !== undefined) {
    where.push("COALESCE(min_price, p.base_price) <= ?");
    bindings.push(params.maxPrice);
  }

  const whereSql = where.join(" AND ");
  const from = `FROM products p
                LEFT JOIN categories c ON c.id = p.category_id`;

  const countRow = await firstRow<{ total: number }>(
    `SELECT COUNT(*) AS total ${from} WHERE ${whereSql}`,
    bindings,
  );
  const total = countRow?.total ?? 0;

  const offset = (params.page - 1) * params.perPage;
  const rows = await allRows<ProductRow>(
    `SELECT p.id, p.slug, p.name, p.tagline, p.base_price, p.compare_at_price, p.rating_avg, p.rating_count,
            p.is_featured, p.scent_notes,
            c.name AS category_name, c.slug AS category_slug,
            (SELECT MIN(price) FROM product_variants v WHERE v.product_id = p.id AND v.is_active = 1) AS min_price,
            (SELECT url FROM product_images pi WHERE pi.product_id = p.id ORDER BY pi.position ASC LIMIT 1) AS image_url,
            (SELECT alt FROM product_images pi WHERE pi.product_id = p.id ORDER BY pi.position ASC LIMIT 1) AS image_alt,
            (SELECT COALESCE(SUM(stock), 0) FROM product_variants v WHERE v.product_id = p.id AND v.is_active = 1) AS total_stock,
            (SELECT COUNT(*) FROM product_variants v WHERE v.product_id = p.id AND v.is_active = 1) AS variant_count
       ${from}
      WHERE ${whereSql}
      ORDER BY ${SORT_SQL[params.sort]}, p.id ASC
      LIMIT ? OFFSET ?`,
    [...bindings, params.perPage, offset],
  );

  return {
    items: rows.map(mapProduct),
    total,
    page: params.page,
    perPage: params.perPage,
    pages: Math.max(1, Math.ceil(total / params.perPage)),
  };
}

export interface ProductVariant {
  id: string;
  name: string;
  sku: string;
  price: number;
  stock: number;
  weightGrams: number | null;
  isActive: boolean;
}

export interface ProductDetail {
  id: string;
  slug: string;
  name: string;
  tagline: string | null;
  description: string;
  waxType: string | null;
  wickType: string | null;
  burnTimeHours: number | null;
  scentNotes: string | null;
  basePrice: number;
  compareAtPrice: number | null;
  currency: string;
  ratingAvg: number;
  ratingCount: number;
  categoryName: string | null;
  categorySlug: string | null;
  images: { url: string; alt: string }[];
  variants: ProductVariant[];
}

export async function getProductBySlug(slug: string): Promise<ProductDetail | null> {
  const product = await firstRow<{
    id: string;
    slug: string;
    name: string;
    tagline: string | null;
    description: string;
    wax_type: string | null;
    wick_type: string | null;
    burn_time_hours: number | null;
    scent_notes: string | null;
    base_price: number;
    compare_at_price: number | null;
    currency: string;
    rating_avg: number;
    rating_count: number;
    category_name: string | null;
    category_slug: string | null;
  }>(
    `SELECT p.*, c.name AS category_name, c.slug AS category_slug
       FROM products p LEFT JOIN categories c ON c.id = p.category_id
      WHERE p.slug = ? AND p.status = 'active'`,
    [slug],
  );
  if (!product) return null;

  const [images, variants] = await Promise.all([
    allRows<{ url: string; alt: string }>(
      "SELECT url, alt FROM product_images WHERE product_id = ? ORDER BY position ASC",
      [product.id],
    ),
    allRows<{ id: string; name: string; sku: string; price: number; stock: number; weight_grams: number | null; is_active: number }>(
      `SELECT id, name, sku, price, stock, weight_grams, is_active
         FROM product_variants WHERE product_id = ? AND is_active = 1 ORDER BY position ASC, price ASC`,
      [product.id],
    ),
  ]);

  return {
    id: product.id,
    slug: product.slug,
    name: product.name,
    tagline: product.tagline,
    description: product.description,
    waxType: product.wax_type,
    wickType: product.wick_type,
    burnTimeHours: product.burn_time_hours,
    scentNotes: product.scent_notes,
    basePrice: product.base_price,
    compareAtPrice: product.compare_at_price,
    currency: product.currency,
    ratingAvg: product.rating_avg,
    ratingCount: product.rating_count,
    categoryName: product.category_name,
    categorySlug: product.category_slug,
    images,
    variants: variants.map((variant) => ({
      id: variant.id,
      name: variant.name,
      sku: variant.sku,
      price: variant.price,
      stock: variant.stock,
      weightGrams: variant.weight_grams,
      isActive: variant.is_active === 1,
    })),
  };
}

export async function listCategories(): Promise<
  { id: string; slug: string; name: string; description: string | null; imageUrl: string | null; productCount: number }[]
> {
  const rows = await allRows<{
    id: string;
    slug: string;
    name: string;
    description: string | null;
    image_url: string | null;
    product_count: number;
  }>(
    `SELECT c.id, c.slug, c.name, c.description, c.image_url,
            (SELECT COUNT(*) FROM products p WHERE p.category_id = c.id AND p.status = 'active') AS product_count
       FROM categories c ORDER BY c.position ASC, c.name ASC`,
  );
  return rows.map((row) => ({
    id: row.id,
    slug: row.slug,
    name: row.name,
    description: row.description,
    imageUrl: row.image_url,
    productCount: row.product_count,
  }));
}

export async function listPublishedReviews(productId: string): Promise<
  { id: string; rating: number; title: string | null; body: string; author: string; createdAt: string }[]
> {
  const rows = await allRows<{ id: string; rating: number; title: string | null; body: string; author: string; created_at: string }>(
    `SELECT r.id, r.rating, r.title, r.body, r.created_at, u.name AS author
       FROM reviews r JOIN users u ON u.id = r.user_id
      WHERE r.product_id = ? AND r.status = 'published'
      ORDER BY r.created_at DESC LIMIT 50`,
    [productId],
  );
  return rows.map((row) => ({
    id: row.id,
    rating: row.rating,
    title: row.title,
    body: row.body,
    author: row.author.split(" ")[0] ?? "Customer",
    createdAt: row.created_at,
  }));
}

/** Recomputes the denormalised rating on the product after moderation changes. */
export async function refreshProductRating(productId: string): Promise<void> {
  const { getDb } = await import("../db");
  const db = await getDb();
  await db
    .prepare(
      `UPDATE products SET
         rating_avg = COALESCE((SELECT AVG(rating) FROM reviews WHERE product_id = ? AND status = 'published'), 0),
         rating_count = (SELECT COUNT(*) FROM reviews WHERE product_id = ? AND status = 'published')
       WHERE id = ?`,
    )
    .bind(productId, productId, productId)
    .run();
}
