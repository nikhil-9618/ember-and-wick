# Bug Tracker

Status values: Fixed · Open · Open (blocked) · Won't fix.

## Fixed in this build cycle

| # | Severity | Area | Bug | Resolution |
| --- | --- | --- | --- | --- |
| 1 | Critical | Build/deploy | OpenNext refused Next.js 15.5.29 (outside the 2-year support window), blocking any Workers build | Upgraded to Next 16.4.6 + React 19.2; `tsc`, unit tests, API suite and `next build` re-verified after the upgrade |
| 2 | Critical | Bootstrap | `db.exec(SCHEMA_SQL)` failed with `SQL code did not contain a statement` when the SQL began with a comment block | Schema generator now strips comment-only lines |
| 3 | Critical | Bootstrap | `db.exec` then failed on `PRAGMA foreign_keys = ON` (`incomplete input`) | Bootstrap splits the DDL into statements and applies them as one atomic `db.batch()`; D1 enforces FKs anyway |
| 4 | High | Web dev server | `next dev` returned 500 (`ENOENT … required-server-files.json`) after a production build wrote `.next` | Dev and build use separate output; stale `.next` cleared and documented as a recovery step |
| 5 | High | Deploy | Site has no shell access to D1, so a fresh deployment had an empty database and a broken storefront | Added opt-in `BOOTSTRAP_DB=1` schema + catalogue bootstrap (idempotent, refuses to rerun) |
| 6 | Medium | Mobile | Onboarding screen never appeared; first launch went straight home | `(tabs)/index.tsx` checks `emberwick.onboarded` and redirects |
| 7 | Medium | Mobile assets | Generated icon was JPEG data saved as `.png` | Converted to real PNG; splash composed on an ivory canvas |
| 8 | Medium | Mobile deps | Expo packages were never installed, so mobile had never been typechecked | Installed; `tsc --noEmit` passes with zero errors |
| 9 | Medium | Docs/ops | Payment secrets could be loaded from `.dev.vars`, which stops Wrangler reading `.env` | Secrets live only in `.env.local` (gitignored) and Sites secrets |

## Open

| # | Severity | Area | Issue | Next step |
| --- | --- | --- | --- | --- |
| 10 | High | Payments | Live Razorpay (order creation, checkout popup, capture, webhook from Razorpay's IPs) has never run against real credentials | Owner supplies test-mode keys, then live keys after a successful live-mode rehearsal |
| 11 | High | Mobile | No native build has been produced or launched; touch flows, deep links and Android back behaviour are unverified | Run `eas build --profile preview` and walk the journey on a physical device |
| 12 | Medium | Push | No Expo projectId/FCM/APNs credentials, so tokens are stored but no notification is delivered | Configure credentials in EAS, set `projectId`, send a test push |
| 13 | Medium | SEO | Canonical/sitemap URLs fall back to `localhost` unless `NEXT_PUBLIC_APP_URL` is set at build time | Set it in the production build environment |
| 14 | Medium | Preview data | Preview bootstraps the catalogue but creates no admin account and has no payment keys, so checkout ends at "payment unavailable" there | Configure Razorpay keys and an admin bootstrap password for the preview |
| 15 | Low | Mobile | `orders`/`order/[number]` screens were only typechecked, never rendered | Covered by the device pass in #11 |

## Won't fix (by design)

| # | Area | Note |
| --- | --- | --- |
| — | Tax | Prices are GST-inclusive; there is no separate tax line by design |
| — | Webhooks | Idempotency is enforced with a `webhook_events` primary key rather than a job queue |
