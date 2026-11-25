import { getDb } from "../db";
import { randomId } from "../crypto";
import { notFound, outOfStock } from "../errors";
import { computeTotals, type Totals } from "../money";
import type { CouponLike } from "../money";
import type { Store } from "../db";

export interface CartLine {
  id: string;
  variantId: string;
  productId: string;
  productName: string;
  productSlug: string;
  variantName: string;
  sku: string;
  unitPrice: number;
  quantity: number;
  lineTotal: number;
  stock: number;
  imageUrl: string | null;
  imageAlt: string | null;
}

export interface CartSummary {
  cartId: string;
  items: CartLine[];
  itemCount: number;
  subtotal: number;
  totals: Totals;
}

export interface CouponRow extends CouponLike {
  id: string;
  code: string;
  starts_at: string | null;
  ends_at: string | null;
  is_active: number;
  usage_limit: number | null;
  used_count: number;
}

async function hydrateCart(store: Store, cartId: string): Promise<CartSummary> {
  const rows = await store.cart_items.find({ cart_id: cartId }).sort({ created_at: 1 }).toArray();
  const variantIds = rows.map((r: any) => r.variant_id);
  const variants = variantIds.length
    ? await store.product_variants.find({ _id: { $in: variantIds } }).toArray()
    : [];
  const variantMap = new Map((variants as any[]).map((v) => [v._id, v]));
  const productIds = [...new Set((variants as any[]).map((v) => v.product_id))];
  const products = productIds.length ? await store.products.find({ _id: { $in: productIds }, status: "active" }).toArray() : [];
  const productMap = new Map((products as any[]).map((p) => [p._id, p]));
  const images = productIds.length
    ? await store.product_images.find({ product_id: { $in: productIds } }).sort({ position: 1 }).toArray()
    : [];
  const imageMap = new Map<string, any>();
  for (const img of images as any[]) if (!imageMap.has(img.product_id)) imageMap.set(img.product_id, img);

  const items: CartLine[] = [];
  for (const row of rows as any[]) {
    const variant = variantMap.get(row.variant_id);
    if (!variant || variant.is_active !== 1) continue;
    const product = productMap.get(variant.product_id);
    if (!product || product.status !== "active") continue;
    const image = imageMap.get(product._id);
    items.push({
      id: row._id,
      variantId: row.variant_id,
      productId: product._id,
      productName: product.name,
      productSlug: product.slug,
      variantName: variant.name,
      sku: variant.sku,
      unitPrice: variant.price,
      quantity: row.quantity,
      lineTotal: variant.price * row.quantity,
      stock: variant.stock,
      imageUrl: image?.url ?? null,
      imageAlt: image?.alt ?? null,
    });
  }

  const subtotal = items.reduce((sum, item) => sum + item.lineTotal, 0);
  return {
    cartId,
    items,
    itemCount: items.reduce((sum, item) => sum + item.quantity, 0),
    subtotal,
    totals: computeTotals(subtotal, 0),
  };
}

export async function getCart(userId: string): Promise<CartSummary> {
  const db = await getDb();
  const cart = await db.carts.findOne({ user_id: userId });
  if (!cart) {
    const empty: Totals = computeTotals(0, 0);
    return { cartId: "", items: [], itemCount: 0, subtotal: 0, totals: empty };
  }
  return hydrateCart(db, cart._id);
}

export async function ensureCart(userId: string): Promise<string> {
  const db = await getDb();
  const existing = await db.carts.findOne({ user_id: userId });
  if (existing) return existing._id;
  const id = randomId("cart");
  const now = new Date().toISOString();
  await db.carts.insertOne({ _id: id, user_id: userId, created_at: now, updated_at: now } as any);
  return id;
}

export async function addToCart(userId: string, variantId: string, quantity: number): Promise<CartSummary> {
  const db = await getDb();
  const variant = await db.product_variants.findOne({ _id: variantId });
  const product = variant ? await db.products.findOne({ _id: variant.product_id }) : null;
  if (!variant || variant.is_active !== 1 || !product || product.status !== "active") {
    throw notFound("That product is no longer available.");
  }

  const cartId = await ensureCart(userId);
  const existing = await db.cart_items.findOne({ cart_id: cartId, variant_id: variantId });

  const targetQty = Math.min(10, (existing?.quantity ?? 0) + quantity);
  if (targetQty > variant.stock) {
    throw outOfStock(`Only ${variant.stock} left in stock.`);
  }

  const now = new Date().toISOString();
  if (existing) {
    await db.cart_items.updateOne({ _id: existing._id }, { $set: { quantity: targetQty } });
  } else {
    await db.cart_items.insertOne({
      _id: randomId("ci"),
      cart_id: cartId,
      variant_id: variantId,
      quantity,
      created_at: now,
    } as any);
  }
  await db.carts.updateOne({ _id: cartId }, { $set: { updated_at: now } });
  return getCart(userId);
}

