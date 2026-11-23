# Feature Matrix — Ember & Wick vs. the 50-Section Master Prompt

Audit date: 23 November 2026. Repository state: branch `freebuff/19d7b39d7883762c647077a0`,
8 commits including this audit pass, working tree clean.

This file answers one question per requirement: **is it built, and what is the evidence?** A row is
only marked `Existing` when there is a file, route, schema object or test that proves it. Nothing
here is marked complete because a page renders. Where the implementation exists but does not meet
the specification, the row is `Repair`, not `Existing`.

## Status legend

| Status | Meaning |
| --- | --- |
| `Existing` | Implemented, reachable, and exercised by an automated test or a real request during this build |
| `Repair` | Implemented in part; the stated requirement is not fully met, or the gap is a correctness/consistency risk |
| `New` | Not built at all |
| `Future` | Deliberately deferred beyond the launch scope; design notes only |
| `Out of scope` | A process instruction in the master prompt, not a software requirement |

## Scoreboard

| Status | Sections |
| --- | --- |
| `Existing` | **7** — 02, 04, 06, 22, 23, 42, 45 |
| `Repair` | **32** |
| `New` | **9** — 10, 18, 19, 28, 30, 32, 34, 36, 39 |
| `Future` | **1** — 33 |
| `Out of scope` | **1** — 01 |

The storefront purchase journey (discover → cart → order → pay → track) is the strongest part of the
system and is tested end to end up to the payment-provider boundary. The **administration
platform** described by sections 03 and 07–39 is where the majority of `Repair` and `New` rows sit:
the app has a working admin *dashboard* with seven screens, not yet the 25-area operations
control centre the prompt specifies.

## Part A — requirement matrix

### Platform foundations (01–06)

| § | Requirement | Status | Evidence | Gap / owner decision |
| --- | --- | --- | --- | --- |
| 01 | Master brief: audit, implement, test, deploy | Out of scope | Process instruction | Delivered as this audit set plus the existing implementation |
| 02 | Business outcomes: what sold, in stock, to ship, paid, needs attention | Existing | `web/src/lib/services/analytics.ts`, `/admin` dashboard | "To ship" and "needs attention" are derived views only; no fulfilment queue |
| 03 | Eight roles, resource-action permissions, deny-by-default, dual approval | Repair | `users.role CHECK (role IN ('customer','admin'))` in `0001_init.sql:5`, `requireAdmin` in `web/src/lib/auth.ts:139` | Two roles only. No permission pairs, no staff table, no dual approval, no per-role 403 tests |
| 04 | Launch-critical vs follow-on scope | Existing | Deferred list in Part C | Follow-on items are named, not silently omitted |
| 05 | Express + MongoDB + React/Vite admin, one shared API | Repair (documented deviation) | Next.js 16 App Router route handlers on Workers + D1; `PROJECT_AUDIT.md` | MongoDB/Express cannot run on the only available runtime. Deviation is documented, not accidental; owner must confirm |
| 06 | Read-only audit with eight named deliverables | Existing | `PROJECT_AUDIT.md`, `FEATURE_MATRIX.md`, `ROUTE_MAP.md`, `API_INVENTORY.md`, `DATA_MODEL_MAP.md`, `SECURITY_FINDINGS.md`, `BUG_REGISTER.md`, `RELEASE_PLAN.md` | — |

### Admin experience (07–08)

| § | Requirement | Status | Evidence | Gap |
| --- | --- | --- | --- | --- |
| 07 | 25-area sidebar (Overview, Catalogue, Operations, Sales, Customers, Growth, Content, Service, Business, Administration) with badges and per-page states | Repair | `web/src/app/admin/layout.tsx:6` — 7 links: Dashboard, Products, Orders, Customers, Coupons, Refunds, Reviews | 18 specified areas have no page: Analytics, Variants, Inventory, Batches, Stock Movements, Returns, Payments, Shipments, Campaigns, Banners, Pages, FAQs, Support, Reports, Expenses, Staff & Roles, Audit Logs, Store Settings. No badge counts, no breadcrumbs |
| 08 | Design tokens + reusable AppShell/DataTable/FilterBar/DateRangePicker/StatusBadge/ConfirmDialog/Drawer/ImageUploader/EmptyState/ErrorState/Skeleton/Toast/Pagination | Repair | Tailwind token set in `web/src/app/globals.css`; tables hand-rolled per page | No shared component library. Tables, filters and empty states are duplicated per page; no dialog, drawer, toast, skeleton or pagination component |

