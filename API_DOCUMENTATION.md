# API Documentation

Base URL: `https://<origin>/api/v1`

Conventions:

- JSON in, JSON out. `Content-Type: application/json` required on bodies.
- Money is **integer paise** (`89900` = ₹899.00). Never floats.
- Success responses are wrapped (`{ "order": … }`, `{ "items": […] }`); errors use
  `{ "error": { "code": "…", "message": "…" } }` with an appropriate HTTP status.
- Auth: `Authorization: Bearer <token>` or the `emberwick_session` cookie. Mutations require a
  same-origin `Origin` header when using cookies.

---

## 1. Register

`POST /auth/register`

```json
{ "name": "Aarav Menon", "email": "aarav@example.com", "password": "Candle123", "phone": "+919845011223" }
```

Password rules: 8–128 chars, at least one letter and one number. `phone` is optional.

`201`:

```json
{ "token": "<opaque session token>", "user": { "id": "usr_…", "email": "aarav@example.com", "name": "Aarav Menon", "role": "customer" } }
```

Errors: `409 conflict` when the email is taken, `422 validation_error` with a message per field.

## 2. Login / logout / me

`POST /auth/login` with `{ "email", "password" }` → same shape as register, plus a Set-Cookie header.
`POST /auth/logout` revokes the session. `GET /auth/me` returns `{ "user": … }`;
`PATCH /auth/me` accepts `{ name?, phone? }`; `POST /auth/password` accepts
`{ currentPassword, newPassword }`.

## 3. Catalogue

`GET /products?q=cedar&category=signature&sort=price_asc&page=1&perPage=12`

```json
{ "items": [ { "id": "prd_…", "slug": "cedar-smoked-vanilla", "name": "Cedar & Smoked Vanilla",
  "basePrice": 89900, "compareAtPrice": 109900, "ratingAvg": 5, "ratingCount": 1,
  "image": "/images/products/cedar.jpg", "category": { "slug": "signature", "name": "Signature Blends" } } ],
  "total": 6, "page": 1, "perPage": 12 }
```

`GET /products/[slug]` adds `description`, `waxType`, `wickType`, `burnTimeHours`, `scentNotes`,
`images[]`, `variants[]` (`id`, `sku`, `name`, `price`, `stock`, `inStock`).

## 4. Cart

`POST /cart` `{ "variantId": "var_cedar_200", "quantity": 2 }`
`PATCH /cart` `{ "variantId": "var_cedar_200", "quantity": 3 }` (0 removes)
`DELETE /cart?variantId=…` · `GET /cart` → `{ "items": [...], "count": 2, "subtotal": 179800 }`

Adding more than the available stock returns `409 conflict`.

## 5. Checkout quote

`POST /checkout/quote` `{ "couponCode": "WELCOME10" }`

```json
{ "items": [ { "variantId": "var_cedar_200", "name": "Cedar & Smoked Vanilla", "unitPrice": 89900, "quantity": 1, "lineTotal": 89900 } ],
  "totals": { "subtotal": 89900, "discount": 8990, "shippingFee": 0, "total": 80910 },
  "couponApplied": { "code": "WELCOME10", "description": "10% off your first order" } }
```

Prices come from the database. Anything price-like sent by a client is ignored.

## 6. Place an order

`POST /orders`

```json
{ "addressId": "adr_…", "couponCode": "WELCOME10", "idempotencyKey": "6f1c…-uuid", "notes": "Gift wrap please" }
```

Either `addressId` or an inline `address` object (`fullName`, `phone`, `line1`, `line2?`, `city`,
`state`, `postalCode`, `country`) is required.

`201`:

```json
{ "order": { "number": "EW-2026-000123", "status": "pending_payment", "paymentStatus": "pending",
  "total": 80910, "currency": "INR", "items": [ … ] } }
```

Guarantees:

- Stock is decremented and coupon usage incremented **in the same batch** as the order insert.
- Over-sell aborts the batch (`CHECK (stock >= 0)`), returning `409`.
- Repeating the same `idempotencyKey` returns the original order instead of creating a second one.
- Stock stays reserved if payment fails; it is released only by cancellation.

## 7. Pay

`POST /orders/[number]/retry-payment` → `{ "payment": { "provider": "razorpay", "keyId": "rzp_…", "providerOrderId": "order_…", "amount": 80910, "currency": "INR" } }`

In test mode the provider is `test` and settlement uses `POST /payments/test-confirm`
`{ "orderNumber": "EW-2026-000123" }` (refused when `NODE_ENV=production`).

`POST /payments/verify`

```json
{ "orderNumber": "EW-2026-000123", "razorpayOrderId": "order_…", "razorpayPaymentId": "pay_…", "razorpaySignature": "<hmac hex>" }
```

`200` → `{ "order": { "status": "paid", "paymentStatus": "paid", … } }`. An invalid signature returns
`400` and leaves the order payable; a mismatched order/payment pair returns `404`.

## 8. Webhook

`POST /payments/webhook`, header `X-Razorpay-Signature: <hmac sha256 of raw body>`.

- Verified against `RAZORPAY_WEBHOOK_SECRET` over the raw body.
- Each provider event id is stored once, so replays are acknowledged but not reprocessed.
- Handles `payment.captured` (settles the order), `payment.failed` (marks the attempt failed, keeps
  the order payable) and refund events.

## 9. Orders and tracking

`GET /orders` → `{ "orders": [ { "number", "status", "paymentStatus", "total", "placedAt", "items" } ] }`
`GET /orders/[number]` adds the full timeline, shipping address, payments and refunds.
`POST /orders/[number]/cancel` is allowed before shipment and restores stock and coupon usage once.

Statuses: `pending_payment` → `paid` → `processing` → `shipped` → `delivered`, with `cancelled` and
`refunded` as terminal alternatives.

## 10. Admin examples

`GET /admin/stats` → `{ "revenue": …, "orders": { "paid": …, "pending": … }, "lowStock": [ { "sku", "name", "stock" } ] }`
`PATCH /admin/orders/[number]` `{ "status": "shipped", "trackingNumber"?: …, "carrier"?: … }`
`POST /admin/refunds` `{ "orderNumber": "EW-2026-000123", "amount": 80910, "reason": "Damaged in transit" }`

Every admin route returns `403 forbidden` for a customer token — covered by the integration suite.

## 11. Errors and limits

| Status | Code | When |
| --- | --- | --- |
| 400 | `validation_error` | Body fails schema validation |
| 401 | `unauthorized` | Missing/revoked session |
| 403 | `forbidden` | Wrong role, or cross-origin mutation |
| 404 | `not_found` | Unknown or another user's resource |
| 409 | `conflict` | Duplicate email, stock/coupon limits, illegal state change |
| 422 | `validation_error` | Field-level messages |
| 429 | `rate_limited` | Login, register, contact, payment retries |
| 503 | `payment_unavailable` | No payment provider configured |

## 12. Health

`GET /health` → `{ "status": "ok", "version": "…", "time": "…" }`