export async function setCartQuantity(userId: string, variantId: string, quantity: number): Promise<CartSummary> {
  const db = await getDb();
  const cart = await db.carts.findOne({ user_id: userId });
  if (!cart) return getCart(userId);

  if (quantity === 0) {
    await db.cart_items.deleteOne({ cart_id: cart._id, variant_id: variantId });
    return getCart(userId);
  }

  const variant = await db.product_variants.findOne({ _id: variantId });
  if (!variant) throw notFound("That product is no longer available.");
  if (quantity > variant.stock) throw outOfStock(`Only ${variant.stock} left in stock.`);

  await db.cart_items.updateOne(
    { cart_id: cart._id, variant_id: variantId },
    { $set: { quantity } },
  );
  return getCart(userId);
}

export async function removeFromCart(userId: string, variantId: string): Promise<CartSummary> {
  return setCartQuantity(userId, variantId, 0);
}

export async function findCoupon(code: string): Promise<CouponRow | null> {
  const db = await getDb();
  const row = await db.coupons.findOne({ code: code.toUpperCase() });
  if (!row) return null;
  return {
    id: row._id,
    code: row.code,
    type: row.type as "percent" | "fixed",
    value: row.value,
    min_subtotal: row.min_subtotal,
    max_discount: row.max_discount,
    starts_at: row.starts_at,
    ends_at: row.ends_at,
    is_active: row.is_active,
    usage_limit: row.usage_limit,
    used_count: row.used_count,
  };
}

export async function getCartWith(store: Store, userId: string): Promise<CartSummary> {
  const cart = await store.carts.findOne({ user_id: userId });
  if (!cart) {
    const empty: Totals = computeTotals(0, 0);
    return { cartId: "", items: [], itemCount: 0, subtotal: 0, totals: empty };
  }
  // reuse hydrate via store
  const rows = await store.cart_items.find({ cart_id: cart._id }).sort({ created_at: 1 }).toArray();
  const variantIds = rows.map((r: any) => r.variant_id);
  const variants = variantIds.length ? await store.product_variants.find({ _id: { $in: variantIds } }).toArray() : [];
  const variantMap = new Map((variants as any[]).map((v) => [v._id, v]));
  const productIds = [...new Set((variants as any[]).map((v) => v.product_id))];
  const products = productIds.length ? await store.products.find({ _id: { $in: productIds }, status: "active" }).toArray() : [];
  const productMap = new Map((products as any[]).map((p) => [p._id, p]));
  const images = productIds.length ? await store.product_images.find({ product_id: { $in: productIds } }).sort({ position: 1 }).toArray() : [];
  const imageMap = new Map<string, any>();
  for (const img of images as any[]) if (!imageMap.has(img.product_id)) imageMap.set(img.product_id, img);

  const items: CartLine[] = [];
  for (const row of rows as any[]) {
    const variant = variantMap.get(row.variant_id);
    if (!variant || variant.is_active !== 1) continue;
    const product = productMap.get(variant.product_id);
    if (!product || product.status !== "active") continue;
    const image = imageMap.get(product._id);
    items.push({
      id: row._id,
      variantId: row.variant_id,
      productId: product._id,
      productName: product.name,
      productSlug: product.slug,
      variantName: variant.name,
      sku: variant.sku,
      unitPrice: variant.price,
      quantity: row.quantity,
      lineTotal: variant.price * row.quantity,
      stock: variant.stock,
      imageUrl: image?.url ?? null,
      imageAlt: image?.alt ?? null,
    });
  }
  const subtotal = items.reduce((sum, item) => sum + item.lineTotal, 0);
  return { cartId: cart._id, items, itemCount: items.reduce((s, i) => s + i.quantity, 0), subtotal, totals: computeTotals(subtotal, 0) };
}

export async function findCouponWith(store: Store, code: string): Promise<CouponRow | null> {
  const row = await store.coupons.findOne({ code: code.toUpperCase() });
  if (!row) return null;
  return {
    id: row._id,
    code: row.code,
    type: row.type as "percent" | "fixed",
    value: row.value,
    min_subtotal: row.min_subtotal,
    max_discount: row.max_discount,
    starts_at: row.starts_at,
    ends_at: row.ends_at,
    is_active: row.is_active,
    usage_limit: row.usage_limit,
    used_count: row.used_count,
  };
}
