# Feature Status — Ember & Wick

Last verified: 22 November 2026.

Legend: **Verified** = exercised by an automated test or a real request during this build.
**Implemented** = code complete and typechecked, but not exercised end-to-end.
**Partial** = works with a documented gap. **Missing** = not built.

## Platform

| Area | State | Evidence / notes |
| --- | --- | --- |
| Shared backend (Next.js route handlers on Workers) | Verified | 37 route handlers; 59-assertion API suite passes against `next dev` |
| Database schema (D1, 2 migrations) | Verified | Applied locally, bootstrapped from empty on the deployed preview |
| Auth (register / login / logout / me / password) | Verified | API suite covers registration, duplicate email, wrong password, session revocation |
| Session security (opaque token, SHA-256 at rest, HttpOnly cookie + bearer) | Verified | Revoked-token assertion in the API suite |
| Product catalogue, variants, categories, search, filters | Verified | Catalogue and product detail served on the preview |
| Cart (add / update / remove / clear) | Verified | API suite |
| Wishlist | Verified | API suite |
| Addresses (CRUD, default address) | Verified | API suite |
| Checkout quote (server-priced, coupon, shipping) | Verified | API suite asserts server-side price authority and coupon limits |
| Order creation (atomic stock + coupon + cart in one batch) | Verified | API suite; D1 `CHECK (stock >= 0)` aborts over-sell |
| Order reads, cancel, release of stock/coupon | Verified | API suite |
| Payments — test provider | Verified | Signed webhook accepted, order settled, replay deduplicated |
| Payments — live Razorpay | **Untested** | No live keys available. Code path is implemented and typechecked only |
| Refunds (admin, tracking) | Verified | API suite (rejects unknown order; records refund) |
| Admin authorization on every admin route | Verified | API suite asserts customer tokens are rejected |
| Admin product / variant / inventory / order / customer / coupon / refund / review management | Verified (API) | API suite; admin UI implemented and rendered |
| Low-stock alerts | Verified | Admin stats assertion |
| Notifications feed | Verified | API suite |
| Contact form | Verified | API suite |
| Device token registration (push) | Implemented | New `POST/DELETE /api/v1/devices`; not exercised in the suite yet |
| Health check | Verified | `GET /api/v1/health` on the preview returns 200 |

## Website (Next.js)

| Area | State | Notes |
| --- | --- | --- |
| Home, shop, product detail, search | Verified (render) | 200 responses and product data present on the preview |
| Cart, checkout, login, register | Verified (render) | Checkout completes in the API suite; browser flow not clicked through |
| Account: orders, order detail, addresses, wishlist | Verified (render) | Typechecked and rendered; not clicked through in a browser |
| Static pages: about, contact, faq, privacy, terms, refund policy | Verified (render) | |
| Admin dashboard and all management pages | Implemented | Rendered and typechecked; admin UI not clicked through |
| Hosted payment hand-off `/pay/[number]` | Implemented | New page for the native app; test-provider path typechecked, live path untested |
| Loading states, error boundary, 404 | Implemented | `loading.tsx`, `error.tsx`, `not-found.tsx` |
| SEO metadata, sitemap, robots | Implemented | Canonical URLs need `NEXT_PUBLIC_APP_URL` at build time |

## Mobile (React Native / Expo)

| Area | State | Notes |
| --- | --- | --- |
| Native navigation, 18 screens (tabs + stack) | Implemented | `tsc --noEmit` clean; **never launched on a device or simulator** |
| Onboarding (first-launch redirect) | Implemented | Now reads `emberwick.onboarded` from AsyncStorage |
| Auth with SecureStore session | Implemented | Bearer token against the same API |
| Cart, checkout, orders, order tracking, wishlist, addresses, notifications, settings, search | Implemented | Typechecked only |
| Payment hand-off via in-app browser + `/pay/[number]#t=…` | Implemented | Live Razorpay flow untested |
| Push notifications | **Partial** | Token registration coded; delivery needs an Expo projectId plus FCM/APNs credentials |
| Offline banner / network failure handling | Implemented | `expo-network` state hook |
| App icon and splash | Done | Generated and converted to PNG (`mobile/assets/`) |
| Android back-button handling | Implemented | Native stack defaults plus explicit handlers on modal screens |

## Deployment

| Item | State |
| --- | --- |
| Production build (`next build`) | Verified — succeeds on Next 16.4.6 |
| Workers bundle (`sites_prepare_next` + wrangler) | Verified |
| Preview deployment | **Live** at https://ember-amp-wick-bw6y8l-preview.freebuff.site |
| Production environment / custom domain | Not published (needs owner approval and real keys) |
| Mobile EAS build | **Not possible here** — no Android/iOS toolchain or EAS credentials |

## What this means for launch

The website + API path (discover → register → cart → order → pay → track) is implemented and
verified down to the payment provider boundary. The remaining launch blockers are: real Razorpay
keys with a live-mode test, a native build on a device, and push credentials. See
`KNOWN_ISSUES.md` and `RELEASE_CHECKLIST.md`.
