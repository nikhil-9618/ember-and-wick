# Route Map — Ember & Wick

Every page and API route that exists today, with its access level, permission gate and data source.
Cross-checked against the filesystem on 23 November 2026. Routes named in the master prompt but not
present are listed separately at the end — they are the §07 / §40 gaps, not oversights in this map.

## Conventions

- All JSON endpoints live under `/api/v1`. There is no `/api/v2` and no unversioned JSON route.
- Every handler is wrapped in `apiRoute()` (`web/src/lib/http.ts`), so thrown errors become
  `{ error: { code, message, details } }` with no stack trace.
- Mutating handlers call `assertSameOrigin(request)` before touching the database.
- Access levels: **public** (no session), **user** (any signed-in customer, own records only),
  **admin** (`users.role = 'admin'`, re-read from the database on every request).
- Pages under `/admin` also redirect server-side in `web/src/app/admin/layout.tsx`; that redirect is
  navigation convenience, not the security boundary.

## Pages (30)

### Storefront

| Path | Access | File | Notes |
| --- | --- | --- | --- |
| `/` | public | `src/app/page.tsx` | Hero, featured products, category rail |
| `/shop` | public | `src/app/shop/page.tsx` | Filters + pagination via search params |
| `/products/[slug]` | public | `src/app/products/[slug]/page.tsx` | Variants, reviews, purchase panel |
| `/cart` | public | `src/app/cart/page.tsx` | Guest cart in local storage; server cart when signed in |
| `/checkout` | public | `src/app/checkout/page.tsx` | Server-priced quote, address, coupon |
| `/login`, `/register` | public | `src/app/login/page.tsx`, `register/page.tsx` | Sets HttpOnly session cookie |
| `/pay/[number]` | public | `src/app/pay/[number]/page.tsx` | Native-app payment hand-off; token read from URL fragment |
| `/about`, `/contact`, `/faq` | public | matching folders | Static content + contact form |
| `/privacy`, `/terms`, `/refund-policy` | public | matching folders | Legal placeholder copy |
| `robots.txt`, `sitemap.xml` | public | `robots.ts`, `sitemap.ts` | Generated |
| `loading.tsx`, `error.tsx`, `not-found.tsx` | public | `src/app/` | Route-level states |

### Customer account

| Path | Access | File | Notes |
| --- | --- | --- | --- |
| `/account` | user | `src/app/account/page.tsx` | Profile |
| `/account/orders` | user | `src/app/account/orders/page.tsx` | Own orders only |
| `/account/orders/[number]` | user | `src/app/account/orders/[number]/page.tsx` | 404 for other users' orders |
| `/account/addresses` | user | `src/app/account/addresses/page.tsx` | CRUD |
| `/account/wishlist` | user | `src/app/account/wishlist/page.tsx` | |

### Admin

| Path | Access | File | Data source |
| --- | --- | --- | --- |
| `/admin` | admin | `src/app/admin/page.tsx` | `getDashboard()` — revenue, refunds, status mix, low stock, top products, 14-day series |
| `/admin/products` | admin | `admin/products/page.tsx` | Unpaginated product list with variant/stock aggregates |
| `/admin/products/new` | admin | `admin/products/new/page.tsx` | `product-form.tsx` |
| `/admin/products/[id]` | admin | `admin/products/[id]/page.tsx` | Product, images, variants; archive action |
| `/admin/orders` | admin | `admin/orders/page.tsx` | Status filter + search, `LIMIT 100` |
| `/admin/orders/[number]` | admin | `admin/orders/[number]/page.tsx` | Items, payment, refunds, tracking, status form |
| `/admin/customers` | admin | `admin/customers/page.tsx` | Email, name, order count, spend |
| `/admin/coupons` | admin | `admin/coupons/page.tsx` | Create + list with usage |
| `/admin/refunds` | admin | `admin/refunds/page.tsx` | Refund queue + issue form |
| `/admin/reviews` | admin | `admin/reviews/page.tsx` | Pending/published/rejected moderation |
| `/admin/audit` | admin | `admin/audit/page.tsx` | Read-only audit log of privileged changes, last 200 |

## API routes (42)

### Public and customer

