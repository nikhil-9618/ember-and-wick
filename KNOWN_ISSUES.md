# Known Issues

Everything below is verified to be *unfinished or unverified*. Nothing here is presented as working.

## Release blockers

1. **Live Razorpay is untested.** The integration (server-side order creation, signature
   verification, webhook settlement, replay protection) is implemented and passes with the test
   provider and self-signed webhooks, but has never run against Razorpay with real credentials.
   The public demo completes checkout with `PAYMENT_PROVIDER=demo`, which is simulated and labelled
   as such; it is not evidence that a real payment works.
2. **The mobile app has never been built or run.** `mobile/` typechecks with zero errors and all 18
   screens are implemented, but there is no device or simulator in this environment. Touch targets,
   deep links, keyboard handling and Android back behaviour are unverified.
3. **Production is not published.** Only the preview environment is deployed. Publishing needs the
   owner's decision, a real domain, production secrets and real admin credentials.

## Functional gaps

4. **Push notifications do not deliver.** `POST /api/v1/devices` stores Expo tokens, and the app
   registers them, but no Expo projectId/FCM/APNs credentials exist. The in-app notification feed
   works.
5. **Canonical URLs and the sitemap fall back to `localhost`** unless `NEXT_PUBLIC_APP_URL` is set
   before the build. The preview therefore emits localhost canonicals.
6. **The demo deployment has public credentials.** The preview runs with `SEED_DEMO_ACCOUNTS=1`, so
   admin, manager and customer accounts with documented passwords exist. Remove the switch and the
   demo users before the store takes real orders. Separately, sign-up needs a provider key plus
   `OTP_FROM_EMAIL` on the store's own domain (personal mailboxes are rejected) in Sites → Secrets;
   until both are set, new accounts are refused with `503 email_not_configured` rather than being
   created unverified.
7. **Shipping is a flat rule, not a courier integration.** There is no live rate calculation, AWB or
   tracking-provider sync; order tracking reflects internal statuses only.
8. **Product images are single-resolution files.** No responsive `srcset`/CDN variants are generated.
9. **Hosting is Cloudflare-specific.** The data layer reads the D1 binding through
   `getCloudflareContext()`, so a Vercel/Render/Railway deploy needs a managed SQL database and a
   portable data layer first; copying the repo to one of those hosts without that port will start
   but fail on the first query.

## Administration platform gaps (master prompt §03, §07–§39)

The customer journey is in good shape; the operations platform is not yet the one specified. These are
missing features, not bugs, and each is a `New` row in `FEATURE_MATRIX.md`:

1. **No RBAC.** Only `customer` and `admin` exist. There are no resource-action permissions, no staff records, no
   invitation flow, no role reassignment and no 403 test per role.
2. **Partial audit coverage.** Order status/tracking/cancel, refunds, product create/update/archive,
   variant price/stock/active changes, coupon create/activate and review moderation are logged. Staff
   and permission changes do not exist yet, so they cannot be logged.
3. **Order status history exists but returns do not.** Transitions now record actor and reason; there
   is no return state, return inspection or item-level return flow (§25/§26).
4. **Stock is still one number.** Every change writes an `inventory_movements` row with reason and
   actor, but there is no reserved/available split, no reservation expiry, no movement screen and no
   reconciliation report.
5. **No support tickets.** The contact form writes `contact_messages`, which no admin screen reads.
6. **No store settings UI or API.** The `settings` table exists but is never read or written.
7. **Missing admin areas:** Inventory, Stock Movements, Batches, Shipments, Returns, Payments,
   Reports, Staff & Roles, Audit Logs, Store Settings, Content, Campaigns, Support.
8. **Admin lists are unpaginated** (hard `LIMIT 100`, max 200) and have no date-range filters.
9. **Refund approval needs two admin accounts.** Refunds at or above
   `REFUND_APPROVAL_THRESHOLD_PAISE` (default ₹5,000) can only be approved by a *different* admin; with
   one admin account those refunds stay `requested`. Raise the threshold, set it to `0` to disable
   approval, or seed a second admin (`manager@emberandwick.in` locally).
10. **No shipment records.** Tracking is two columns on `orders`; there are no shipment events,
    packing slips or lost/damaged/RTO states.

## Testing gaps

9. **No browser E2E suite** (Playwright) and no mobile UI tests. This pass verified the API, builds and
   server-rendered responses, not clicks.
10. **No load or soak testing.** Rate limits exist but throughput under launch traffic is unmeasured.

## Operational notes

11. **Bootstrap applies pending migrations, but is not a migration system.** It runs only with
    `BOOTSTRAP_DB=1`, tracks the applied migration in `settings.schema_version`, and refuses an unknown
    version instead of guessing. Production should still use `npm run db:migrate:remote`.
12. **Dev server needs a clean `.next` after a production build** (missing
    `required-server-files.json` otherwise).
13. **Expo SDK 54 with React 19.1** may emit peer-dependency warnings during `npm install`; the app
    typechecks cleanly, but dependency alignment should be confirmed with `npx expo install --fix`
    before an EAS build.

## Security follow-ups (non-blocking)

14. Admin accounts have no second factor (TOTP or Cloudflare Access) — acceptable for a small team,
    worth adding before scaling access.
15. There is no automated secret-rotation runbook; rotating `RAZORPAY_WEBHOOK_SECRET` requires updating
    both Razorpay and the Worker secret.