### Identity, access and accountability (09–10, 39)

| § | Requirement | Status | Evidence | Gap |
| --- | --- | --- | --- | --- |
| 09 | Secure admin auth: strong hashing, no public staff registration, reset tokens, session invalidation, MFA, sign-in event log | Repair | `web/src/lib/password.ts` (PBKDF2-SHA256, 210k), `web/src/lib/auth.ts` (opaque token, SHA-256 at rest, HttpOnly+Secure+Samesite=Lax cookie, bearer for mobile), revoke on logout; asserted in `scripts/api-test.mjs` | PBKDF2 instead of Argon2id/bcrypt (Web Crypto constraint, documented). `/auth/register` is public and can create only `customer`. No password-reset flow, no MFA, no sign-in audit events, no session invalidation on password change |
| 10 | Staff management: invite, roles, deactivate, revoke sessions, last activity, permission matrix, 403 tests per role | New | None | Needs `staff`/`roles`/`permissions`/`role_permissions` tables, an authorization middleware, and one API test per role |
| 39 | Append-only audit log of sensitive actions with actor, entity, before/after, correlation id, filters | New | `grep -ri audit src` returns nothing | Needs an `audit_logs` table, a `recordAudit()` helper called from every privileged mutation, read API and admin page |

### Catalogue and inventory (13–19)

| § | Requirement | Status | Evidence | Gap |
| --- | --- | --- | --- | --- |
| 13 | Product CRUD with SEO, ingredients, wax, wick, fragrance, care, safety, draft/published/archived, preview, slug redirects | Repair | `products` + `product_images` tables; `/admin/products`, `/admin/products/new`, `/admin/products/[id]`; `adminProductSchema` | Has wax/wick/burn/scent/price/status/featured/images. Missing SEO title/description, ingredient disclosure, care instructions, safety warnings, customer-view preview, slug-history redirect, per-field change history |
| 14 | Variants: unique SKU, paise integers, MRP, cost basis, dimensions, bulk edit with preview, price audit, immutable order snapshots | Repair | `product_variants` (UNIQUE sku, `CHECK price >= 0`), `order_items` snapshot columns, `PATCH /admin/variants/[id]` | No cost basis, no weight/dimension-driven shipping, no bulk edit, no before/after price audit. `compare_at_price` lives on the product, not the variant |
| 15 | Media: signed uploads, MIME/signature/size validation, ordering, alt text, primary image, orphan cleanup | Repair | `product_images(url, alt, position)`; up to 6 image URLs per product; ordering by array index | No upload endpoint or provider. Admins paste URLs, so server-side file validation and orphan cleanup do not exist. Provider choice is an owner decision |
| 16 | Categories with slug, description, image, order, active state, delete guard, collections | Repair | `categories` table, `GET /api/v1/categories`, storefront category pages | No admin category CRUD, no ordering UI, no delete guard, no collections model |
| 17 | Inventory: on_hand / reserved / available, controlled movements with reason+actor, reservation expiry, per-variant thresholds | Repair | `product_variants.stock` with `CHECK (stock >= 0)`, `low_stock_threshold`, decrement inside the checkout batch | Single `stock` column: reserved stock is indistinguishable from sold stock. Adjustments are a raw `PATCH stock` with no reason, actor or ledger entry. No expiry or reconciliation |
| 18 | Batch/lot traceability, quarantine, recall flags | New (deferred) | None | Owner decision: does the brand record production batches at launch? |
| 19 | Immutable stock movement ledger with filters, export, reconciliation | New | None | Needs `stock_movements` (variant, type, delta, reason, reference, actor, ts) and `GET /admin/inventory/movements` |

### Orders, payments and fulfilment (20–26)

