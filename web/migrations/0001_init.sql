-- Ember & Wick schema (Cloudflare D1 / SQLite)
-- Money is stored as integer paise. Timestamps are ISO-8601 UTC strings.
-- Every critical invariant is enforced in the database, not only in application code.

PRAGMA foreign_keys = ON;

CREATE TABLE IF NOT EXISTS users (
  id            TEXT PRIMARY KEY,
  email         TEXT NOT NULL UNIQUE,
  password_hash TEXT NOT NULL,
  name          TEXT NOT NULL,
  phone         TEXT,
  role          TEXT NOT NULL DEFAULT 'customer' CHECK (role IN ('customer', 'admin')),
  created_at    TEXT NOT NULL,
  updated_at    TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS sessions (
  id         TEXT PRIMARY KEY,              -- SHA-256 of the session token
  user_id    TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  created_at TEXT NOT NULL,
  expires_at TEXT NOT NULL,
  revoked_at TEXT,
  user_agent TEXT
);
CREATE INDEX IF NOT EXISTS idx_sessions_user ON sessions(user_id);

CREATE TABLE IF NOT EXISTS addresses (
  id          TEXT PRIMARY KEY,
  user_id     TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  label       TEXT,
  full_name   TEXT NOT NULL,
  phone       TEXT NOT NULL,
  line1       TEXT NOT NULL,
  line2       TEXT,
  city        TEXT NOT NULL,
  state       TEXT NOT NULL,
  postal_code TEXT NOT NULL,
  country     TEXT NOT NULL DEFAULT 'IN',
  is_default  INTEGER NOT NULL DEFAULT 0 CHECK (is_default IN (0, 1)),
  created_at  TEXT NOT NULL,
  updated_at  TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_addresses_user ON addresses(user_id);

CREATE TABLE IF NOT EXISTS categories (
  id          TEXT PRIMARY KEY,
  slug        TEXT NOT NULL UNIQUE,
  name        TEXT NOT NULL,
  description TEXT,
  image_url   TEXT,
  position    INTEGER NOT NULL DEFAULT 0,
  created_at  TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS products (
  id               TEXT PRIMARY KEY,
  slug             TEXT NOT NULL UNIQUE,
  name             TEXT NOT NULL,
  tagline          TEXT,
  description      TEXT NOT NULL,
  category_id      TEXT REFERENCES categories(id) ON DELETE SET NULL,
  wax_type         TEXT,
  wick_type        TEXT,
  burn_time_hours  INTEGER,
  scent_notes      TEXT,
  base_price       INTEGER NOT NULL CHECK (base_price >= 0),
  compare_at_price INTEGER CHECK (compare_at_price IS NULL OR compare_at_price >= 0),
  currency         TEXT NOT NULL DEFAULT 'INR',
  status           TEXT NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'active', 'archived')),
  is_featured      INTEGER NOT NULL DEFAULT 0 CHECK (is_featured IN (0, 1)),
  rating_avg       REAL NOT NULL DEFAULT 0,
  rating_count     INTEGER NOT NULL DEFAULT 0,
  created_at       TEXT NOT NULL,
  updated_at       TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_products_status ON products(status);
CREATE INDEX IF NOT EXISTS idx_products_category ON products(category_id);

CREATE TABLE IF NOT EXISTS product_images (
  id         TEXT PRIMARY KEY,
  product_id TEXT NOT NULL REFERENCES products(id) ON DELETE CASCADE,
  url        TEXT NOT NULL,
  alt        TEXT NOT NULL,
  position   INTEGER NOT NULL DEFAULT 0
);
CREATE INDEX IF NOT EXISTS idx_product_images_product ON product_images(product_id);

-- stock has a CHECK so that any over-sell attempt aborts the surrounding D1 transaction.
CREATE TABLE IF NOT EXISTS product_variants (
  id                  TEXT PRIMARY KEY,
  product_id          TEXT NOT NULL REFERENCES products(id) ON DELETE CASCADE,
  sku                 TEXT NOT NULL UNIQUE,
  name                TEXT NOT NULL,
  price               INTEGER NOT NULL CHECK (price >= 0),
  weight_grams        INTEGER,
  stock               INTEGER NOT NULL DEFAULT 0 CHECK (stock >= 0),
  low_stock_threshold INTEGER NOT NULL DEFAULT 5 CHECK (low_stock_threshold >= 0),
  is_active           INTEGER NOT NULL DEFAULT 1 CHECK (is_active IN (0, 1)),
  position            INTEGER NOT NULL DEFAULT 0
);
CREATE INDEX IF NOT EXISTS idx_variants_product ON product_variants(product_id);

CREATE TABLE IF NOT EXISTS carts (
  id         TEXT PRIMARY KEY,
  user_id    TEXT NOT NULL UNIQUE REFERENCES users(id) ON DELETE CASCADE,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS cart_items (
  id         TEXT PRIMARY KEY,
  cart_id    TEXT NOT NULL REFERENCES carts(id) ON DELETE CASCADE,
  variant_id TEXT NOT NULL REFERENCES product_variants(id) ON DELETE CASCADE,
  quantity   INTEGER NOT NULL CHECK (quantity > 0 AND quantity <= 10),
  created_at TEXT NOT NULL,
  UNIQUE (cart_id, variant_id)
);

CREATE TABLE IF NOT EXISTS wishlist_items (
  id         TEXT PRIMARY KEY,
  user_id    TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  product_id TEXT NOT NULL REFERENCES products(id) ON DELETE CASCADE,
  created_at TEXT NOT NULL,
  UNIQUE (user_id, product_id)
);

CREATE TABLE IF NOT EXISTS coupons (
  id            TEXT PRIMARY KEY,
  code          TEXT NOT NULL UNIQUE,
  description   TEXT,
  type          TEXT NOT NULL CHECK (type IN ('percent', 'fixed')),
  value         INTEGER NOT NULL CHECK (value > 0),
  min_subtotal  INTEGER NOT NULL DEFAULT 0 CHECK (min_subtotal >= 0),
  max_discount  INTEGER CHECK (max_discount IS NULL OR max_discount > 0),
  usage_limit   INTEGER CHECK (usage_limit IS NULL OR usage_limit > 0),
  used_count    INTEGER NOT NULL DEFAULT 0 CHECK (used_count >= 0),
  starts_at     TEXT,
  ends_at       TEXT,
  is_active     INTEGER NOT NULL DEFAULT 1 CHECK (is_active IN (0, 1)),
  created_at    TEXT NOT NULL,
  CHECK (usage_limit IS NULL OR used_count <= usage_limit)
);

CREATE TABLE IF NOT EXISTS orders (
  id                     TEXT PRIMARY KEY,
  number                 TEXT NOT NULL UNIQUE,
  user_id                TEXT REFERENCES users(id) ON DELETE SET NULL,
  email                  TEXT NOT NULL,
  status                 TEXT NOT NULL CHECK (status IN (
                           'pending_payment','paid','processing','packed','shipped',
                           'delivered','cancelled','payment_failed','refunded')),
  payment_status         TEXT NOT NULL CHECK (payment_status IN (
                           'unpaid','paid','failed','refunded','partially_refunded')),
  subtotal               INTEGER NOT NULL CHECK (subtotal >= 0),
  discount               INTEGER NOT NULL DEFAULT 0 CHECK (discount >= 0),
  shipping_fee           INTEGER NOT NULL DEFAULT 0 CHECK (shipping_fee >= 0),
  tax                    INTEGER NOT NULL DEFAULT 0 CHECK (tax >= 0),
  total                  INTEGER NOT NULL CHECK (total >= 0),
  currency               TEXT NOT NULL DEFAULT 'INR',
  coupon_code            TEXT,
  shipping_address_json  TEXT NOT NULL,
  notes                  TEXT,
  tracking_number        TEXT,
  carrier                TEXT,
  placed_at              TEXT,
  paid_at                TEXT,
  shipped_at             TEXT,
  delivered_at           TEXT,
  cancelled_at           TEXT,
  created_at             TEXT NOT NULL,
  updated_at             TEXT NOT NULL,
  -- GST is included in listed prices, so `tax` is an informational breakdown of
  -- the amount already inside `subtotal`; it is not added again to the total.
  CHECK (total = subtotal - discount + shipping_fee)
);
CREATE INDEX IF NOT EXISTS idx_orders_user ON orders(user_id);
CREATE INDEX IF NOT EXISTS idx_orders_status ON orders(status);

CREATE TABLE IF NOT EXISTS order_items (
  id            TEXT PRIMARY KEY,
  order_id      TEXT NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
  variant_id    TEXT NOT NULL,
  product_id    TEXT NOT NULL,
  product_name  TEXT NOT NULL,
  variant_name  TEXT NOT NULL,
  sku           TEXT NOT NULL,
  unit_price    INTEGER NOT NULL CHECK (unit_price >= 0),
  quantity      INTEGER NOT NULL CHECK (quantity > 0),
  line_total    INTEGER NOT NULL CHECK (line_total >= 0),
  CHECK (line_total = unit_price * quantity)
);
CREATE INDEX IF NOT EXISTS idx_order_items_order ON order_items(order_id);

CREATE TABLE IF NOT EXISTS payments (
  id                  TEXT PRIMARY KEY,
  order_id            TEXT NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
  provider            TEXT NOT NULL DEFAULT 'razorpay',
  provider_order_id   TEXT UNIQUE,
  provider_payment_id TEXT UNIQUE,
  amount              INTEGER NOT NULL CHECK (amount >= 0),
  currency            TEXT NOT NULL,
  status              TEXT NOT NULL CHECK (status IN ('created','authorized','captured','failed','refunded')),
  method              TEXT,
  error_code          TEXT,
  error_description   TEXT,
  created_at          TEXT NOT NULL,
  updated_at          TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_payments_order ON payments(order_id);

CREATE TABLE IF NOT EXISTS refunds (
  id                 TEXT PRIMARY KEY,
  order_id           TEXT NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
  payment_id         TEXT REFERENCES payments(id) ON DELETE SET NULL,
  amount             INTEGER NOT NULL CHECK (amount > 0),
  reason             TEXT NOT NULL,
  status             TEXT NOT NULL CHECK (status IN ('requested','processing','completed','failed')),
  provider_refund_id TEXT,
  created_by         TEXT,
  created_at         TEXT NOT NULL,
  updated_at         TEXT NOT NULL,
  processed_at       TEXT
);
CREATE INDEX IF NOT EXISTS idx_refunds_order ON refunds(order_id);

CREATE TABLE IF NOT EXISTS reviews (
  id         TEXT PRIMARY KEY,
  product_id TEXT NOT NULL REFERENCES products(id) ON DELETE CASCADE,
  user_id    TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  rating     INTEGER NOT NULL CHECK (rating BETWEEN 1 AND 5),
  title      TEXT,
  body       TEXT NOT NULL,
  status     TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','published','rejected')),
  created_at TEXT NOT NULL,
  UNIQUE (product_id, user_id)
);
CREATE INDEX IF NOT EXISTS idx_reviews_product ON reviews(product_id, status);

CREATE TABLE IF NOT EXISTS notifications (
  id         TEXT PRIMARY KEY,
  user_id    TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  type       TEXT NOT NULL,
  title      TEXT NOT NULL,
  body       TEXT NOT NULL,
  data_json  TEXT,
  read_at    TEXT,
  created_at TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_notifications_user ON notifications(user_id, created_at);

CREATE TABLE IF NOT EXISTS contact_messages (
  id         TEXT PRIMARY KEY,
  name       TEXT NOT NULL,
  email      TEXT NOT NULL,
  subject    TEXT,
  message    TEXT NOT NULL,
  status     TEXT NOT NULL DEFAULT 'new' CHECK (status IN ('new','read','archived')),
  created_at TEXT NOT NULL
);

-- Webhook idempotency: a provider event id can only ever be processed once.
CREATE TABLE IF NOT EXISTS webhook_events (
  id           TEXT PRIMARY KEY,
  provider     TEXT NOT NULL,
  event_id     TEXT NOT NULL,
  event_type   TEXT NOT NULL,
  status       TEXT NOT NULL CHECK (status IN ('received','processed','ignored','failed')),
  error        TEXT,
  created_at   TEXT NOT NULL,
  processed_at TEXT,
  UNIQUE (provider, event_id)
);

-- Server-side idempotency for order creation / payment verification retries.
CREATE TABLE IF NOT EXISTS idempotency_keys (
  key           TEXT PRIMARY KEY,
  user_id       TEXT,
  scope         TEXT NOT NULL,
  request_hash  TEXT NOT NULL,
  response_json TEXT,
  created_at    TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS rate_limits (
  key          TEXT PRIMARY KEY,
  count        INTEGER NOT NULL CHECK (count >= 0),
  window_start INTEGER NOT NULL
);

CREATE TABLE IF NOT EXISTS settings (
  key   TEXT PRIMARY KEY,
  value TEXT NOT NULL
);