| Method + path | Access | File | Behaviour |
| --- | --- | --- | --- |
| `GET /api/v1/health` | public | `health/route.ts` | Status + version only |
| `GET /api/v1/products` | public | `products/route.ts` | Search, category/price/scent filters, sort, `page`/`perPage` (max 48) |
| `GET /api/v1/products/[slug]` | public | `products/[slug]/route.ts` | Product + variants + published reviews |
| `GET /api/v1/products/[slug]/reviews` | public | `products/[slug]/reviews/route.ts` | Published reviews |
| `POST /api/v1/products/[slug]/reviews` | user | same | One review per user per product; `pending` status |
| `GET /api/v1/categories` | public | `categories/route.ts` | Active categories |
| `POST /api/v1/contact` | public | `contact/route.ts` | Rate limited; stores `contact_messages` |
| `POST /api/v1/auth/register` | public | `auth/register/route.ts` | Rate limited; creates `customer` only |
| `POST /api/v1/auth/login` | public | `auth/login/route.ts` | Rate limited; verifies the password and sends a 6-digit code, no session |
| `POST /api/v1/auth/otp/verify` | public | `auth/otp/verify/route.ts` | Single-use code → session cookie + bearer token |
| `POST /api/v1/auth/logout` | user | `auth/logout/route.ts` | Revokes session, clears cookie |
| `GET /api/v1/auth/me` | user | `auth/me/route.ts` | Current session user |
| `POST /api/v1/auth/password` | user | `auth/password/route.ts` | Requires current password |
| `GET/POST/PATCH/DELETE /api/v1/cart` | user | `cart/route.ts` | Add, update, remove, clear; quantity 1–10 |
| `GET/POST /api/v1/wishlist` | user | `wishlist/route.ts` | Toggle product |
| `GET/POST /api/v1/addresses` | user | `addresses/route.ts` | List, create |
| `PATCH/DELETE /api/v1/addresses/[id]` | user | `addresses/[id]/route.ts` | Own address only |
| `POST /api/v1/checkout/quote` | user | `checkout/quote/route.ts` | Recomputes every line from the database |
| `GET/POST /api/v1/orders` | user | `orders/route.ts` | List own orders / create order (atomic batch, optional idempotency key) |
| `GET /api/v1/orders/[number]` | user | `orders/[number]/route.ts` | Own order; 404 otherwise |
| `POST /api/v1/orders/[number]/cancel` | user | `orders/[number]/cancel/route.ts` | Unpaid orders only; restores stock + coupon |
| `POST /api/v1/orders/[number]/retry-payment` | user | `orders/[number]/retry-payment/route.ts` | New provider attempt for an unpaid order |
| `POST /api/v1/payments/verify` | user | `payments/verify/route.ts` | HMAC signature check, then settle |
| `POST /api/v1/payments/webhook` | provider (signature) | `payments/webhook/route.ts` | Verifies raw-body signature; idempotent via `webhook_events` |
| `POST /api/v1/payments/test-confirm` | user, dev only | `payments/test-confirm/route.ts` | Refused when `NODE_ENV=production` |
| `GET /api/v1/notifications` | user | `notifications/route.ts` | In-app feed, last 50 |
| `POST/DELETE /api/v1/devices` | user | `devices/route.ts` | Push token registration (`device_tokens`) |

### Admin

| Method + path | Access | File | Behaviour |
| --- | --- | --- | --- |
| `GET /api/v1/admin/stats` | admin | `admin/stats/route.ts` | Dashboard aggregate |
| `GET/POST /api/v1/admin/products` | admin | `admin/products/route.ts` | List / create with variants and images |
| `PATCH/DELETE /api/v1/admin/products/[id]` | admin | `admin/products/[id]/route.ts` | Allowlisted column update; soft archive |
| `POST /api/v1/admin/products/[id]/variants` | admin | `admin/products/[id]/variants/route.ts` | Add variant (unique SKU) |
| `PATCH /api/v1/admin/variants/[id]` | admin | `admin/variants/[id]/route.ts` | Price, stock, threshold, active; stock delta writes an `inventory_movements` row and an audit entry |
| `GET /api/v1/admin/variants/[id]/movements` | admin | `admin/variants/[id]/movements/route.ts` | Signed stock ledger for one variant |
| `GET /api/v1/admin/orders` | admin | `admin/orders/route.ts` | `status`, `q`, `limit` (≤200) |
| `GET/PATCH /api/v1/admin/orders/[number]` | admin | `admin/orders/[number]/route.ts` | State-machine-guarded transition, tracking, customer notification |
| `GET /api/v1/admin/customers` | admin | `admin/customers/route.ts` | Directory with order count + spend |
| `GET/POST /api/v1/admin/coupons` | admin | `admin/coupons/route.ts` | List / create (percent ≤ 90) |
| `PATCH/DELETE /api/v1/admin/coupons/[id]` | admin | `admin/coupons/[id]/route.ts` | Edit / deactivate |
| `GET/POST /api/v1/admin/refunds` | admin | `admin/refunds/route.ts` | Refund queue / issue refund; held as `requested` at or above the approval threshold; `requestKey` replay |
| `POST /api/v1/admin/refunds/[id]/approve` | admin (not the requester) | `admin/refunds/[id]/approve/route.ts` | Second-admin approval; atomic status claim; 403 self-approval, 409 duplicate |
| `GET/PATCH /api/v1/admin/reviews` | admin | `admin/reviews/route.ts` | Moderation queue / publish or reject; audit entry per decision |
| `GET /api/v1/admin/audit` | admin | `admin/audit/route.ts` | Audit log with `entityType`, `entityId`, `action`, `limit` filters |

## Routes the master prompt specifies but that do not exist

These are the §40 route groups with no implementation, in the order they appear in the prompt:

`/admin/staff`, `/admin/roles`, `/admin/dashboard` (metrics live at `/admin/stats`),
`/admin/categories`, `/admin/products/[id]/variants` (create only), `/admin/inventory`,
`/admin/inventory/movements`, `/admin/batches`, `/admin/payments` (no payment screen; refund
approval exists at `POST /admin/refunds/[id]/approve`), `/admin/shipments`,
`/admin/inventory` (no movement screen; ledger reads via `/admin/variants/[id]/movements`), `/admin/customers/[id]`, `/admin/content`, `/admin/campaigns`,
`/admin/support`, `/admin/reports`, `/admin/exports`, `/admin/settings`, `/admin/audit-logs`,
`/auth/password/reset`, `/auth/password/reset/confirm`.

Adding any of them is a `New` row in `FEATURE_MATRIX.md`; none is partially wired, so there are no
silent 404s from a missing handler for a link that is rendered.