| § | Requirement | Status | Evidence | Gap |
| --- | --- | --- | --- | --- |
| 20 | Validated order state machine, transition service, status history with actor+reason, derived customer status | Repair | `web/src/lib/orders.ts:14` transition table, `canTransition`, `nextStatuses`, `releasesInventory`; enforced in `PATCH /admin/orders/[number]`; unit tests in `orders.test.ts` | No `order_status_history` table: transitions are not recorded, so who changed what and why is unrecoverable. No return states, no cancellation reason persisted |
| 21 | Order list with server pagination, date/status/payment filters, sort; detail with payment attempts, event history, notes, invoice/packing slip | Repair | `/admin/orders`, `/admin/orders/[number]`, `GET /admin/orders` (`status`, `q`, `limit`), `OrderView` with items/refunds/payment | No pagination (hard `LIMIT 100`, max 200), no date or payment-status filter, no sort control, no status timeline, notes are read-only, no invoice or packing slip |
| 22 | Server-recalculated totals, transparent breakdown, audited manual adjustments | Existing | `quoteCheckout`/`createOrder` in `web/src/lib/services/checkout.ts`; API suite asserts client prices are ignored; `orders` stores subtotal/discount/shipping/tax/total with a CHECK | Admin abandoned-cart visibility is deferred (see §33) |
| 23 | Provider integration: server-created orders, signature verification, signed webhooks, attempts modelled separately, idempotency, no credentials client-side | Existing (code) / Untested (live) | `web/src/lib/payments/razorpay.ts`, `payments` table, `webhook_events` UNIQUE, `idempotency_keys`; 59-assertion API suite covers signed webhook + replay | Live Razorpay never executed — no keys. `PAYMENT_PROVIDER=test` is refused when `NODE_ENV=production` |
| 24 | Reconciliation view, conflict flagging, delayed/out-of-order events, safe retry | Repair | Webhook dedupe by `(provider, event_id)`; failed attempts recorded with error code; `/orders/[number]/retry-payment` | No reconciliation screen or export, no conflict flag when provider and internal state disagree, no test for out-of-order or delayed delivery |
| 25 | Separate cancellation / return / refund-request / approval / execution; partial refunds; idempotency; threshold approval; return inspection | Repair | `refunds` table, `POST/GET /admin/refunds` with refundable-balance maths and provider refund call; `/admin/refunds`; API test | No approval step or threshold, no second approver, no `returns` table, no item-level refunds, no attachment upload, no restock inspection decision, no unique constraint preventing duplicate execution |
| 26 | Shipments: carrier, tracking, events, packing slip, exception states | Repair | `orders.carrier`, `tracking_number`, `shipped_at`, `delivered_at`; admin PATCH writes them | No `shipments` table, no shipment events, no packing slip, no lost/damaged/RTO states, no courier adapter (none selected) |

### Customers, growth and content (27–34)

| § | Requirement | Status | Evidence | Gap |
| --- | --- | --- | --- | --- |
| 27 | Searchable customer directory, profile with addresses/orders/consent, masking by role, segmentation, suspend with reason | Repair | `/admin/customers` + `GET /admin/customers` with order count and spend | No customer detail page, no consent preferences, no suspend/deactivate, no segmentation rules, no role-based masking |
| 28 | Data minimization, access/correction/deletion workflows, export control and logging | New | Ownership scoping exists (`user_id` from session, 404 for other users) | No export, no deletion/anonymisation request workflow, no consent records, no export audit |
| 29 | Coupons: type, value, window, global + per-customer limits, eligibility, stacking, atomic redemption, audit | Repair | `coupons` table with `CHECK (used_count <= usage_limit)`, window/min/max fields; `POST /admin/coupons` caps percent at 90; eligibility enforced in `checkout.ts`; API test | No per-customer redemption limit, no product/category eligibility, no documented stacking policy, no coupon audit trail |
| 30 | CMS: hero, tiles, collections, featured products, brand story, FAQs, announcement bar with scheduling and versioning | New | None | Needs `content_blocks` (or typed tables) + admin screens + public API |
| 31 | Reviews with verified-purchase derivation, moderation reasons, abuse prevention | Repair | `reviews` table (`UNIQUE (product_id, user_id)`), `POST /admin/reviews`, `/admin/reviews`, public review submit | No order linkage, so a verified-purchase badge cannot be honestly derived. No reason codes, no moderation audit, no report-abuse flow |
| 32 | Campaign workspace with consent, test-send, provider adapters, delivery metrics | New (deferred) | None | Provider undecided; consent model (§28) is a prerequisite |
| 33 | Abandoned cart segments and reminders | Future | `carts`/`cart_items` exist with `updated_at` | No segmentation, no consent, no attribution model — deliberately deferred |
| 34 | Support tickets: number, order link, priority, assignment, internal notes, attachments, SLA | New | Only `contact_messages` (`status new/read/archived`) | Needs `support_tickets` + `ticket_messages` tables, admin queue, and agent permission separate from refund rights |

### Communications, finance, settings (35–38)

