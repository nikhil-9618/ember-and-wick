# Data Model Map — Ember & Wick

Engine: **Cloudflare D1 (SQLite)**. Source of truth: `web/migrations/0001_init.sql` and
`web/migrations/0002_device_tokens.sql`. `web/src/lib/schema.generated.ts` is generated from those
files by `node scripts/gen-schema.mjs` and must never be edited by hand.

## Conventions

- **Money** is `INTEGER` paise everywhere. No float, no decimal, no currency conversion.
- **Timestamps** are ISO-8601 UTC strings (`TEXT`), compared lexicographically. Display timezone is
  not yet configurable (§38 gap).
- **Identifiers** are prefixed random strings (`usr_`, `ord_`, `prd_`, `cpn_`, `ref_`, …) from
  `randomId()` in `web/src/lib/crypto.ts`, not autoincrement integers — they do not leak volume.
- **Sessions** store the SHA-256 of the token, never the token.
- **Order snapshots** (`order_items`) copy name, variant, SKU and unit price at purchase time, so a
  later product edit or archive cannot rewrite history. Product rows use soft archive.
- **Invariants live in the database**, not only in application code: see the CHECK list below. D1
  has no interactive transactions, so atomic work is expressed as one `db.batch()`, which aborts as a
  unit when any statement violates a constraint.

## Relationship summary

```
users 1─┬─* sessions
        ├─1 carts 1─* cart_items *─1 product_variants
        ├─* addresses
        ├─* wishlist_items *─1 products
        ├─* orders 1─┬─* order_items
        │            ├─* payments 1─* refunds
        │            └─* refunds
        ├─* reviews *─1 products
        └─* notifications, device_tokens, rate_limits

categories 1─* products 1─┬─* product_images
                          └─* product_variants

webhook_events, idempotency_keys, settings    (standalone)
contact_messages                              (standalone)
```

## Tables

| Table | Purpose | Key constraints and indexes |
| --- | --- | --- |
| `users` | Customers and admins | `email UNIQUE`; `role CHECK (role IN ('customer','admin'))` |
| `sessions` | Server-side sessions | `id` = SHA-256 of token; `idx_sessions_user`; cascade on user delete |
| `addresses` | Saved delivery addresses | `idx_addresses_user`; `is_default` 0/1 |
| `categories` | Catalogue groupings | `slug UNIQUE` |
| `products` | Product parent record | `slug UNIQUE`; `status CHECK IN ('draft','active','archived')`; `base_price >= 0`; `compare_at_price` nullable; `idx_products_status`, `idx_products_category` |
| `product_images` | Image rows per product | Ordered by `position`; cascade on product delete |
| `product_variants` | Purchasable SKU | `sku UNIQUE`; **`stock CHECK (stock >= 0)`** — the anti-oversell guarantee; `price >= 0`; `low_stock_threshold >= 0`; `is_active` 0/1; `idx_variants_product` |
| `carts` | One cart per signed-in user | `user_id UNIQUE`; cascade |
| `cart_items` | Cart lines | `UNIQUE (cart_id, variant_id)`; `quantity BETWEEN 1 AND 10` |
| `wishlist_items` | Saved products | `UNIQUE (user_id, product_id)` |
| `coupons` | Discount codes | `code UNIQUE`; `type IN ('percent','fixed')`; `value > 0`; **`CHECK (usage_limit IS NULL OR used_count <= usage_limit)`**; `min_subtotal >= 0` |
| `orders` | Order header + immutable address snapshot | `number UNIQUE`; `status` and `payment_status` enumerated by CHECK; **`CHECK (total = subtotal - discount + shipping_fee)`**; `idx_orders_user`, `idx_orders_status`; `user_id` `ON DELETE SET NULL` so orders survive account deletion |
| `order_items` | Purchase-time snapshot | **`CHECK (line_total = unit_price * quantity)`**; `quantity > 0`; cascade with order |
| `payments` | Payment attempts, one per provider try | `provider_order_id UNIQUE`, `provider_payment_id UNIQUE`; `status IN ('created','authorized','captured','failed','refunded')`; `idx_payments_order` |
| `refunds` | Refund requests and outcomes | `amount > 0`; `status IN ('requested','processing','completed','failed')`; `created_by`; `idx_refunds_order` |
| `reviews` | Product reviews | `rating BETWEEN 1 AND 5`; `UNIQUE (product_id, user_id)`; `status IN ('pending','published','rejected')`; `idx_reviews_product` |
| `notifications` | In-app notifications | `idx_notifications_user` on `(user_id, created_at)` |
| `contact_messages` | Contact form inbox | `status IN ('new','read','archived')` |
| `webhook_events` | Provider event log and dedupe | **`UNIQUE (provider, event_id)`**; `status IN ('received','processed','ignored','failed')` |
| `idempotency_keys` | Checkout/verify retry protection | `key` primary key, `scope`, `request_hash`, cached `response_json` |
| `rate_limits` | D1-backed fixed-window counters | `key` primary key, `count >= 0`, `window_start` epoch ms |
| `settings` | Key/value store | `key` primary key — **present but unused** (§38) |
| `device_tokens` (0002) | Expo push tokens | `UNIQUE (token)`, `user_id` cascade, `platform` |

