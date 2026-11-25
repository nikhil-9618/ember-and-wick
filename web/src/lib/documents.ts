/**
 * The document shape of every collection.
 *
 * Ids stay application-generated strings (prefixed, e.g. `usr_...`) and live in
 * `_id`, because they appear in URLs, audit logs and provider receipts. Columns
 * that were booleans in the old schema are stored as 0 / 1, so all the existing
 * mapping code and filters keep their meaning.
 */
export interface UserDoc {
  _id: string;
  email: string;
  password_hash: string;
  name: string;
  phone: string | null;
  role: "customer" | "admin";
  created_at: string;
  updated_at: string;
  email_verified_at: string | null;
}

export interface SessionDoc {
  _id: string;
  user_id: string;
  created_at: string;
  expires_at: string;
  revoked_at: string | null;
  user_agent: string | null;
}

export interface AddressDoc {
  _id: string;
  user_id: string;
  label: string | null;
  full_name: string;
  phone: string;
  line1: string;
  line2: string | null;
  city: string;
  state: string;
  postal_code: string;
  country: string;
  is_default: number;
  created_at: string;
  updated_at: string;
}

export interface CategoryDoc {
  _id: string;
  slug: string;
  name: string;
  description: string | null;
  image_url: string | null;
  position: number;
  created_at: string;
}

export interface ProductDoc {
  _id: string;
  slug: string;
  name: string;
  tagline: string | null;
  description: string;
  category_id: string | null;
  wax_type: string | null;
  wick_type: string | null;
  burn_time_hours: number | null;
  scent_notes: string | null;
  base_price: number;
  compare_at_price: number | null;
  currency: string;
  status: "draft" | "active" | "archived";
  is_featured: number;
  rating_avg: number;
  rating_count: number;
  created_at: string;
  updated_at: string;
}

export interface ProductImageDoc {
  _id: string;
  product_id: string;
  url: string;
  alt: string;
  position: number;
}

export interface ProductVariantDoc {
  _id: string;
  product_id: string;
  sku: string;
  name: string;
  price: number;
  weight_grams: number | null;
  stock: number;
  low_stock_threshold: number;
  is_active: number;
  position: number;
}

export interface CartDoc {
  _id: string;
  user_id: string;
  created_at: string;
  updated_at: string;
}

export interface CartItemDoc {
  _id: string;
  cart_id: string;
  variant_id: string;
  quantity: number;
  created_at: string;
}

export interface WishlistItemDoc {
  _id: string;
  user_id: string;
  product_id: string;
  created_at: string;
}

export interface CouponDoc {
  _id: string;
  code: string;
  description: string | null;
  type: "percent" | "fixed";
  value: number;
  min_subtotal: number;
  max_discount: number | null;
  usage_limit: number | null;
  used_count: number;
  starts_at: string | null;
  ends_at: string | null;
  is_active: number;
  created_at: string;
}

export interface OrderDoc {
  _id: string;
  number: string;
  user_id: string | null;
  email: string;
  status: string;
  payment_status: string;
  subtotal: number;
  discount: number;
  shipping_fee: number;
  tax: number;
  total: number;
  currency: string;
  coupon_code: string | null;
  shipping_address_json: string;
  notes: string | null;
  tracking_number: string | null;
  carrier: string | null;
  placed_at: string | null;
  paid_at: string | null;
  shipped_at: string | null;
  delivered_at: string | null;
  cancelled_at: string | null;
  created_at: string;
  updated_at: string;
}

export interface OrderItemDoc {
  _id: string;
  order_id: string;
  variant_id: string;
  product_id: string;
  product_name: string;
  variant_name: string;
  sku: string;
  unit_price: number;
  quantity: number;
  line_total: number;
}

export interface PaymentDoc {
  _id: string;
  order_id: string;
  provider: string;
  provider_order_id: string | null;
  provider_payment_id: string | null;
  amount: number;
  currency: string;
  status: "created" | "authorized" | "captured" | "failed" | "refunded";
  method: string | null;
  error_code: string | null;
  error_description: string | null;
  created_at: string;
  updated_at: string;
}

export interface RefundDoc {
  _id: string;
  order_id: string;
  payment_id: string | null;
  amount: number;
  reason: string;
  status: "requested" | "processing" | "completed" | "failed";
  provider_refund_id: string | null;
  request_key: string | null;
  created_by: string | null;
  approved_by: string | null;
  approved_at: string | null;
  created_at: string;
  updated_at: string;
  processed_at: string | null;
}

export interface ReviewDoc {
  _id: string;
  product_id: string;
  user_id: string;
  rating: number;
  title: string | null;
  body: string;
  status: "pending" | "published" | "rejected";
  created_at: string;
}

export interface NotificationDoc {
  _id: string;
  user_id: string;
  type: string;
  title: string;
  body: string;
  data_json: string | null;
  read_at: string | null;
  created_at: string;
}

export interface ContactMessageDoc {
  _id: string;
  name: string;
  email: string;
  subject: string | null;
  message: string;
  status: "new" | "read" | "archived";
  created_at: string;
}

export interface WebhookEventDoc {
  _id: string;
  provider: string;
  event_id: string;
  event_type: string;
  status: "received" | "processed" | "ignored" | "failed";
  error: string | null;
  created_at: string;
  processed_at: string | null;
}

export interface IdempotencyKeyDoc {
  _id: string;
  user_id: string | null;
  scope: string;
  request_hash: string;
  response_json: string | null;
  created_at: string;
}

export interface RateLimitDoc {
  _id: string;
  count: number;
  window_start: number;
}

export interface SettingDoc {
  _id: string;
  value: string;
}

export interface DeviceTokenDoc {
  _id: string;
  user_id: string;
  token: string;
  platform: "ios" | "android";
  created_at: string;
  last_seen_at: string;
}

export interface OrderStatusHistoryDoc {
  _id: string;
  order_id: string;
  from_status: string | null;
  to_status: string;
  actor_type: "customer" | "admin" | "system" | "webhook";
  actor_id: string | null;
  actor_label: string | null;
  reason: string | null;
  created_at: string;
}

export interface AuditLogDoc {
  _id: string;
  actor_id: string | null;
  actor_email: string;
  action: string;
  entity_type: string;
  entity_id: string | null;
  summary: string;
  detail_json: string | null;
  created_at: string;
}

export interface InventoryMovementDoc {
  _id: string;
  variant_id: string;
  delta: number;
  reason: "order_reserved" | "order_released" | "admin_adjustment" | "restock";
  reference_type: string | null;
  reference_id: string | null;
  actor_type: "customer" | "admin" | "system";
  actor_id: string | null;
  note: string | null;
  created_at: string;
}

export interface SignupOtpChallengeDoc {
  _id: string;
  user_id: string;
  email: string;
  code_hash: string;
  attempts: number;
  ip: string | null;
  issued_at: string;
  expires_at: string;
  consumed_at: string | null;
}

export interface PasswordResetChallengeDoc {
  _id: string;
  user_id: string | null;
  email: string;
  code_hash: string;
  attempts: number;
  ip: string | null;
  issued_at: string;
  expires_at: string;
  consumed_at: string | null;
}
