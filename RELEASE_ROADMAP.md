# Release Roadmap

Target launch: **30 November 2026**. Today: 22 November 2026.

## Where the project stands

| Phase | Status |
| --- | --- |
| 1. Repository audit | Complete — see `PROJECT_AUDIT.md`, `FEATURE_STATUS.md`, `API_INVENTORY.md`, `BUG_TRACKER.md` |
| 2. Shared backend | Complete and tested (59 API assertions) |
| 3. Website completion | Complete; preview deployed and rendering with live data |
| 4. Mobile application | Code complete, typechecks; **no device build yet** |
| 5. Payment reliability | Test-provider path verified; live Razorpay unverified (no keys) |
| 6. Admin dashboard | Complete; protected server-side, verified by tests |
| 7. Security | Reviewed — see `SECURITY_AUDIT.md` |
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

## Release gates

- [ ] Live payment rehearsal passes with a webhook from Razorpay, not a self-signed test.
- [ ] One real order per platform reaches "paid" and appears in the admin order list.
- [ ] Refund on a real payment is recorded and visible in admin.
- [ ] Production uses neither `PAYMENT_PROVIDER=test` nor seed credentials.
- [ ] Mobile build points at the production API and no localhost URL remains.

## Rollback plan

Deployments are immutable per environment; the previous deployment can be re-published from the
Sites panel. Database changes are additive migrations, so a rollback of code leaves the schema
compatible. Orders are never deleted; a bad order is cancelled, which returns stock and coupon usage.
