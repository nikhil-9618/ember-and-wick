import { contains } from "../db";
import { getDb } from "../db";
import type { Store } from "../db";

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

const SORT_FIELD: Record<ListProductsParams["sort"], string> = {
  featured: "is_featured",
  newest: "created_at",
  price_asc: "min_price",
  price_desc: "min_price",
  rating: "rating_avg",
};

export async function listProducts(params: ListProductsParams): Promise<{
  items: ProductListItem[];
  total: number;
  page: number;
  perPage: number;
  pages: number;
}> {
  const db = await getDb();
  const match: Record<string, unknown> = { status: "active" };

  if (params.q) {
    const rx = contains(params.q);
    match.$or = [{ name: rx }, { description: rx }, { scent_notes: rx }];
  }
  if (params.category) {
    const cat = await db.categories.findOne({ slug: params.category });
    if (!cat) {
      return { items: [], total: 0, page: params.page, perPage: params.perPage, pages: 1 };
    }
    match.category_id = cat._id;
  }
  if (params.scent) {
    match.scent_notes = contains(params.scent);
  }

  const pipeline: Record<string, unknown>[] = [
    { $match: match },
    {
      $lookup: {
        from: "categories",
        localField: "category_id",
        foreignField: "_id",
        as: "category",
      },
    },
    {
      $lookup: {
        from: "product_variants",
        let: { pid: "$_id" },
        pipeline: [
          { $match: { $expr: { $and: [{ $eq: ["$product_id", "$$pid"] }, { $eq: ["$is_active", 1] }] } } },
        ],
        as: "variants",
      },
    },
    {
      $lookup: {
        from: "product_images",
        let: { pid: "$_id" },
        pipeline: [
          { $match: { $expr: { $eq: ["$product_id", "$$pid"] } } },
          { $sort: { position: 1 } },
          { $limit: 1 },
        ],
        as: "images",
      },
    },
    {
      $addFields: {
        category_name: { $ifNull: [{ $first: "$category.name" }, null] },
        category_slug: { $ifNull: [{ $first: "$category.slug" }, null] },
        min_price: { $min: "$variants.price" },
        total_stock: { $sum: "$variants.stock" },
        variant_count: { $size: "$variants" },
        image_url: { $ifNull: [{ $first: "$images.url" }, null] },
        image_alt: { $ifNull: [{ $first: "$images.alt" }, null] },
      },
    },
  ];

  if (params.minPrice !== undefined) {
    pipeline.push({ $match: { $expr: { $gte: [{ $ifNull: ["$min_price", "$base_price"] }, params.minPrice] } } });
  }
  if (params.maxPrice !== undefined) {
    pipeline.push({ $match: { $expr: { $lte: [{ $ifNull: ["$min_price", "$base_price"] }, params.maxPrice] } } });
  }

  const sortDir = params.sort === "price_asc" ? 1 : params.sort === "price_desc" ? -1 : -1;
  const sortSpec: Record<string, number> = {};
  if (params.sort === "newest") sortSpec.created_at = -1;
  else if (params.sort === "rating") { sortSpec.rating_avg = -1; sortSpec.rating_count = -1; }
  else if (params.sort === "featured") { sortSpec.is_featured = -1; sortSpec.created_at = -1; }
  else { sortSpec.min_price = sortDir; }
  sortSpec._id = 1;

  const offset = (params.page - 1) * params.perPage;

  const facet = await db.products
    .aggregate<{
      items: any[];
      total: { n: number }[];
    }>([
      ...pipeline,
      {
        $facet: {
          items: [{ $sort: sortSpec }, { $skip: offset }, { $limit: params.perPage }],
          total: [{ $count: "n" }],
        },
      },
    ])
    .toArray();

  const result = facet[0] ?? { items: [], total: [] };
  const total = result.total[0]?.n ?? 0;

  const rows: ProductRow[] = result.items.map((row: any) => ({
    id: row._id,
    slug: row.slug,
    name: row.name,
    tagline: row.tagline,
    base_price: row.base_price,
    compare_at_price: row.compare_at_price,
    min_price: row.min_price ?? null,
    rating_avg: row.rating_avg,
    rating_count: row.rating_count,
    is_featured: row.is_featured,
    scent_notes: row.scent_notes,
    category_name: row.category_name,
    category_slug: row.category_slug,
    image_url: row.image_url,
    image_alt: row.image_alt,
    total_stock: row.total_stock,
    variant_count: row.variant_count,
  }));

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
  const db = await getDb();
  const product = await db.products.findOne({ slug, status: "active" });
  if (!product) return null;

  const category = product.category_id ? await db.categories.findOne({ _id: product.category_id }) : null;
  const images = await db.product_images.find({ product_id: product._id }).sort({ position: 1 }).toArray();
  const variants = await db.product_variants
    .find({ product_id: product._id, is_active: 1 })
    .sort({ position: 1, price: 1 })
    .toArray();

  return {
    id: product._id,
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
    categoryName: category?.name ?? null,
    categorySlug: category?.slug ?? null,
    images: (images as any[]).map((i) => ({ url: i.url, alt: i.alt })),
    variants: (variants as any[]).map((v) => ({
      id: v._id,
      name: v.name,
      sku: v.sku,
      price: v.price,
      stock: v.stock,
      weightGrams: v.weight_grams,
      isActive: v.is_active === 1,
    })),
  };
}

export async function listCategories(): Promise<
  { id: string; slug: string; name: string; description: string | null; imageUrl: string | null; productCount: number }[]
> {
  const db = await getDb();
  const categories = await db.categories.find({}).sort({ position: 1, name: 1 }).toArray();
  const result: any[] = [];
  for (const c of categories as any[]) {
    const count = await db.products.countDocuments({ category_id: c._id, status: "active" });
    result.push({
      id: c._id,
      slug: c.slug,
      name: c.name,
      description: c.description,
      imageUrl: c.image_url,
      productCount: count,
    });
  }
  return result;
}

export async function listPublishedReviews(productId: string): Promise<
  { id: string; rating: number; title: string | null; body: string; author: string; createdAt: string }[]
> {
  const db = await getDb();
  const rows = await db.reviews
    .find({ product_id: productId, status: "published" })
    .sort({ created_at: -1 })
    .limit(50)
    .toArray();
  const result: any[] = [];
  for (const r of rows as any[]) {
    const user = await db.users.findOne({ _id: r.user_id });
    result.push({
      id: r._id,
      rating: r.rating,
      title: r.title,
      body: r.body,
      author: (user?.name ?? "Customer").split(" ")[0],
      createdAt: r.created_at,
    });
  }
  return result;
}

export async function refreshProductRating(productId: string): Promise<void> {
  const db = await getDb();
  const agg = await db.reviews
    .aggregate<{ avg: number; count: number }>([
      { $match: { product_id: productId, status: "published" } },
      { $group: { _id: null, avg: { $avg: "$rating" }, count: { $sum: 1 } } },
    ])
    .toArray();
  const row = agg[0];
  await db.products.updateOne(
    { _id: productId },
    { $set: { rating_avg: row?.avg ?? 0, rating_count: row?.count ?? 0 } },
  );
}