### CHECK constraints that carry business rules

These are not decorative: each one aborts a whole `db.batch()` when violated, which is how concurrent
checkouts cannot oversell and how a coupon cannot exceed its usage limit.

| Constraint | Rule it enforces |
| --- | --- |
| `product_variants.stock >= 0` | No oversell, even under concurrent checkout |
| `coupons.used_count <= usage_limit` | No coupon over-redemption |
| `orders.total = subtotal - discount + shipping_fee` | Totals cannot be written inconsistently |
| `order_items.line_total = unit_price * quantity` | Line arithmetic cannot drift |
| `cart_items.quantity BETWEEN 1 AND 10` | No bulk-buy abuse via cart |
| `reviews UNIQUE (product_id, user_id)` | One review per customer per product |

## Gaps against the specified model (maps to `FEATURE_MATRIX.md`)

Collections the master prompt requires that do not exist yet. No placeholder tables have been
created — an unused table would imply functionality that is not there.

| Missing table | Needed for | Notes |
| --- | --- | --- |
| `staff`, `roles`, `permissions`, `role_permissions` | §03, §10 | Cannot be simulated with `users.role` |
| `audit_logs` | §39 | Append-only, `actor_id`, `action`, `entity_type`, `entity_id`, `before_json`, `after_json`, `request_id` |
| `order_status_history` | §20, §21 | `from_state`, `to_state`, `actor_id`, `reason`, `created_at` |
| `stock_movements` | §17, §19 | `variant_id`, `type`, `quantity_delta`, `reason`, `reference`, `actor_id` |
| `stock_reservations` | §17, §42 | Reserved/available split and expiry |
| `batches` | §18 | Deferred pending owner decision |
| `shipments`, `shipment_events` | §26 | Carrier, tracking, exceptions |
| `returns`, `return_items` | §25 | Inspection and restock disposition |
| `refund_approvals` | §25 | Threshold and second approver |
| `support_tickets`, `ticket_messages` | §34 | Includes internal notes |
| `content_blocks`, `faqs`, `banners` | §30 | Structured blocks, no raw HTML |
| `campaigns`, `campaign_sends`, `consents` | §28, §32 | Consent must be recorded before sending |
| `expenses` | §36 | Deferred, owner supplies cost data |
| `invoices`, `credit_notes` | §37 | Immutable numbering |

## Derived-vs-stored data

- `products.rating_avg` / `rating_count` are denormalised aggregates recalculated when a review is
  published or rejected. They must never be edited directly.
- Dashboard revenue and refund totals are computed by query, never stored.
- Stock is stored once (`product_variants.stock`). Because there is no reservation ledger yet, a
  pending-payment order has already decremented it — the row is "held", not "sold". §17/§19 replaces
  this with an explicit reserved/available model.

## Migrations

| File | Applies | Rollback |
| --- | --- | --- |
| `0001_init.sql` | Full schema | Drop tables (development only) |
| `0002_device_tokens.sql` | Push tokens | `DROP TABLE device_tokens` |

- Local: `npm run db:migrate:local` (Wrangler `d1 execute --local`).
- Remote: `npm run db:migrate:remote` — intended for production, requires the owner's go-ahead.
- Runtime bootstrap: `BOOTSTRAP_DB=1` applies the generated schema once, records `schema_version`,
  and seeds the catalogue. It exists because the hosting panel exposes no shell. It is **off by
  default** and should not be enabled in production, where migrations should be applied explicitly.
- Every migration is additive. There is no destructive change in the current history, so a code
  rollback leaves the schema valid.
