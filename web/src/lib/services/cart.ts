import { allRows, firstRow, getDb } from "../db";
import { randomId } from "../crypto";
import { notFound, outOfStock } from "../errors";
import { computeTotals, type Totals } from "../money";
import type { CouponLike } from "../money";

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

interface CartRow {
  id: string;
  variant_id: string;
  quantity: number;
  variant_name: string;
  sku: string;
  price: number;
  stock: number;
  product_id: string;
  product_name: string;
  slug: string;
  image_url: string | null;
  image_alt: string | null;
}

export async function getCart(userId: string): Promise<CartSummary> {
  const db = await getDb();
  const cart = await firstRow<{ id: string }>("SELECT id FROM carts WHERE user_id = ?", [userId]);
  if (!cart) {
    const empty: Totals = computeTotals(0, 0);
    return { cartId: "", items: [], itemCount: 0, subtotal: 0, totals: empty };
  }

  const rows = await allRows<CartRow>(
    `SELECT ci.id, ci.variant_id, ci.quantity,
            pv.name AS variant_name, pv.sku, pv.price, pv.stock,
            p.id AS product_id, p.name AS product_name, p.slug,
            (SELECT url FROM product_images pi WHERE pi.product_id = p.id ORDER BY pi.position ASC LIMIT 1) AS image_url,
            (SELECT alt FROM product_images pi WHERE pi.product_id = p.id ORDER BY pi.position ASC LIMIT 1) AS image_alt
       FROM cart_items ci
       JOIN product_variants pv ON pv.id = ci.variant_id
       JOIN products p ON p.id = pv.product_id
      WHERE ci.cart_id = ?
        AND pv.is_active = 1
        AND p.status = 'active'
      ORDER BY ci.created_at ASC`,
    [cart.id],
  );

  const items: CartLine[] = rows.map((row) => ({
    id: row.id,
    variantId: row.variant_id,
    productId: row.product_id,
    productName: row.product_name,
    productSlug: row.slug,
    variantName: row.variant_name,
    sku: row.sku,
    unitPrice: row.price,
    quantity: row.quantity,
    lineTotal: row.price * row.quantity,
    stock: row.stock,
    imageUrl: row.image_url,
    imageAlt: row.image_alt,
  }));

  const subtotal = items.reduce((sum, item) => sum + item.lineTotal, 0);
  return {
    cartId: cart.id,
    items,
    itemCount: items.reduce((sum, item) => sum + item.quantity, 0),
    subtotal,
    totals: computeTotals(subtotal, 0),
  };
}

export async function ensureCart(userId: string): Promise<string> {
  const existing = await firstRow<{ id: string }>("SELECT id FROM carts WHERE user_id = ?", [userId]);
  if (existing) return existing.id;
  const db = await getDb();
  const id = randomId("cart");
  const now = new Date().toISOString();
  await db
    .prepare("INSERT INTO carts (id, user_id, created_at, updated_at) VALUES (?, ?, ?, ?)")
    .bind(id, userId, now, now)
    .run();
  return id;
}

export async function addToCart(userId: string, variantId: string, quantity: number): Promise<CartSummary> {
  const db = await getDb();
  const variant = await firstRow<{ id: string; stock: number; is_active: number; status: string }>(
    `SELECT pv.id, pv.stock, pv.is_active, p.status
       FROM product_variants pv JOIN products p ON p.id = pv.product_id
      WHERE pv.id = ?`,
    [variantId],
  );
  if (!variant || variant.is_active !== 1 || variant.status !== "active") {
    throw notFound("That product is no longer available.");
  }

  const cartId = await ensureCart(userId);
  const existing = await firstRow<{ id: string; quantity: number }>(
    "SELECT id, quantity FROM cart_items WHERE cart_id = ? AND variant_id = ?",
    [cartId, variantId],
  );
  const targetQty = Math.min(10, (existing?.quantity ?? 0) + quantity);
  if (targetQty > variant.stock) {
    throw outOfStock(`Only ${variant.stock} left in stock.`);
  }

  const now = new Date().toISOString();
  if (existing) {
    await db
      .prepare("UPDATE cart_items SET quantity = ? WHERE id = ?")
      .bind(targetQty, existing.id)
      .run();
  } else {
    await db
      .prepare("INSERT INTO cart_items (id, cart_id, variant_id, quantity, created_at) VALUES (?, ?, ?, ?, ?)")
      .bind(randomId("ci"), cartId, variantId, quantity, now)
      .run();
  }
  await db.prepare("UPDATE carts SET updated_at = ? WHERE id = ?").bind(now, cartId).run();
  return getCart(userId);
}

export async function setCartQuantity(userId: string, variantId: string, quantity: number): Promise<CartSummary> {
  const db = await getDb();
  const cart = await firstRow<{ id: string }>("SELECT id FROM carts WHERE user_id = ?", [userId]);
  if (!cart) return getCart(userId);

  if (quantity === 0) {
    await db.prepare("DELETE FROM cart_items WHERE cart_id = ? AND variant_id = ?").bind(cart.id, variantId).run();
    return getCart(userId);
  }

  const variant = await firstRow<{ stock: number }>("SELECT stock FROM product_variants WHERE id = ?", [variantId]);
  if (!variant) throw notFound("That product is no longer available.");
  if (quantity > variant.stock) throw outOfStock(`Only ${variant.stock} left in stock.`);

  await db
    .prepare("UPDATE cart_items SET quantity = ? WHERE cart_id = ? AND variant_id = ?")
    .bind(quantity, cart.id, variantId)
    .run();
  return getCart(userId);
}

export async function removeFromCart(userId: string, variantId: string): Promise<CartSummary> {
  return setCartQuantity(userId, variantId, 0);
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

export async function findCoupon(code: string): Promise<CouponRow | null> {
  return firstRow<CouponRow>(
    `SELECT id, code, type, value, min_subtotal, max_discount, usage_limit, used_count,
            starts_at, ends_at, is_active
       FROM coupons WHERE code = ?`,
    [code.toUpperCase()],
  );
}
