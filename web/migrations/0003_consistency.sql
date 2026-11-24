-- P0 consistency: auditable state changes for orders, admin actions and stock.
-- Every table here is append-only; rows are never updated or deleted by the app.

-- Who moved an order between statuses, and why.
CREATE TABLE IF NOT EXISTS order_status_history (
  id          TEXT PRIMARY KEY,
  order_id    TEXT NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
  from_status TEXT,
  to_status   TEXT NOT NULL,
  actor_type  TEXT NOT NULL CHECK (actor_type IN ('customer', 'admin', 'system', 'webhook')),
  actor_id    TEXT,
  actor_label TEXT,
  reason      TEXT,
  created_at  TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_order_status_history_order ON order_status_history(order_id, created_at);

-- Privileged admin mutations (prices, stock, order status, refunds, coupons...).
CREATE TABLE IF NOT EXISTS admin_audit_log (
  id          TEXT PRIMARY KEY,
  actor_id    TEXT,
  actor_email TEXT NOT NULL,
  action      TEXT NOT NULL,
  entity_type TEXT NOT NULL,
  entity_id   TEXT,
  summary     TEXT NOT NULL,
  detail_json TEXT,
  created_at  TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_admin_audit_log_created ON admin_audit_log(created_at);
CREATE INDEX IF NOT EXISTS idx_admin_audit_log_entity ON admin_audit_log(entity_type, entity_id);

-- Append-only stock ledger. `delta` is signed: negative reserves, positive restores.
CREATE TABLE IF NOT EXISTS inventory_movements (
  id             TEXT PRIMARY KEY,
  variant_id     TEXT NOT NULL REFERENCES product_variants(id) ON DELETE CASCADE,
  delta          INTEGER NOT NULL CHECK (delta <> 0),
  reason         TEXT NOT NULL CHECK (reason IN ('order_reserved', 'order_released', 'admin_adjustment', 'restock')),
  reference_type TEXT,
  reference_id   TEXT,
  actor_type     TEXT NOT NULL CHECK (actor_type IN ('customer', 'admin', 'system')),
  actor_id       TEXT,
  note           TEXT,
  created_at     TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_inventory_movements_variant ON inventory_movements(variant_id, created_at);
CREATE INDEX IF NOT EXISTS idx_inventory_movements_reference ON inventory_movements(reference_type, reference_id);

-- Refunds at or above REFUND_APPROVAL_THRESHOLD_PAISE are created as 'requested'
-- and only move money once a *different* admin approves them.
ALTER TABLE refunds ADD COLUMN approved_by TEXT;
ALTER TABLE refunds ADD COLUMN approved_at TEXT;
ALTER TABLE refunds ADD COLUMN request_key TEXT;

-- Duplicate-execution guards: one request key and one provider refund id can only
-- ever be attached to a single refund row (SQLite treats NULLs as distinct).
CREATE UNIQUE INDEX IF NOT EXISTS idx_refunds_request_key ON refunds(request_key);
CREATE UNIQUE INDEX IF NOT EXISTS idx_refunds_provider_refund_id ON refunds(provider_refund_id);
CREATE INDEX IF NOT EXISTS idx_refunds_status ON refunds(status, created_at);
