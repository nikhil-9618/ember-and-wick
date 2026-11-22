# Release Checklist

State as of 22 November 2026. `[x]` = done and verified. `[ ]` = outstanding.

## Code and build

- [x] Web typecheck clean (`npx tsc --noEmit`)
- [x] Mobile typecheck clean (`npx tsc --noEmit`)
- [x] 50 unit tests pass
- [x] 59 API integration assertions pass
- [x] Production build succeeds on Next 16.4.6
- [x] Workers bundle builds (OpenNext + Wrangler)
- [x] No `console.log` of secrets, tokens or passwords
- [x] No hardcoded credentials in source; `.env.example` documents every variable
- [x] No mock data on production paths (the catalogue comes from D1)

## Security

- [x] Passwords hashed with PBKDF2-SHA256 (210k iterations)
- [x] Sessions stored hashed; tokens revoked on logout
- [x] HttpOnly + SameSite cookies on web, SecureStore on mobile
- [x] Admin endpoints role-checked server-side (tested with a customer token)
- [x] Orders, addresses, cart and wishlist scoped by session user
- [x] All SQL parameterised
- [x] Same-origin enforcement on state-changing requests
- [x] Rate limiting on login, register, contact and payment endpoints
- [x] Payment signatures and webhooks verified; replay deduplicated
- [x] `PAYMENT_PROVIDER=test` refused in production
- [ ] Live payment rehearsed with real keys

## Commerce correctness

- [x] Server recomputes prices, discounts, shipping and totals
- [x] Stock decrement and coupon usage are atomic with order creation
- [x] Over-sell prevented by `CHECK (stock >= 0)`
- [x] Cancel restores stock and coupon usage exactly once
- [x] Failed payment keeps stock reserved and allows retry
- [x] Admin refunds recorded
- [x] Low-stock alerts in admin stats

## Deployment

- [x] Preview environment deployed on Workers + D1
- [x] Preview serves catalogue, shop, product page and health check with real data
- [x] Migrations applied to the preview database
- [ ] Production environment published
- [ ] Custom domain configured with HTTPS
- [ ] `NEXT_PUBLIC_APP_URL` / `APP_ORIGIN` set to the production domain
- [ ] Production secrets set (Razorpay key id/secret, webhook secret)
- [ ] Razorpay webhook endpoint registered and tested from Razorpay
- [ ] Real admin account created; demo/seed accounts absent
- [ ] D1 backup/export scheduled
- [ ] Uptime monitoring on `/api/v1/health`

## Mobile

- [x] All screens implemented with native components (no WebView)
- [x] Secure session storage
- [x] Offline banner and retry states
- [x] App icon and splash generated
- [ ] `EXPO_PUBLIC_API_URL` points at production
- [ ] EAS projectId set and push credentials uploaded
- [ ] Android release build installed and walked end to end
- [ ] iOS release build installed and walked end to end
- [ ] Store metadata, screenshots and privacy declarations prepared

## Customer journey (must pass on both platforms)

- [ ] Discover a candle through shop/search
- [ ] Register a new account
- [ ] Add to cart and apply a coupon
- [ ] Complete a real payment
- [ ] Receive order confirmation (in-app and email/notification)
- [ ] Track the order and see status updates
- [ ] Admin sees the order, updates status, issues a refund

## Documentation

- [x] `README.md`
- [x] `PROJECT_AUDIT.md`
- [x] `FEATURE_STATUS.md`
- [x] `API_INVENTORY.md`
- [x] `API_DOCUMENTATION.md`
- [x] `BUG_TRACKER.md`
- [x] `RELEASE_ROADMAP.md`
- [x] `DEPLOYMENT.md`
- [x] `TESTING_REPORT.md`
- [x] `SECURITY_AUDIT.md`
- [x] `KNOWN_ISSUES.md`
- [x] `RELEASE_CHECKLIST.md`

## Go / no-go

Launch on 30 November requires the four P0 items in `RELEASE_ROADMAP.md`: a live payment rehearsal, a
native device pass, a published production environment with a domain, and a mobile build pointed at
production. Everything else can follow after launch.