| § | Requirement | Status | Evidence | Gap |
| --- | --- | --- | --- | --- |
| 35 | Admin alerts + customer notifications via adapters, idempotent, consent-aware, honest delivery status | Repair | `notifications` table, `notify()` in `web/src/lib/services/notify.ts`, `POST/DELETE /api/v1/devices`, in-app feed and mobile screen | In-app only. No email/SMS provider, no push delivery (no Expo projectId/FCM/APNs), no admin-role notifications, no delivery status or retry |
| 36 | Finance: revenue vs profit, cost of goods, expenses, settlement reconciliation, exports | New (deferred) | Paid revenue, refunds and 14-day series in `analytics.ts` | No cost basis, no expenses table, no settlement reconciliation. Reports must not be labelled profit — currently they are not |
| 37 | Configurable tax, immutable invoices with numbering, credit notes, legal declarations | Repair | Every order stores `tax` as an informational GST-inclusive breakdown (`0001_init.sql` comment + CHECK) | No invoice table or numbering, no credit notes, no legal/GST settings, no shipping-label declarations |
| 38 | Store settings: brand, contacts, address, currency, timezone, order numbering, shipping rules, feature flags, change history | Repair | `settings(key, value)` table exists and is unused | No settings API, no admin screen, no validation, no change history, no public/private split |

### API, data, quality and operations (40–50)

| § | Requirement | Status | Evidence | Gap |
| --- | --- | --- | --- | --- |
| 40 | Consistent `/api/v1` contracts, standard error shape, pagination, correlation id, OpenAPI | Repair | 37 route handlers, `apiRoute`/`errorResponse` in `web/src/lib/http.ts` (stable `code`/`message`/`details`, no stack traces), zod on every mutation, `API_INVENTORY.md`, `API_DOCUMENTATION.md` | No correlation id in responses or logs, no pagination envelope, no OpenAPI document, admin route groups from the prompt are largely absent |
| 41 | Normalised data model, unique constraints, compound indexes, TTL, documented migrations | Repair | `DATA_MODEL_MAP.md`; UNIQUE on email/sku/slug/order number/provider ids/`(provider, event_id)`; indexes on status, user, category, order items | Missing collections for staff/audit/ledger/shipments/tickets/content/expenses. No TTL index. No migration rollback procedure |
| 42 | Checkout service: reload prices, validate coupon, atomic reservation, idempotent submission, no oversell, documented recovery | Existing | Single `db.batch()` in `web/src/lib/services/checkout.ts`; `CHECK (stock >= 0)` and `CHECK (used_count <= usage_limit)` abort the batch; `idempotency_keys`; `webhook_events` dedupe; failure keeps stock reserved and only cancel releases it | No last-unit concurrency test, no failure-injection test, no reservation-expiry job |
| 43 | TanStack Query for server state, URL-persisted filters, dirty-state warnings, no decorative controls | Repair | Server components + `web/src/lib/client/api.ts` fetch wrapper; no optimistic updates on risky actions | TanStack Query not used (deliberate: server components cover reads), filters are not URL-persisted, no unsaved-changes guard. Deviation must be accepted or the dependency added |
| 44 | Server pagination everywhere, projections, indexes, image optimisation, measured budgets | Repair | Catalogue `page`/`perPage`, aggregate queries in SQL, `LIMIT` on all lists | Admin lists return up to 100–200 rows unpaginated; no caching/invalidation layer; no performance measurement recorded |
| 45 | OWASP-aligned security: authz on every operation, injection/XSS/CSRF, rate limits, secrets, dependency audit | Existing (with residual risks) | `SECURITY_FINDINGS.md`; bound SQL parameters, zod stripping, `assertSameOrigin`, HttpOnly+Secure cookies, D1 rate limits on auth/contact, no `dangerouslySetInnerHTML` | No MFA, no audit log, `npm audit` not run in this environment, no WAF rules |
| 46 | Unit + integration + authorization + E2E tests, acceptance criteria per feature | Repair | 50 unit tests (`npx vitest run`), 59 API assertions (`scripts/api-test.mjs`), `TESTING_REPORT.md` | No per-role authorization matrix (only admin vs customer), no browser E2E, no mobile tests, no concurrency/failure-injection |
| 47 | Structured logs with request id, monitoring, backups with tested restore, incident runbook | Repair | `GET /api/v1/health`; `errorResponse` logs message only (no bodies, no secrets) | No request ids, no structured logging, no error-monitoring provider, no backup/export schedule, no tested restore, no incident checklist |
| 48 | Separate local/staging/production, migrations in deployment, smoke test | Repair | Preview environment live (Workers + D1); `DEPLOYMENT.md`; immutable deploys | No staging environment, production not published, no scripted post-deploy smoke test |
| 49 | Release checklist, feature matrix, known issues, API + data-model docs, permission matrix, env template, backup guide, runbook | Repair | `RELEASE_CHECKLIST.md`, `FEATURE_MATRIX.md`, `KNOWN_ISSUES.md`, `API_DOCUMENTATION.md`, `DATA_MODEL_MAP.md`, `.env.example` | No permission matrix (no roles exist yet), no backup/restore guide, no support runbook |
| 50 | Phased execution with honest per-phase reporting; final acceptance across all admin workflows | Repair | Each phase reported with files, APIs, tests and limitations | Final acceptance cannot pass until §10 (RBAC), §39 (audit), §19 (ledger), §34 (support) and §38 (settings) are built |

