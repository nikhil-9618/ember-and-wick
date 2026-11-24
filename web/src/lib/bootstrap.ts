import type { D1Database } from "./types-d1";
import { SCHEMA_MIGRATIONS, SCHEMA_VERSION } from "./schema.generated";
import seed from "./seed-data.json";
import { randomId } from "./crypto";
import { hashPassword } from "./password";

/**
 * Applies any migration the database has not recorded yet and seeds the
 * catalogue on a completely empty database.
 *
 * This exists so a hosted deployment is usable without shell access to
 * Cloudflare. It is opt-in (BOOTSTRAP_DB=1) and each migration is applied at most
 * once, tracked by the `schema_version` row. Production should prefer
 * `npm run db:migrate:remote`.
 */
let bootstrapPromise: Promise<void> | null = null;

export function ensureDatabaseReady(db: D1Database): Promise<void> {
  if (bootstrapPromise) return bootstrapPromise;
  bootstrapPromise = run(db).catch((error) => {
    bootstrapPromise = null;
    throw error;
  });
  return bootstrapPromise;
}

async function run(db: D1Database): Promise<void> {
  await applyMigrations(db);
  await seedDemoAccounts(db);
}

async function applyMigrations(db: D1Database): Promise<void> {
  const enabled = (process.env.BOOTSTRAP_DB ?? "") === "1";
  if (!enabled) return;

  const existing = await db
    .prepare("SELECT value FROM settings WHERE key = 'schema_version'")
    .first<{ value: string }>()
    .catch(() => null);

  const appliedIndex = existing?.value
    ? SCHEMA_MIGRATIONS.findIndex((migration) => migration.version === existing.value)
    : -1;
  if (existing?.value && appliedIndex === -1) {
    throw new Error(
      `Database schema version "${existing.value}" is not known to this build. Run the matching migrations before deploying.`,
    );
  }
  const pending = SCHEMA_MIGRATIONS.slice(appliedIndex + 1);

  for (const migration of pending) {
    // D1's exec() rejects PRAGMA statements, so each migration is split and
    // applied as a single atomic batch instead.
    const statements = migration.sql
      .split(";")
      .map((statement) => statement.trim())
      .filter((statement) => statement.length > 0 && !/^pragma\b/i.test(statement));
    await db.batch(statements.map((statement) => db.prepare(statement)));
    await db
      .prepare("INSERT OR REPLACE INTO settings (key, value) VALUES ('schema_version', ?)")
      .bind(migration.version)
      .run();
  }

  // Nothing to seed if every migration was already applied by a previous boot.
  if (pending.length === 0) return;

  const now = new Date().toISOString();
  const productCount = await db
    .prepare("SELECT COUNT(*) AS total FROM products")
    .first<{ total: number }>()
    .catch(() => null);

  if ((productCount?.total ?? 0) === 0) {
    const statements: string[] = [];
    const q = (value: unknown) =>
      value === null || value === undefined ? "NULL" : `'${String(value).replace(/'/g, "''")}'`;

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
           ${q(product.categoryId)}, ${q(product.waxType)}, ${q(product.wickType)}, ${product.burnTimeHours},
           ${q(product.scentNotes)}, ${product.basePrice}, ${product.compareAtPrice === null ? "NULL" : product.compareAtPrice},
           'INR', 'active', ${product.isFeatured ? 1 : 0}, ${q(now)}, ${q(now)});`,
        `INSERT OR IGNORE INTO product_images (id, product_id, url, alt, position)
         VALUES (${q(`img_${product.id}`)}, ${q(product.id)}, ${q(product.image)}, ${q(product.imageAlt)}, 0);`,
      );
      product.variants.forEach((variant, index) => {
        statements.push(
          `INSERT OR IGNORE INTO product_variants (id, product_id, sku, name, price, weight_grams, stock,
             low_stock_threshold, is_active, position)
           VALUES (${q(variant.id)}, ${q(product.id)}, ${q(variant.sku)}, ${q(variant.name)}, ${variant.price},
             ${variant.weightGrams}, ${variant.stock}, ${variant.lowStockThreshold}, 1, ${index});`,
        );
      });
    }

    for (const coupon of seed.coupons) {
      statements.push(
        `INSERT OR IGNORE INTO coupons (id, code, description, type, value, min_subtotal, max_discount, usage_limit,
           used_count, is_active, created_at)
         VALUES (${q(coupon.id)}, ${q(coupon.code)}, ${q(coupon.description)}, ${q(coupon.type)}, ${coupon.value},
           ${coupon.minSubtotal}, ${coupon.maxDiscount === null ? "NULL" : coupon.maxDiscount},
           ${coupon.usageLimit === null ? "NULL" : coupon.usageLimit}, 0, 1, ${q(now)});`,
      );
    }

    await db.batch(statements.map((sql) => db.prepare(sql)));

    // Admin account is only created when a bootstrap password is explicitly provided.
    const adminEmail = process.env.BOOTSTRAP_ADMIN_EMAIL;
    const adminPassword = process.env.BOOTSTRAP_ADMIN_PASSWORD;
    if (adminEmail && adminPassword) {
      const hash = await hashPassword(adminPassword);
      await db
        .prepare(
          "INSERT OR IGNORE INTO users (id, email, password_hash, name, phone, role, created_at, updated_at, email_verified_at) VALUES (?, ?, ?, 'Studio Admin', NULL, 'admin', ?, ?, ?)",
        )
        .bind(randomId("usr"), adminEmail.toLowerCase(), hash, now, now, now)
        .run();
    }
  }

  await db
    .prepare("INSERT OR REPLACE INTO settings (key, value) VALUES ('schema_version', ?)")
    .bind(SCHEMA_VERSION)
    .run();
}

/**
 * Optional demonstration accounts for a hosted demo build.
 *
 * Off unless SEED_DEMO_ACCOUNTS=1, so a real store never gains a known-password
 * login by accident. Existing rows are left untouched, so a rotated password is
 * not reset on the next deploy.
 */
const DEMO_ACCOUNTS = [
  {
    id: "usr_admin",
    email: "admin@emberandwick.in",
    name: "Studio Admin",
    phone: "+91 80 4718 2200",
    role: "admin",
    passwordEnv: "DEMO_ADMIN_PASSWORD",
    fallbackPassword: "AdminPass123!",
  },
  {
    id: "usr_manager",
    email: "manager@emberandwick.in",
    name: "Studio Manager",
    phone: "+91 80 4718 2201",
    role: "admin",
    passwordEnv: "DEMO_MANAGER_PASSWORD",
    fallbackPassword: "ManagerPass123!",
  },
  {
    id: "usr_demo",
    email: "customer@example.com",
    name: "Aarav Menon",
    phone: "+91 98450 11223",
    role: "customer",
    passwordEnv: "DEMO_CUSTOMER_PASSWORD",
    fallbackPassword: "Customer123!",
  },
] as const;

async function seedDemoAccounts(db: D1Database): Promise<void> {
  if ((process.env.SEED_DEMO_ACCOUNTS ?? "") !== "1") return;

  // Only seed into a database whose schema has already been applied.
  const schema = await db
    .prepare("SELECT value FROM settings WHERE key = 'schema_version'")
    .first<{ value: string }>()
    .catch(() => null);
  if (!schema?.value) return;

  const existing = await db
    .prepare("SELECT id FROM users WHERE id IN ('usr_admin', 'usr_manager', 'usr_demo')")
    .all<{ id: string }>();
  const present = new Set((existing.results ?? []).map((row) => row.id));
  const now = new Date().toISOString();

  for (const account of DEMO_ACCOUNTS) {
    if (present.has(account.id)) continue;
    const password = process.env[account.passwordEnv] ?? account.fallbackPassword;
    const hash = await hashPassword(password);
    await db
      .prepare(
        `INSERT OR IGNORE INTO users (id, email, password_hash, name, phone, role, created_at, updated_at, email_verified_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      )
      .bind(account.id, account.email, hash, account.name, account.phone, account.role, now, now, now)
      .run();
  }
}
