import { randomId } from "./crypto";
import { hashPassword } from "./password";
import type { Store } from "./db";
import seed from "./seed-data.json";

const INDEX_VERSION = "mongo-2";

let bootstrapPromise: Promise<void> | null = null;

export function ensureDatabaseReady(store: Store): Promise<void> {
  if (bootstrapPromise) return bootstrapPromise;
  bootstrapPromise = run(store).catch((error) => {
    bootstrapPromise = null;
    throw error;
  });
  return bootstrapPromise;
}

async function run(store: Store): Promise<void> {
  await ensureIndexes(store);
  if ((process.env.BOOTSTRAP_DB ?? "") === "1") await seedCatalogue(store);
  await seedDemoAccounts(store);
}

async function ensureIndexes(store: Store): Promise<void> {
  const marker = await store.settings.findOne({ _id: "indexes_version" });
  if (marker?.value === INDEX_VERSION) return;

  await store.users.createIndex({ email: 1 }, { unique: true });
  await store.sessions.createIndex({ user_id: 1 });
  await store.addresses.createIndex({ user_id: 1 });
  await store.categories.createIndex({ slug: 1 }, { unique: true });
  await store.products.createIndex({ slug: 1 }, { unique: true });
  await store.products.createIndex({ status: 1 });
  await store.products.createIndex({ category_id: 1 });
  await store.product_images.createIndex({ product_id: 1 });
  await store.product_variants.createIndex({ sku: 1 }, { unique: true });
  await store.product_variants.createIndex({ product_id: 1 });
  await store.carts.createIndex({ user_id: 1 }, { unique: true });
  await store.cart_items.createIndex({ cart_id: 1, variant_id: 1 }, { unique: true });
  await store.wishlist_items.createIndex({ user_id: 1, product_id: 1 }, { unique: true });
  await store.coupons.createIndex({ code: 1 }, { unique: true });
  await store.orders.createIndex({ number: 1 }, { unique: true });
  await store.orders.createIndex({ user_id: 1 });
  await store.orders.createIndex({ status: 1 });
  await store.order_items.createIndex({ order_id: 1 });
  await store.payments.createIndex({ provider_order_id: 1 }, { unique: true, partialFilterExpression: { provider_order_id: { $type: "string" } } });
  await store.payments.createIndex({ provider_payment_id: 1 }, { unique: true, partialFilterExpression: { provider_payment_id: { $type: "string" } } });
  await store.payments.createIndex({ order_id: 1 });
  await store.refunds.createIndex({ request_key: 1 }, { unique: true, partialFilterExpression: { request_key: { $type: "string" } } });
  await store.refunds.createIndex({ provider_refund_id: 1 }, { unique: true, partialFilterExpression: { provider_refund_id: { $type: "string" } } });
  await store.refunds.createIndex({ order_id: 1 });
  await store.refunds.createIndex({ status: 1, created_at: 1 });
  await store.reviews.createIndex({ product_id: 1, user_id: 1 }, { unique: true });
  await store.reviews.createIndex({ product_id: 1, status: 1 });
  await store.notifications.createIndex({ user_id: 1, created_at: 1 });
  await store.contact_messages.createIndex({ created_at: 1 });
  await store.webhook_events.createIndex({ provider: 1, event_id: 1 }, { unique: true });
  await store.idempotency_keys.createIndex({ _id: 1 });
  await store.order_status_history.createIndex({ order_id: 1, created_at: 1 });
  await store.admin_audit_log.createIndex({ created_at: 1 });
  await store.admin_audit_log.createIndex({ entity_type: 1, entity_id: 1 });
  await store.inventory_movements.createIndex({ variant_id: 1, created_at: 1 });
  await store.inventory_movements.createIndex({ reference_type: 1, reference_id: 1 });
  await store.signup_otp_challenges.createIndex({ user_id: 1, issued_at: 1 });
  await store.signup_otp_challenges.createIndex({ email: 1, issued_at: 1 });
  await store.password_reset_challenges.createIndex({ user_id: 1, issued_at: 1 });
  await store.password_reset_challenges.createIndex({ email: 1, issued_at: 1 });
  await store.device_tokens.createIndex({ token: 1 }, { unique: true });
  await store.device_tokens.createIndex({ user_id: 1 });
  await store.rate_limits.createIndex({ window_start: 1 });

  await store.settings.updateOne(
    { _id: "indexes_version" },
    { $set: { value: INDEX_VERSION } },
    { upsert: true },
  );
}