## Part B — verification evidence for what does exist

| Surface | State | Evidence |
| --- | --- | --- |
| Shared backend | Verified | 37 handlers; 59 assertions against `next dev` |
| Database schema | Verified | 2 migrations applied locally and bootstrapped from empty on the preview |
| Auth lifecycle | Verified | register, duplicate email, wrong password, revocation all asserted |
| Catalogue read path | Verified | `/`, `/shop`, `/products/cedar-smoked-vanilla` render live data on the preview |
| Cart / wishlist / addresses | Verified | API suite |
| Checkout quote + order creation | Verified | Server-price authority, coupon limits, atomic stock |
| Order cancel + stock release | Verified | API suite |
| Payments (test provider) | Verified | Signed webhook accepted, replay deduplicated |
| Refunds | Verified | Rejects unknown order; records refund |
| Admin authorization | Verified | Customer tokens rejected on admin endpoints |
| Admin UI | Implemented, not clicked through | 10 admin pages rendered; no browser pass |
| Mobile app | Implemented, never launched | 18 screens, `tsc --noEmit` clean |
| Live payments, push, native build, production publish | **Unverified** | See `KNOWN_ISSUES.md` |

## Part C — prioritized repair queue

**P0 — blocks the "administration platform" acceptance test in §50**

1. Roles and permissions (§03, §10): staff, roles, resource-action permissions, server enforcement, 403 tests.
2. Audit log (§39): table, `recordAudit()` on every privileged mutation, read-only viewer.
3. Order status history + cancellation reasons (§20, §21).
4. Inventory ledger and reserved/available split (§17, §19) so stock changes are explainable.
5. Refund approval workflow with threshold and duplicate-execution guard (§25).

**P1 — required by named launch-critical scope**

6. Admin areas missing entirely: Inventory, Stock Movements, Shipments, Returns, Payments, Reports, Store Settings, Staff, Audit Logs (§07).
7. Server-side pagination and date filters on every admin list (§21, §44).
8. Support tickets (§34) — customer service is launch-critical per §04.
9. Shipments with packing slip and exception states (§26).
10. Store settings API + screen (§38).

**P2 — follow-on, explicitly not launch-blocking**

11. CMS content blocks (§30), campaigns (§32), batch traceability (§18), finance/expenses (§36), customer data-rights workflows (§28), abandoned carts (§33).
12. Design-system extraction, TanStack Query adoption, E2E suite, correlation ids, monitoring, staging environment.

## Part D — decisions only the owner can make

| # | Decision | Why it blocks work |
| --- | --- | --- |
| 1 | Confirm the runtime deviation: Next.js + D1 on Workers instead of Express + MongoDB | §05 is the one architectural departure; reversing it means a rebuild |
| 2 | Which staff roles actually exist at launch, and whether one person may hold several | Drives the permission matrix and every 403 test |
| 3 | Refund approval threshold and whether a second approver is mandatory | Cannot implement dual approval without a number |
| 4 | Whether production batches are recorded (§18) | Determines whether allocation/recall tables are needed |
| 5 | Media strategy: Cloudinary account, or keep URL-based images | §15 cannot be completed without a provider |
| 6 | Email/SMS/push providers and consent wording | Blocks §32 and §35 beyond in-app |
| 7 | GST registration, invoice fields, Legal Metrology declarations | §37 must not be guessed |
| 8 | Return window and damaged-item evidence policy | §25 eligibility rules |
| 9 | Timezone and order-number format | §11 date boundaries, §38 settings |
| 10 | Whether backorders are permitted | §17 negative-stock policy |
