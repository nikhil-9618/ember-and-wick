# Ember & Wick

A direct-to-consumer storefront for handmade beeswax and soy candles with wooden wicks and
essential-oil blends. One shared backend serves a Next.js website (storefront + admin) and a native
Expo app, so both platforms see identical products, prices, stock and orders.

- **Website + admin + API:** `web/` — Next.js 16 App Router on Cloudflare Workers, D1 database
- **Mobile app:** `mobile/` — Expo SDK 54 / React Native 0.81, native components only
- **Preview:** https://ember-amp-wick-bw6y8l-preview.freebuff.site

## What works today

- Browse the catalogue, categories, search and filters; read product detail, variants and reviews.
- Register / sign in, manage profile, addresses and wishlist, view order history and tracking.
- Add to cart, get a server-priced quote with coupons, place an order (atomic stock and coupon
  accounting) and pay through Razorpay, verified by signature and webhook.
- Admin dashboard: products, variants, inventory and low-stock alerts, orders and status updates,
  customers, coupons, refunds and reviews — all protected by server-side role checks.

Payment in `test` mode exists for development only and is refused in production.

## Quick start

```bash
cd web
npm ci
npm run db:migrate:local        # create the local D1 schema
node scripts/seed.mjs           # 6 products, 4 categories, coupons, demo users
npm run dev                     # http://localhost:3000
```

Demo accounts (local development only):

| Role | Email | Password |
| --- | --- | --- |
| Admin | `admin@emberandwick.in` | `AdminPass123!` |
| Customer | `customer@example.com` | `Customer123!` |

Copy `web/.env.example` to `web/.env.local` and fill in what you need. For payments without real
keys, set `PAYMENT_PROVIDER=test` locally.

Mobile:

```bash
cd mobile
npm install
cp .env.example .env            # set EXPO_PUBLIC_API_URL to your machine's LAN address
npm start
```

## Checks

```bash
cd web && npx tsc --noEmit && npx vitest run && npx next build
cd mobile && npx tsc --noEmit
BASE_URL=http://127.0.0.1:3000 RAZORPAY_WEBHOOK_SECRET=local_test_webhook_secret node scripts/api-test.mjs
```

Current status: 50 unit tests, 59 API assertions and both typechecks pass. See `TESTING_REPORT.md`.

## Documentation

| File | Contents |
| --- | --- |
| `PROJECT_AUDIT.md` | Architecture, stack, findings, audit against the 50-section master prompt |
| `FEATURE_MATRIX.md` | All 50 sections: status, evidence file/route/test, and the gap |
| `ROUTE_MAP.md` | Every page and API handler with access level |
| `API_INVENTORY.md` | Every endpoint, auth level, purpose |
| `API_DOCUMENTATION.md` | Request/response contracts for the core journey |
| `DATA_MODEL_MAP.md` | Tables, CHECK invariants, indexes, missing collections, migrations |
| `ANALYTICS_DEFINITIONS.md` | Metric formulas, exclusions and known imprecision |
| `BUG_REGISTER.md` | Bugs found and fixed, plus open items |
| `RELEASE_PLAN.md` | Critical path to launch, gates, rollback |
| `DEPLOYMENT.md` | Workers, D1, domain and mobile build steps |
| `TESTING_REPORT.md` | What was run, results, what was not run |
| `SECURITY_FINDINGS.md` | Auth, payments, injection, CSRF, residual risks |
| `RELEASE_CHECKLIST.md` | Pre-launch gates |
| `KNOWN_ISSUES.md` | Honest list of what is unfinished |

## Architecture notes

- **Money** is integer paise end to end; formatting happens only in the UI.
- **Prices are never trusted from the client.** Checkout recomputes every line from the database.
- **Orders are atomic.** Stock, coupon usage, order rows and cart clearing happen in one D1 batch,
  and `CHECK (stock >= 0)` aborts the batch on over-sell.
- **Order states** follow a single state machine in `web/src/lib/orders.ts`.
- **Sessions** are opaque random tokens stored SHA-256 hashed; the web uses an HttpOnly cookie, mobile
  a bearer token in SecureStore.

Brand name, tagline and contact details are configurable in `web/src/lib/brand.ts`.
