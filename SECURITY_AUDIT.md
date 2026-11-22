# Security Audit

Scope: `web/` (storefront, admin, API) and `mobile/`. Reviewed 22 November 2026.

## Authentication

- Passwords are hashed with **PBKDF2-SHA256, 210,000 iterations**, 16-byte random salt, stored as
  `pbkdf2$sha256$<iterations>$<salt>$<hash>`. No plaintext or reversible storage anywhere.
- Unknown-email and wrong-password responses are identical, so the login endpoint is not a user
  enumeration oracle. Registration necessarily reveals that an email exists.
- Sessions are **32 random bytes, hex-encoded**, sent to the client, and stored **SHA-256 hashed** in
  `sessions`. A database leak does not yield usable tokens.
- Web clients receive an **HttpOnly, SameSite=Lax** cookie; mobile uses an `Authorization: Bearer`
  header stored in **Expo SecureStore**. Tokens are never written to `localStorage`.
- Logout revokes the session server-side; the test suite confirms a revoked token stops working.
- Password change requires the current password.

## Authorization

- Every admin route calls `requireAdmin`, which re-reads the role from the database rather than
  trusting a claim in the token. The integration suite asserts a customer token is rejected on all
  admin endpoints.
- Order, address, wishlist and cart queries are scoped by `user_id` from the session, never from a
  client-supplied id. Fetching another customer's order returns 404, not 403, to avoid confirming
  existence.
- Payment confirmation requires the order to belong to the caller and the signature to verify.

## Payments

- Order amounts are computed server-side; the checkout request carries no prices.
- Razorpay order creation happens on the server with the key secret. Only `key_id` reaches the
  browser (Razorpay requires it to open the modal).
- `payment_id|order_id` signatures are verified with HMAC-SHA256 and a constant-time comparison.
- Webhooks are verified against `RAZORPAY_WEBHOOK_SECRET`, with `crypto.subtle.timingSafeEqual`-style
  comparison after length checks, and are idempotent via a unique `webhook_events` row. An unsigned
  or mis-signed webhook is rejected (covered by tests).
- Replay protection: the provider event id is the primary key, so duplicates are ignored.
- `PAYMENT_PROVIDER=test` is refused when `NODE_ENV=production`, which blocks the fake-success path in
  production. The test-confirm endpoint exists only in that mode.
- Failed payments leave stock reserved and can be retried; only cancellation releases stock and
  coupon usage, and only once (guarded by order status).

## Input handling, injection, XSS

- All mutating endpoints validate bodies with **zod** schemas; unknown fields are stripped.
- Every D1 query uses **bound parameters**. No string concatenation of user input into SQL. (The
  bootstrap seeder builds DDL/DML constants from a bundled JSON file, not from request data.)
- React escapes rendered text; there is no `dangerouslySetInnerHTML` in the codebase. Product copy is
  rendered as plain text with paragraphs.
- Request bodies are size-limited and JSON-parsed defensively; empty bodies are rejected explicitly
  rather than silently accepted.

## CSRF, CORS, headers

- State-changing endpoints call `assertSameOrigin`, which compares the `Origin` header to the app
  origin, so cookie-authenticated cross-site form posts are rejected.
- The API is same-origin only; there is no permissive `Access-Control-Allow-Origin`. Mobile uses
  bearer tokens and is unaffected.
- Cookies are `HttpOnly`, `SameSite=Lax`, and `Secure` in production.

## Rate limiting and abuse

- `/api/v1/auth/login`, `/register`, `/contact` and payment endpoints are rate limited per IP via a
  D1-backed counter (`rate_limits`), so limits survive isolate restarts.
- Cart quantity and coupon usage are constrained by the database as well as validation.

## Data exposure and logging

- No password, token, secret or full payment payload is logged. The error helper logs a message and
  an error class, not request bodies.
- Error responses return a stable code and a human message; stack traces are never sent to clients.
- `lib/config.ts` returns payment secrets only to server-side callers; no secret is imported by a
  client component. `RAZORPAY_KEY_SECRET` has no `NEXT_PUBLIC_` counterpart.
- Environment files are gitignored; `.secrets/` is gitignored; only `.env.example` is committed.

## Infrastructure

- Secrets are stored as Worker secrets in the Sites panel, injected at runtime.
- D1 enforces referential integrity and check constraints, so a bug cannot persist negative stock.
- The health endpoint exposes only status and version, no environment detail.

## Residual risks

| Risk | Severity | Mitigation / next step |
| --- | --- | --- |
| Live Razorpay path never executed | High | Rehearse with real keys and a real webhook before launch |
| Push tokens stored but delivery unconfigured | Low | Configure Expo/FCM/APNs; rotate credentials if exposed |
| Preview bootstrap can create a schema on any DB where `BOOTSTRAP_DB=1` is set | Low | Flag is off by default and only idempotent DDL/catalogue data is written; do not enable it on production |
| No WAF/bot protection in front of the API | Low | Cloudflare provides baseline DDoS protection; add rate-limit rules if abused |
| Admin UI has no 2FA | Medium | Consider Cloudflare Access or TOTP before scaling the team |

## Verdict

The application layer is sound for a controlled launch: no known critical or high-severity issues
remain open in the code. The single high-risk item is operational — the live payment integration has
not been exercised with real credentials.
