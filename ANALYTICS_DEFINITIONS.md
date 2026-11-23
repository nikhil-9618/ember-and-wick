# Analytics Definitions — Ember & Wick

Required by §12 of the master prompt: metric definitions come before charts, so no two screens can
disagree about what "revenue" means. Every figure below is computed on the server; the browser never
receives a full order list to total.

## Ground rules

- Currency: **INR**, integer paise, formatted only at render time.
- Time: timestamps stored UTC; the dashboard currently groups by UTC calendar day. A business
  timezone setting does not exist yet (`settings` table unused, §38), so **day boundaries are UTC
  today** — this is a known limitation, not a policy choice.
- A **payment attempt is not an order**. Only `orders.payment_status = 'paid'` contributes to
  collected revenue, regardless of how many attempts preceded it.
- Refunds are reported separately and are **never netted** into gross revenue silently.
- Nothing is labelled profit. No cost-of-goods data exists (§36), so margin is not calculable and is
  not displayed.

## Metrics that are implemented

| Metric | Definition | Source query | Exclusions |
| --- | --- | --- | --- |
| Paid revenue (gross collected) | `SUM(orders.total)` where `payment_status = 'paid'` | `web/src/lib/services/analytics.ts` | Cancelled, refunded and unpaid orders |
| Paid order count | `COUNT(*)` where `payment_status = 'paid'` | same | — |
| Refunded amount | `SUM(refunds.amount)` where `refunds.status = 'completed'`, joined per order | same | Requested/processing refunds are excluded until confirmed |
| Customers | `COUNT(*) FROM users WHERE role = 'customer'` | same | Staff accounts |
| Order status mix | `COUNT(*) GROUP BY orders.status` | same | — |
| Low stock | Active variants with `stock <= low_stock_threshold`, joined to non-archived products | same | Archived products and inactive variants |
| Top products | `SUM(order_items.quantity)` and `SUM(line_total)` grouped by `product_name`, paid orders only | same | Refunded orders are not subtracted |
| Recent orders | 8 newest by `created_at` | same | — |
| 14-day series | Per-day paid revenue and order count, `substr(COALESCE(paid_at, created_at),1,10)` | same, `created_at >= datetime('now','-14 days')` | Orders older than 14 days |

### Known imprecision in the current figures

1. **Refunded orders still count in gross revenue.** A fully refunded order keeps
   `total` in the "paid revenue" line while its refund appears separately. Net collected is therefore
   `paid revenue − completed refunds` and the UI shows both numbers rather than one ambiguous total.
2. **Top products uses `product_name`**, so renaming a product splits its history into two rows.
   Grouping by `product_id` is the correct fix and requires the snapshot id already stored on
   `order_items`.
3. **Day boundaries are UTC**, not IST, so an order paid at 02:00 IST falls on the previous day.
4. **`paid_at` can be null on older rows**, which is why the series falls back to `created_at`.

## Metrics that are specified but NOT implemented

These must not be displayed until a trustworthy source exists. Each is a `New`/`Repair` row in
`FEATURE_MATRIX.md`.

| Metric | Why it is absent | What it needs |
| --- | --- | --- |
| AOV | Not exposed on any screen | `paid revenue ÷ paid orders`; trivial once a date range exists |
| Units sold / units per order | Only top-5 units exist | `SUM(order_items.quantity)` with a date filter |
| New vs repeat customers | No first-order attribution | First-order date per `user_id` |
| Repeat-purchase rate | Depends on the above | Customers with ≥2 paid orders ÷ customers with ≥1 |
| Conversion rate | No storefront analytics events at all | Session/page-view events or a consent-safe analytics provider |
| Discount total, shipping revenue, tax collected | `orders` has the columns, no aggregate | `SUM(discount)`, `SUM(shipping_fee)`, `SUM(tax)` for paid orders |
| Payment failures / failure rate | Attempts are recorded, not aggregated | `COUNT(payments.status='failed')` by day |
| Abandoned carts | Deferred (§33) | Cart activity events + consent |
| Product/category/payment-method breakdown | Not built | Joins through `order_items` and `payments.method` |
| CSV export | Not built | Server-side export with generation time, filters, currency, timezone |

## Date-range policy (target state)

When the date filter is added: range applies to the **order's paid timestamp** for revenue metrics and
the **creation timestamp** for pipeline metrics (pending, cancelled). The response must echo the
resolved range, the timezone used and the generation timestamp, so a screenshot of a report is
reproducible. Export filenames should carry the same range.

## Access control

- Dashboard totals: `admin` only, via `requireAdmin`.
- Customer-level analytics and any export: not implemented. When added, they must be gated on a
  finance/report permission and record an audit entry, per §39.
