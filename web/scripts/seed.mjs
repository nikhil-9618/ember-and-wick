#!/usr/bin/env node
/**
 * Seeds the local D1 database from src/lib/seed-data.json (the single source of
 * catalogue truth, also used by the runtime bootstrap).
 *
 *   node scripts/seed.mjs           # insert missing rows
 *   node scripts/seed.mjs --reset   # wipe app tables first (local only)
 *
 * Passwords are hashed with the same PBKDF2 parameters as the app. The printed
 * credentials are for local development only.
 */
import { spawnSync } from "node:child_process";
import { mkdirSync, readdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const here = dirname(fileURLToPath(import.meta.url));
const root = join(here, "..");
const reset = process.argv.includes("--reset");
const seed = JSON.parse(readFileSync(join(root, "src", "lib", "seed-data.json"), "utf8"));

// Cloudflare Workers rejects PBKDF2 above 100,000 iterations, so deployed hashes
// must stay at or below that ceiling.
const ITERATIONS = 100_000;

function b64url(bytes) {
  return Buffer.from(bytes).toString("base64").replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

async function hashPassword(password) {
  const salt = crypto.getRandomValues(new Uint8Array(16));
  const key = await crypto.subtle.importKey("raw", new TextEncoder().encode(password), "PBKDF2", false, ["deriveBits"]);
  const bits = await crypto.subtle.deriveBits({ name: "PBKDF2", salt, iterations: ITERATIONS, hash: "SHA-256" }, key, 256);
  return `pbkdf2$sha256$${ITERATIONS}$${b64url(salt)}$${b64url(new Uint8Array(bits))}`;
}

const q = (value) => (value === null || value === undefined ? "NULL" : `'${String(value).replace(/'/g, "''")}'`);
const latestMigration = readdirSync(join(root, "migrations"))
  .filter((file) => file.endsWith(".sql"))
  .sort()
  .at(-1)
  ?.replace(/\.sql$/, "");
const n = (value) => (value === null || value === undefined ? "NULL" : String(value));
const now = new Date().toISOString();
const statements = [];

if (reset) {
  statements.push(
    "DELETE FROM webhook_events;",
    "DELETE FROM refunds;",
    "DELETE FROM payments;",
    "DELETE FROM order_items;",
    "DELETE FROM orders;",
    "DELETE FROM cart_items;",
    "DELETE FROM carts;",
    "DELETE FROM wishlist_items;",
    "DELETE FROM reviews;",
    "DELETE FROM notifications;",
    "DELETE FROM contact_messages;",
    "DELETE FROM idempotency_keys;",
    "DELETE FROM rate_limits;",
    "DELETE FROM device_tokens;",
    "DELETE FROM addresses;",
    "DELETE FROM sessions;",
    "DELETE FROM product_images;",
    "DELETE FROM product_variants;",
    "DELETE FROM products;",
    "DELETE FROM categories;",
    "DELETE FROM coupons;",
    "DELETE FROM users;",
  );
}

const adminHash = await hashPassword(process.env.SEED_ADMIN_PASSWORD || "AdminPass123!");
const managerHash = await hashPassword(process.env.SEED_MANAGER_PASSWORD || "ManagerPass123!");
const customerHash = await hashPassword(process.env.SEED_CUSTOMER_PASSWORD || "Customer123!");

// Two admins so the refund approval threshold (a second pair of eyes) can be
// exercised locally: one admin requests the refund, the other approves it.
statements.push(
  `INSERT OR IGNORE INTO users (id, email, password_hash, name, phone, role, created_at, updated_at) VALUES
   ('usr_admin', 'admin@emberandwick.in', ${q(adminHash)}, 'Studio Admin', '+91 80 4718 2200', 'admin', ${q(now)}, ${q(now)}),
   ('usr_manager', 'manager@emberandwick.in', ${q(managerHash)}, 'Studio Manager', '+91 80 4718 2201', 'admin', ${q(now)}, ${q(now)}),
   ('usr_demo', 'customer@example.com', ${q(customerHash)}, 'Aarav Menon', '+91 98450 11223', 'customer', ${q(now)}, ${q(now)});`,
);

for (const category of seed.categories) {
  statements.push(
    `INSERT OR IGNORE INTO categories (id, slug, name, description, image_url, position, created_at)
     VALUES (${q(category.id)}, ${q(category.slug)}, ${q(category.name)}, ${q(category.description)}, ${q(category.imageUrl)}, ${category.position}, ${q(now)});`,
  );
}

for (const product of seed.products) {
  statements.push(
    `INSERT OR IGNORE INTO products (id, slug, name, tagline, description, category_id, wax_type, wick_type,
       burn_time_hours, scent_notes, base_price, compare_at_price, currency, status, is_featured, created_at, updated_at)
     VALUES (${q(product.id)}, ${q(product.slug)}, ${q(product.name)}, ${q(product.tagline)}, ${q(product.description)},
       ${q(product.categoryId)}, ${q(product.waxType)}, ${q(product.wickType)}, ${product.burnTimeHours}, ${q(product.scentNotes)},
       ${product.basePrice}, ${n(product.compareAtPrice)}, 'INR', 'active', ${product.isFeatured ? 1 : 0}, ${q(now)}, ${q(now)});`,
    `INSERT OR IGNORE INTO product_images (id, product_id, url, alt, position)
     VALUES (${q(`img_${product.id}`)}, ${q(product.id)}, ${q(product.image)}, ${q(product.imageAlt)}, 0);`,
  );
  product.variants.forEach((variant, index) => {
    statements.push(
      `INSERT OR IGNORE INTO product_variants (id, product_id, sku, name, price, weight_grams, stock, low_stock_threshold, is_active, position)
       VALUES (${q(variant.id)}, ${q(product.id)}, ${q(variant.sku)}, ${q(variant.name)}, ${variant.price}, ${n(variant.weightGrams)},
         ${variant.stock}, ${variant.lowStockThreshold}, 1, ${index});`,
    );
  });
}

for (const coupon of seed.coupons) {
  statements.push(
    `INSERT OR IGNORE INTO coupons (id, code, description, type, value, min_subtotal, max_discount, usage_limit, used_count, is_active, created_at)
     VALUES (${q(coupon.id)}, ${q(coupon.code)}, ${q(coupon.description)}, ${q(coupon.type)}, ${coupon.value},
       ${coupon.minSubtotal}, ${n(coupon.maxDiscount)}, ${n(coupon.usageLimit)}, 0, 1, ${q(now)});`,
  );
}

const reviews = [
  ["rev_seed_1", "prd_cedar_vanilla", "The crackle alone is worth it. Filled our living room within ten minutes without being overpowering.", 5, "usr_demo"],
  ["rev_seed_2", "prd_lavender_bergamot", "Burns clean and even. No tunnelling, no soot on the glass. Repurchased twice.", 5, "usr_demo"],
  ["rev_seed_3", "prd_sandalwood", "You can tell it is real beeswax — the honey note is subtle and lovely.", 4, "usr_admin"],
];

for (const [id, productId, body, rating, userId] of reviews) {
  statements.push(
    `INSERT OR IGNORE INTO reviews (id, product_id, user_id, rating, title, body, status, created_at)
     VALUES (${q(id)}, ${q(productId)}, ${q(userId)}, ${rating}, NULL, ${q(body)}, 'published', ${q(now)});`,
  );
}

statements.push(
  `UPDATE products SET rating_avg = COALESCE((SELECT AVG(rating) FROM reviews r WHERE r.product_id = products.id AND r.status = 'published'), 0),
     rating_count = (SELECT COUNT(*) FROM reviews r WHERE r.product_id = products.id AND r.status = 'published');`,
  `INSERT OR REPLACE INTO settings (key, value) VALUES ('schema_version', ${q(latestMigration)});`,
);

const tmpDir = join(here, ".tmp");
mkdirSync(tmpDir, { recursive: true });
const file = join(tmpDir, "seed.sql");
writeFileSync(file, `${statements.join("\n")}\n`, "utf8");

const result = spawnSync(
  process.platform === "win32" ? "npx.cmd" : "npx",
  [
    "wrangler",
    "d1",
    "execute",
    "DB",
    "--local",
    "--config",
    process.env.WRANGLER_CONFIG ?? "freebuff.wrangler.jsonc",
    "--file",
    file,
  ],
  { cwd: root, stdio: "inherit" },
);
rmSync(file, { force: true });

if (result.status !== 0) {
  console.error("\nSeed failed. Run `npm run db:migrate:local` first.\n");
  process.exit(result.status ?? 1);
}

console.log(`
Seeded Ember & Wick from src/lib/seed-data.json.

  Admin     admin@emberandwick.in    ${process.env.SEED_ADMIN_PASSWORD ? "(SEED_ADMIN_PASSWORD)" : "AdminPass123!"}
  Manager   manager@emberandwick.in  ${process.env.SEED_MANAGER_PASSWORD ? "(SEED_MANAGER_PASSWORD)" : "ManagerPass123!"}
  Customer  customer@example.com      ${process.env.SEED_CUSTOMER_PASSWORD ? "(SEED_CUSTOMER_PASSWORD)" : "Customer123!"}

Local development credentials only. Never seed a production database with these.
`);
