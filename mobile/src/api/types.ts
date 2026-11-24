/** Mirrors web/src/lib/services/* read models. Keep in sync with the API. */

export interface ApiSession {
  token: string;
  expiresAt: string;
  user: User;
}

/** Returned by /api/v1/auth/login: a code was sent, no session exists yet. */
export interface OtpChallenge {
  otpRequired: true;
  challengeId: string;
  email: string;
  expiresAt: string;
  expiresInSeconds: number;
  delivery: "email" | "demo";
  /** Only present when the server runs with OTP_DEMO_MODE=1. */
  demoCode?: string;
}

export interface User {
  id: string;
  email: string;
  name: string;
  phone: string | null;
  role: "customer" | "admin";
  created_at?: string;
}

export interface ProductListItem {
  id: string;
  slug: string;
  name: string;
  tagline: string | null;
  basePrice: number;
  compareAtPrice: number | null;
  price: number;
  ratingAvg: number;
  ratingCount: number;
  isFeatured: boolean;
  scentNotes: string | null;
  categoryName: string | null;
  categorySlug: string | null;
  imageUrl: string | null;
  imageAlt: string | null;
  totalStock: number;
  variantCount: number;
}

export interface ProductListResponse {
  items: ProductListItem[];
  total: number;
  page: number;
  perPage: number;
  pages: number;
}

export interface ProductVariant {
  id: string;
  name: string;
  sku: string;
  price: number;
  stock: number;
  weightGrams: number | null;
  isActive: boolean;
}

export interface ProductDetail {
  id: string;
  slug: string;
  name: string;
  tagline: string | null;
  description: string;
  waxType: string | null;
  wickType: string | null;
  burnTimeHours: number | null;
  scentNotes: string | null;
  basePrice: number;
  compareAtPrice: number | null;
  currency: string;
  ratingAvg: number;
  ratingCount: number;
  categoryName: string | null;
  categorySlug: string | null;
  images: { url: string; alt: string }[];
  variants: ProductVariant[];
}

export interface Review {
  id: string;
  rating: number;
  title: string | null;
  body: string;
  author: string;
  createdAt: string;
}

export interface Category {
  id: string;
  slug: string;
  name: string;
  description: string | null;
  imageUrl: string | null;
  productCount: number;
}

export interface CartLine {
  id: string;
  variantId: string;
  productId: string;
  productName: string;
  productSlug: string;
  variantName: string;
  sku: string;
  unitPrice: number;
  quantity: number;
  lineTotal: number;
  stock: number;
  imageUrl: string | null;
  imageAlt: string | null;
}

export interface Totals {
  subtotal: number;
  discount: number;
  shippingFee: number;
  tax: number;
  total: number;
}

export interface Cart {
  cartId: string;
  items: CartLine[];
  itemCount: number;
  subtotal: number;
  totals: Totals;
}

export interface Address {
  id: string;
  label: string | null;
  fullName: string;
  phone: string;
  line1: string;
  line2: string | null;
  city: string;
  state: string;
  postalCode: string;
  country: string;
  isDefault: boolean;
}

export interface OrderItem {
  id: string;
  productId: string;
  productName: string;
  variantName: string;
  sku: string;
  unitPrice: number;
  quantity: number;
  lineTotal: number;
}

export type OrderStatus =
  | "pending_payment"
  | "paid"
  | "processing"
  | "packed"
  | "shipped"
  | "delivered"
  | "cancelled"
  | "payment_failed"
  | "refunded";

export interface Order {
  id: string;
  number: string;
  status: OrderStatus;
  statusLabel: string;
  paymentStatus: string;
  subtotal: number;
  discount: number;
  shippingFee: number;
  tax: number;
  total: number;
  currency: string;
  couponCode: string | null;
  email: string;
  address: {
    fullName: string;
    phone: string;
    line1: string;
    line2: string | null;
    city: string;
    state: string;
    postalCode: string;
    country: string;
  } | null;
  notes: string | null;
  trackingNumber: string | null;
  carrier: string | null;
  placedAt: string | null;
  paidAt: string | null;
  shippedAt: string | null;
  deliveredAt: string | null;
  createdAt: string;
  items: OrderItem[];
  payment: { provider: string; status: string; providerPaymentId: string | null } | null;
  refunds: { id: string; amount: number; status: string; reason: string; createdAt: string }[];
  canCancel: boolean;
  canRetryPayment: boolean;
}

export interface PaymentIntent {
  provider: "razorpay" | "test";
  keyId: string | null;
  providerOrderId: string;
  amount: number;
  currency: string;
}

export interface WishlistItem {
  productId: string;
  slug: string;
  name: string;
  tagline: string | null;
  price: number;
  basePrice: number;
  imageUrl: string | null;
  imageAlt: string | null;
  inStock: boolean;
  addedAt: string;
}

export interface NotificationItem {
  id: string;
  type: string;
  title: string;
  body: string;
  data: Record<string, unknown> | null;
  readAt: string | null;
  createdAt: string;
}
