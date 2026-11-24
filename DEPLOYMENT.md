# Deployment

## Environments

| Environment | URL | State |
| --- | --- | --- |
| Preview (public demo) | https://ember-amp-wick-bw6y8l-preview.freebuff.site | Deployed and serving (Workers + D1), demo accounts seeded, simulated payments |
| Production | not published | Requires owner approval and real keys |

Deployments are made with the Sites tooling (`sites_prepare_next` → `sites_deploy`), which builds the
Next app with OpenNext and uploads the Worker plus static assets. The Worker serves `/api/v1/*` first
and falls back to `env.ASSETS` for static files.

## 1. Web (Cloudflare Workers)

Prerequisites: Node 22+, a Sites project with a D1 database bound as `DB`.

```bash
cd web
npm ci
node scripts/gen-schema.mjs        # bundle migrations for the runtime bootstrap
# build + bundle (perform automatically by the deployment tool)
npx next build
```

Deployment produces `web/freebuff-sites-build/manifest.json`; the platform deploys that manifest. The
generated `web/freebuff.wrangler.jsonc` supplies local bindings for `next dev` and the bundle config
for Wrangler.

### Environment variables

Set these in the Sites panel (Preview and Production separately), never in the repository:

| Name | Required | Purpose |
| --- | --- | --- |
| `RAZORPAY_KEY_ID` | yes (live) | Razorpay key id; also used by the browser modal |
| `RAZORPAY_KEY_SECRET` | yes (live) | Server-side signing; never exposed |
| `RAZORPAY_WEBHOOK_SECRET` | yes | Webhook HMAC verification |
| `PAYMENT_PROVIDER` | no | `test` outside production; `demo` for a public demo store (needs `ALLOW_DEMO_PAYMENTS=1`). Omit in a real store |
| `ALLOW_DEMO_PAYMENTS` | demo only | `1` enables `PAYMENT_PROVIDER=demo`: checkout and refunds are simulated and labelled as such |
| `SEED_DEMO_ACCOUNTS` | demo only | `1` creates the demo admin/manager/customer accounts on the first request |
| `RESEND_API_KEY` or `BREVO_API_KEY` | yes | Free-tier email delivery for sign-up verification codes; without one, sign-up returns 503 |
| `OTP_FROM_EMAIL` | with Brevo | Verified sender address (Resend defaults to `onboarding@resend.dev`) |
| `BOOTSTRAP_DB` | first deploy only | `1` applies migrations + catalogue to an empty database |
| `BOOTSTRAP_ADMIN_EMAIL` / `BOOTSTRAP_ADMIN_PASSWORD` | first deploy only | Creates the first admin when bootstrapping |
| `NEXT_PUBLIC_APP_URL` / `APP_ORIGIN` | yes | Canonical URLs, sitemap, absolute links (build/runtime) |

`NEXT_PUBLIC_APP_URL` is inlined at build time, so set it before building for a real domain.

### Database

Migrations live in `web/migrations/` and are applied either:

- **Hosted bootstrap (no shell needed):** set `BOOTSTRAP_DB=1`, apply the migrations' bundled form on
  the first request, then unset it. Idempotent; records `schema_version` in `settings` and refuses to
  run again.
- **Wrangler (preferred for production):**

```bash
cd web
npx wrangler d1 execute DB --remote --config freebuff.wrangler.jsonc --file=migrations/0001_init.sql
npx wrangler d1 execute DB --remote --config freebuff.wrangler.jsonc --file=migrations/0002_device_tokens.sql
```

The preview database was bootstrapped this way and contains the six catalogue products, four
categories and two coupons. On the public demo deployment it also holds the demo accounts below.

### Demo deployment (preview)

Sign-in is password only. A new account must confirm its email address with a six-digit code before
it can sign in; the code is delivered by Resend or Brevo, so `RESEND_API_KEY` (plus `OTP_FROM_EMAIL`
for Brevo) must be set in Sites → Secrets for sign-up to work. There is no on-screen code fallback.
Payments run with `PAYMENT_PROVIDER=demo` + `ALLOW_DEMO_PAYMENTS=1`: checkout, order placement,
cancellation, refunds and the refund approval threshold all work end to end, but no money is
collected and every screen says so.

| Role | Email | Password |
| --- | --- | --- |
| Admin | `admin@emberandwick.in` | `AdminPass123!` |
| Second admin (approves refunds at/above the threshold) | `manager@emberandwick.in` | `ManagerPass123!` |
| Customer | `customer@example.com` | `Customer123!` |

These accounts exist only because `SEED_DEMO_ACCOUNTS=1` is set. Remove that variable (and the
accounts) before the store takes real orders.

### Going live

1. Add `RAZORPAY_KEY_ID`, `RAZORPAY_KEY_SECRET` and `RAZORPAY_WEBHOOK_SECRET`, and unset
   `PAYMENT_PROVIDER`, `ALLOW_DEMO_PAYMENTS` and `SEED_DEMO_ACCOUNTS`.
2. Add `RESEND_API_KEY` (or `BREVO_API_KEY` + `OTP_FROM_EMAIL`) so sign-up verification codes are
   emailed. Without it, sign-up is refused with a clear message.
3. Delete the demo users and rotate `BOOTSTRAP_ADMIN_PASSWORD`.
4. Point the Razorpay webhook at `https://<domain>/api/v1/payments/webhook`.

### Verification after deploy

```bash
curl -s -o /dev/null -w '%{http_code}\n' https://<origin>/                     # 200
curl -s https://<origin>/api/v1/products | head -c 200                          # JSON catalogue
curl -s -o /dev/null -w '%{http_code}\n' https://<origin>/api/v1/health         # 200
```

## 2. Domain and HTTPS

Add the custom domain in the Sites panel, then set `NEXT_PUBLIC_APP_URL` and `APP_ORIGIN` to it and
rebuild. HTTPS is provisioned automatically. Point the Razorpay webhook at
`https://<domain>/api/v1/payments/webhook` and subscribe to `payment.captured` and `payment.failed`.

## 3. Mobile (Expo / EAS)

```bash
cd mobile
npm install
cp .env.example .env               # EXPO_PUBLIC_API_URL=https://<production domain>
npx eas build --profile preview --platform android
npx eas build --profile production --platform all
```

Requirements not available in this environment: an Expo account with EAS access, Android/iOS
toolchains, and push credentials. `app.json` already declares the icon, splash, scheme and
notification plugin.

Before a store submission:

1. Set `EXPO_PUBLIC_API_URL` to the production origin (no localhost).
2. Replace `extra.eas.projectId` with the real project id so push tokens can reach Expo.
3. Upload FCM (`google-services.json`) and APNs credentials for delivery.
4. Confirm the consent/support URLs and privacy policy links point at the live site.

## 4. Operations

| Concern | Approach |
| --- | --- |
| Health check | `GET /api/v1/health` returns status and version; monitor it externally |
| Logs | Worker logs via the Sites panel; application errors are logged without secrets |
| Backups | Schedule `wrangler d1 export` (or the Sites snapshot) before each production deploy |
| Rollback | Re-publish the previous deployment; schema changes are additive |
| Migrations | Add a numbered file in `web/migrations/`, run `node scripts/gen-schema.mjs`, apply with Wrangler |

## 5. Local development notes

- `next dev` reads bindings from `web/freebuff.wrangler.jsonc` (via `initOpenNextCloudflareForDev`).
  If you change bindings, restart the dev server.
- After a production build, delete `.next` before starting `next dev`, otherwise the dev server can
  fail with a missing `required-server-files.json`.
- Never commit `.env.local`, `.secrets/` or `*.wrangler` credentials.
