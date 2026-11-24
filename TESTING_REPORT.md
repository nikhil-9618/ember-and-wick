# Testing Report

Run date: 22 November 2026, against `next dev` (Node 22) on the local D1 database and the deployed
preview on Cloudflare Workers.

## Summary

| Suite | Command | Result |
| --- | --- | --- |
| TypeScript (web) | `cd web && npx tsc --noEmit` | **Pass** — 0 errors |
| TypeScript (mobile) | `cd mobile && npx tsc --noEmit` | **Pass** — 0 errors |
| Unit tests | `cd web && npx vitest run` | **Pass** — 61/61 in 7 files |
| API integration | `BASE_URL=http://127.0.0.1:3000 node scripts/api-test.mjs` | **Pass** — 92/92 assertions (with `REFUND_APPROVAL_THRESHOLD_PAISE=200` locally so the approval path is reachable) |
| Production build | `cd web && npx next build` | **Pass** — Next 16.4.6, all 30 pages + 42 routes emitted |
| Workers bundle | `sites_prepare_next` (OpenNext 1.20.12 + Wrangler) | **Pass** |
| Deployed preview smoke | `curl` against the preview origin | **Pass** — `/`, `/shop`, `/products/cedar-smoked-vanilla`, `/api/v1/health`, `/api/v1/products` all 200 with real data |

## Unit tests (61)

| File | Tests | Covers |
| --- | --- | --- |
| `money.test.ts` | 14 | paise rounding, formatting, discount maths |
| `validation.test.ts` | 16 | email/phone/pincode/quantity/coupon rules |
| `password.test.ts` | 6 | PBKDF2 hash + verify, wrong password, malformed hash |
| `orders.test.ts` | 8 | state machine transitions, cancelled/paid guards |
| `payments/razorpay.test.ts` | 6 | order payload, HMAC signature and webhook verification |
| `refunds.test.ts` | 7 | approval threshold parsing/boundaries, self-approval and duplicate-approval guards |
| `otp.test.ts` | 4 | six-digit code format, salted hashing, constant-time compare, ten-minute expiry |

## API integration suite (92 assertions)

Exercised against a live HTTP server with a real D1 database, in this order:

1. **Catalogue** — list, filter, product detail, unknown slug 404, categories, reviews.
2. **Auth** — register, duplicate email rejected, weak password rejected, wrong password rejected,
   login issues a code instead of a session, an incorrect code is rejected, the correct code issues a
   session, a used code cannot be replayed, `me`, password change, logout, revoked session rejected.
3. **Cart** — add, update quantity, reject quantity above stock, remove, clear.
4. **Wishlist** — add (idempotent), list, remove.
5. **Addresses** — create, list, update, default switching, delete.
6. **Checkout quote** — server recomputes totals, ignores a client-sent price, applies `WELCOME10`
   within its cap, rejects a coupon below its minimum.
7. **Orders** — create (stock decremented exactly once), duplicate submission does not double-decrement,
   out-of-stock rejected, list, detail, cancel restores stock and coupon usage.
8. **Payments** — unsigned webhook rejected, invalid signature rejected, signed webhook accepted,
   order settles to paid, replayed webhook deduplicated.
9. **Admin** — customer token rejected on every admin route, stats, low-stock alerts, paid order list,
   refund on unknown order rejected, stock ledger created by the checkout batch and 403 for customers.
10. **Order history and audit** — customer, webhook and admin transitions carry actor and reason; an
   invalid transition is 409; admin changes appear in `GET /admin/audit` and customers get 403.
11. **Refund approval** — below-threshold refund completes immediately and leaves the order lifecycle
   intact; at-threshold refund is held (`202`, `requested`); repeated `requestKey` returns the same
   refund; the requester cannot self-approve (403); a second admin approves; a second approval is 409;
   a full refund marks the order `refunded` and is written to the history by the approving admin.
12. **Contact / notifications / health.**

## Deployed preview checks

| Request | Result |
| --- | --- |
| `GET /` | 200, 64 KB HTML, product names present after the database bootstrap |
| `GET /shop` | 200 |
| `GET /products/cedar-smoked-vanilla` | 200 |
| `GET /admin` | 200 (renders the sign-in gate) |
| `GET /api/v1/health` | 200 |
| `GET /api/v1/products` | 200 with the seeded catalogue |

## Not run — and why

| Not run | Reason |
| --- | --- |
| Browser E2E (Playwright) | Not requested and no browser harness was used for this build |
| Manual click-through of web flows | Same; recommended as a 2-hour human pass |
| Mobile UI/device tests | No Android/iOS toolchain or EAS credentials in this environment; the app was only typechecked |
| Live Razorpay payment | No real Razorpay keys were available |
| Push notification delivery | No Expo projectId or FCM/APNs credentials |
| Load or performance testing | Out of scope for this pass |

## How to reproduce

```bash
cd web
npm ci
node scripts/gen-schema.mjs                     # regenerate bundled schema after migration changes
npm run db:migrate:local                        # apply migrations to local D1
node scripts/seed.mjs                           # catalogue + demo users
npx tsc --noEmit && npx vitest run
npm run dev &                                    # serves on :3000
BASE_URL=http://127.0.0.1:3000 RAZORPAY_WEBHOOK_SECRET=<from .env.local> node scripts/api-test.mjs
```

The API suite creates its own users and orders, so it can be run repeatedly against the same
database.