async function seedCatalogue(store: Store): Promise<void> {
  const now = new Date().toISOString();
  const productCount = await store.products.countDocuments({});
  if (productCount > 0) return;

  // categories
  for (const category of seed.categories) {
    await store.categories.insertOne({
      _id: category.id,
      slug: category.slug,
      name: category.name,
      description: category.description ?? null,
      image_url: category.imageUrl ?? null,
      position: category.position,
      created_at: now,
    } as any);
  }

  for (const product of seed.products) {
    await store.products.insertOne({
      _id: product.id,
      slug: product.slug,
      name: product.name,
      tagline: product.tagline ?? null,
      description: product.description,
      category_id: product.categoryId ?? null,
      wax_type: product.waxType ?? null,
      wick_type: product.wickType ?? null,
      burn_time_hours: product.burnTimeHours ?? null,
      scent_notes: product.scentNotes ?? null,
      base_price: product.basePrice,
      compare_at_price: product.compareAtPrice ?? null,
      currency: "INR",
      status: "active",
      is_featured: product.isFeatured ? 1 : 0,
      rating_avg: 0,
      rating_count: 0,
      created_at: now,
      updated_at: now,
    } as any);
    await store.product_images.insertOne({
      _id: `img_${product.id}`,
      product_id: product.id,
      url: product.image,
      alt: product.imageAlt,
      position: 0,
    } as any);
    for (const [index, variant] of product.variants.entries()) {
      await store.product_variants.insertOne({
        _id: variant.id,
        product_id: product.id,
        sku: variant.sku,
        name: variant.name,
        price: variant.price,
        weight_grams: variant.weightGrams ?? null,
        stock: variant.stock,
        low_stock_threshold: variant.lowStockThreshold ?? 5,
        is_active: 1,
        position: index,
      } as any);
    }
  }

  for (const coupon of seed.coupons) {
    await store.coupons.insertOne({
      _id: coupon.id,
      code: coupon.code,
      description: coupon.description ?? null,
      type: coupon.type,
      value: coupon.value,
      min_subtotal: coupon.minSubtotal,
      max_discount: coupon.maxDiscount ?? null,
      usage_limit: coupon.usageLimit ?? null,
      used_count: 0,
      starts_at: null,
      ends_at: null,
      is_active: 1,
      created_at: now,
    } as any);
  }

  // seed reviews
  const reviews = [
    ["rev_seed_1", "prd_cedar_vanilla", "The crackle alone is worth it. Filled our living room within ten minutes without being overpowering.", 5, "usr_demo"],
    ["rev_seed_2", "prd_lavender_bergamot", "Burns clean and even. No tunnelling, no soot on the glass. Repurchased twice.", 5, "usr_demo"],
    ["rev_seed_3", "prd_sandalwood", "You can tell it is real beeswax — the honey note is subtle and lovely.", 4, "usr_admin"],
  ];
  for (const [id, productId, body, rating, userId] of reviews) {
    await store.reviews.insertOne({
      _id: id,
      product_id: productId,
      user_id: userId,
      rating,
      title: null,
      body,
      status: "published",
      created_at: now,
    } as any);
  }

  // refresh ratings
  for (const product of seed.products) {
    const agg = await store.reviews
      .aggregate<{ avg: number; count: number }>([
        { $match: { product_id: product.id, status: "published" } },
        { $group: { _id: null, avg: { $avg: "$rating" }, count: { $sum: 1 } } },
      ])
      .toArray();
    const row = agg[0];
    await store.products.updateOne(
      { _id: product.id },
      { $set: { rating_avg: row?.avg ?? 0, rating_count: row?.count ?? 0 } },
    );
  }

  const adminEmail = process.env.BOOTSTRAP_ADMIN_EMAIL;
  const adminPassword = process.env.BOOTSTRAP_ADMIN_PASSWORD;
  if (adminEmail && adminPassword) {
    const hash = await hashPassword(adminPassword);
    await store.users.insertOne({
      _id: randomId("usr"),
      email: adminEmail.toLowerCase(),
      password_hash: hash,
      name: "Studio Admin",
      phone: null,
      role: "admin",
      created_at: now,
      updated_at: now,
      email_verified_at: now,
    } as any);
  }

  await store.settings.updateOne(
    { _id: "schema_version" },
    { $set: { value: "mongodb" } },
    { upsert: true },
  );
}

const DEMO_ACCOUNTS = [
  { id: "usr_admin", email: "admin@emberandwick.in", name: "Studio Admin", phone: "+91 80 4718 2200", role: "admin", passwordEnv: "DEMO_ADMIN_PASSWORD", fallbackPassword: "AdminPass123!" },
  { id: "usr_manager", email: "manager@emberandwick.in", name: "Studio Manager", phone: "+91 80 4718 2201", role: "admin", passwordEnv: "DEMO_MANAGER_PASSWORD", fallbackPassword: "ManagerPass123!" },
  { id: "usr_demo", email: "customer@example.com", name: "Aarav Menon", phone: "+91 98450 11223", role: "customer", passwordEnv: "DEMO_CUSTOMER_PASSWORD", fallbackPassword: "Customer123!" },
] as const;

async function seedDemoAccounts(store: Store): Promise<void> {
  if ((process.env.SEED_DEMO_ACCOUNTS ?? "") !== "1") return;
  const schema = await store.settings.findOne({ _id: "schema_version" });
  if (!schema?.value) return;
  const now = new Date().toISOString();
  for (const account of DEMO_ACCOUNTS) {
    const existing = await store.users.findOne({ _id: account.id });
    if (existing) continue;
    const password = process.env[account.passwordEnv] ?? account.fallbackPassword;
    const hash = await hashPassword(password);
    await store.users.insertOne({
      _id: account.id,
      email: account.email,
      password_hash: hash,
      name: account.name,
      phone: account.phone,
      role: account.role,
      created_at: now,
      updated_at: now,
      email_verified_at: now,
    } as any);
  }
}
