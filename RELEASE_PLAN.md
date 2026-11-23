# Release Roadmap

Target launch: **30 November 2026**. Today: 23 November 2026.

## Scope correction after the 50-section audit

The storefront and customer journey are on track. The **administration platform is not**, measured
against the master prompt: `FEATURE_MATRIX.md` records 7 sections `Existing`, 32 `Repair` and 9 `New`.
Specifically, staff roles, the audit log, order status history, the stock movement ledger, support
tickets and store settings do not exist yet.

This changes the release shape, not just the schedule:

- **30 November can ship the storefront and mobile app** with the current seven-screen admin, plus the
  P0 consistency fixes below.
- **It cannot honestly be called a completed "centralized administration platform"** until §10
  (RBAC), §39 (audit log), §20 (status history), §19 (stock ledger), §34 (support) and §38 (settings)
  are built and tested. Those are one to two weeks of focused work, not a polish pass.
- Nothing in that list is cosmetic. Each is a question the prompt says an operator must be able to
  answer: *who changed this, why, and what happened to stock.*

## Where the project stands

| Phase | Status |
| --- | --- |
| 1. Repository audit | Complete, twice — architecture pass (`PROJECT_AUDIT.md`) and 50-section compliance pass (`FEATURE_MATRIX.md`, `ROUTE_MAP.md`, `DATA_MODEL_MAP.md`, `SECURITY_FINDINGS.md`, `BUG_REGISTER.md`) |
| 2. Shared backend | Complete and tested (59 API assertions) |
| 3. Website completion | Complete; preview deployed and rendering with live data |
| 4. Mobile application | Code complete, typechecks; **no device build yet** |
| 5. Payment reliability | Test-provider path verified; live Razorpay unverified (no keys) |
| 6. Admin dashboard | Seven screens work and are protected server-side; the specified 25-area platform is **not** complete — see the scope correction above |
| 7. Security | Reviewed — see `SECURITY_FINDINGS.md` |
| 8. Testing | Unit + API integration green; E2E and mobile UI tests not run (no browser/device harness here) |
| 9. Deployment | Preview live on Workers + D1; production publish and mobile builds pending |
| 10. Documentation | Complete |

## Critical path to 30 November

**P0 — blockers (cannot launch without these)**

1. **Live Razorpay rehearsal.** Owner adds `RAZORPAY_KEY_ID`, `RAZORPAY_KEY_SECRET`,
   `RAZORPAY_WEBHOOK_SECRET` to the production environment, points the Razorpay webhook at
   `/api/v1/payments/webhook`, and runs one real order in test keys, then one small live order with
   a refund. Estimated: half a day including verification.
2. **Native device pass.** `eas build --profile preview` for Android, walk register → cart →
   checkout → pay → order tracking. Fix anything that fails. Estimated: one day.
3. **Production publish + domain.** Publish the production environment, apply migrations
   (`npm run db:migrate:remote`), set `NEXT_PUBLIC_APP_URL`/`APP_ORIGIN` to the real domain, seed a
   real admin account with a strong password. Estimated: half a day.
4. **Mobile production API base URL.** Point the app at the production domain and rebuild.

**P1 — should land before launch**

5. Push notification delivery (Expo projectId + FCM/APNs) — can ship after launch with the feed-only
   notifications that already work.
6. Browser click-through of checkout and admin flows on the preview (human pass, 2 hours).
7. Set up uptime monitoring on `/api/v1/health` and a D1 backup/export schedule.

**P2 — after launch**

8. Playwright E2E suite and Detox/Maestro mobile tests.
9. Product image CDN variants and richer analytics.

**P0 — consistency and accountability (needed before the admin can be handed to staff)**

5. Order status history table + cancellation/refund reasons (§20) — currently a status change leaves
   no trace of who did it or why.
6. Refund approval threshold and duplicate-execution guard (§25) — today a single admin can refund and
   the same refund can be requested twice.
7. Stock movement ledger and reserved/available split (§17, §19) — stock edits are unattributable.
8. Audit log for privileged mutations (§39).
9. Roles and permissions beyond `admin` (§10) if more than one person gets access before launch.

**P1 — the rest of the specified platform**

10. Missing admin areas: Inventory, Stock Movements, Shipments, Returns, Payments, Reports, Store
    Settings, Staff & Roles, Audit Logs (§07).
11. Server-side pagination and date filters on every admin list (§21, §44).
12. Support tickets (§34) and store settings API/UI (§38).

## Release gates

- [ ] Live payment rehearsal passes with a webhook from Razorpay, not a self-signed test.
- [ ] One real order per platform reaches "paid" and appears in the admin order list.
- [ ] Refund on a real payment is recorded and visible in admin.
- [ ] Production uses neither `PAYMENT_PROVIDER=test` nor seed credentials.
- [ ] Mobile build points at the production API and no localhost URL remains.
- [ ] An admin can see who changed an order status, a price or a stock level, and why (§20, §19, §39).
- [ ] All admin lists paginate server-side and survive a filtered date range (§21, §44).

## Rollback plan

Deployments are immutable per environment; the previous deployment can be re-published from the
Sites panel. Database changes are additive migrations, so a rollback of code leaves the schema
compatible. Orders are never deleted; a bad order is cancelled, which returns stock and coupon usage.
