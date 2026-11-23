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

## Administration platform (master prompt §03, §07–§39)

- [ ] Staff records, roles and resource-action permissions enforced server-side
- [ ] 403 test per role for privileged endpoints
- [ ] Append-only audit log for price, stock, order, coupon, refund and settings changes
- [ ] Order status history with actor and reason
- [ ] Stock movement ledger with reason and actor; reserved/available split
- [ ] Refund approval threshold and duplicate-execution guard
- [ ] Server-side pagination and date filters on every admin list
- [ ] Support ticket queue
- [ ] Store settings API and screen
- [x] Admin endpoints role-checked server-side (admin vs customer only)

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
- [x] `FEATURE_MATRIX.md` (all 50 sections with status and evidence)
- [x] `ROUTE_MAP.md`
- [x] `DATA_MODEL_MAP.md`
- [x] `ANALYTICS_DEFINITIONS.md`
- [x] `API_INVENTORY.md`
- [x] `API_DOCUMENTATION.md`
- [x] `BUG_REGISTER.md`
- [x] `RELEASE_PLAN.md`
- [x] `DEPLOYMENT.md`
- [x] `TESTING_REPORT.md`
- [x] `SECURITY_FINDINGS.md`
- [x] `KNOWN_ISSUES.md`
- [x] `RELEASE_CHECKLIST.md`

## Go / no-go

Launching the **storefront and mobile app** on 30 November requires the four original P0 items in
`RELEASE_PLAN.md`: a live payment rehearsal, a native device pass, a published production environment
with a domain, and a mobile build pointed at production.

Launching the **administration platform** as specified additionally requires everything under
"Administration platform" above to be unchecked→checked. Until then the admin is a working dashboard
for a single trusted operator, not a multi-role operations control centre, and `KNOWN_ISSUES.md`
should travel with it.
