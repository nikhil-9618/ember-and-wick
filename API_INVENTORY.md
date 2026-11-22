# API Inventory

Base path: `/api/v1`. 37 route handlers. All responses are JSON; all money values are integer
**paise**.

Authentication: `Authorization: Bearer <token>` (mobile) or the `emberwick_session` HttpOnly cookie
(web). `SameSite=Lax` cookies mean cookie-authenticated mutations must also pass the same-origin
check.

Error shape: `{ "error": { "code": "…", "message": "…" } }` with codes such as `validation_error`,
`unauthorized`, `forbidden`, `not_found`, `conflict`, `rate_limited`, `internal_error`.

## Public

| Method | Path | Purpose |
| --- | --- | --- |
| GET | `/health` | Liveness + version |
| GET | `/products` | Catalogue list; `q`, `category`, `minPrice`, `maxPrice`, `scent`, `sort`, `page`, `perPage` |
| GET | `/products/[slug]` | Product detail with variants, images, rating |
| GET | `/products/[slug]/reviews` | Published reviews for a product |
| GET | `/categories` | Categories with product counts |
| POST | `/auth/register` | Create an account |
| POST | `/auth/login` | Sign in (sets cookie, returns token) |
| POST | `/auth/logout` | Revoke the current session |
| POST | `/contact` | Contact form (rate limited) |

## Customer (session required)

| Method | Path | Purpose |
| --- | --- | --- |
| GET | `/auth/me` | Current profile |
| PATCH | `/auth/me` | Update name / phone |
| POST | `/auth/password` | Change password (current + new) |
| GET / POST | `/cart` | Read cart / add item (`variantId`, `quantity`) |
| PATCH / DELETE | `/cart` | Update quantity / remove item |
| GET / POST / DELETE | `/wishlist` | List / add / remove |
| GET / POST | `/addresses` | List / create address |
| PATCH / DELETE | `/addresses/[id]` | Update / delete address |
| POST | `/checkout/quote` | Server-priced totals for the cart (`couponCode`) |
| GET / POST | `/orders` | List orders / place an order (address + optional coupon, idempotency key) |
| GET | `/orders/[number]` | Order detail with items, payments, timeline |
| POST | `/orders/[number]/cancel` | Cancel; restores stock and coupon usage |
| POST | `/orders/[number]/retry-payment` | Create/reuse a payment intent for an unpaid order |
| POST | `/payments/verify` | Verify a Razorpay signature and settle the order |
| POST | `/payments/test-confirm` | Test-mode settlement (refused in production) |
| POST | `/payments/webhook` | Razorpay webhook (HMAC verified, deduplicated, no session) |
| GET | `/notifications` | In-app notification feed |
| PATCH | `/notifications` | Mark notifications read |
| POST / DELETE | `/devices` | Register / remove an Expo push token |

## Admin (role `admin` enforced server-side)

| Method | Path | Purpose |
| --- | --- | --- |
| GET | `/admin/stats` | Revenue, order counts, low-stock alerts |
| GET / POST | `/admin/products` | List / create product |
| PATCH / DELETE | `/admin/products/[id]` | Update / archive product |
| POST | `/admin/products/[id]/variants` | Add a variant |
| PATCH / DELETE | `/admin/variants/[id]` | Update price/stock / remove variant |
| GET / PATCH | `/admin/orders` | List orders / update status |
| GET / PATCH | `/admin/orders/[number]` | Order detail / status transition |
| GET | `/admin/customers` | Customer list with order counts |
| GET / POST | `/admin/coupons` | List / create coupon |
| PATCH / DELETE | `/admin/coupons/[id]` | Update / deactivate coupon |
| GET / POST | `/admin/refunds` | List / record a refund |
| GET / PATCH | `/admin/reviews` | Moderation queue / publish or hide |

## Notes

- `POST /orders` accepts either `addressId` or an inline `address`; amounts are always recomputed.
- `idempotencyKey` on `POST /orders` makes a double submission return the original order.
- The webhook is the only endpoint without a session; it authenticates with an HMAC signature.
- `POST /payments/test-confirm` returns `403` whenever `NODE_ENV=production`.
