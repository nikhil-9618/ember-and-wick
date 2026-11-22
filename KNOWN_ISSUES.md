# Known Issues

Everything below is verified to be *unfinished or unverified*. Nothing here is presented as working.

## Release blockers

1. **Live Razorpay is untested.** The integration (server-side order creation, signature
   verification, webhook settlement, replay protection) is implemented and passes with the test
   provider and self-signed webhooks, but has never run against Razorpay with real credentials.
   Checkout cannot complete on the current preview because no keys are configured there.
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
6. **Preview has no admin account.** The bootstrap seeds the catalogue only. To exercise the admin UI
   on the preview, set `BOOTSTRAP_ADMIN_EMAIL`/`BOOTSTRAP_ADMIN_PASSWORD` and re-bootstrap, or use the
   seeded local accounts.
7. **Shipping is a flat rule, not a courier integration.** There is no live rate calculation, AWB or
   tracking-provider sync; order tracking reflects internal statuses only.
8. **Product images are single-resolution files.** No responsive `srcset`/CDN variants are generated.

## Testing gaps

9. **No browser E2E suite** (Playwright) and no mobile UI tests. This pass verified the API, builds and
   server-rendered responses, not clicks.
10. **No load or soak testing.** Rate limits exist but throughput under launch traffic is unmeasured.

## Operational notes

11. **Bootstrap is a convenience, not a migration system.** It runs only with `BOOTSTRAP_DB=1`, refuses
    to run twice, and applies the bundled DDL in one batch. Production should use Wrangler migrations.
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
