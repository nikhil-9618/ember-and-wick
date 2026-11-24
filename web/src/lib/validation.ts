import { z } from "zod";

const email = z
  .string()
  .trim()
  .min(3)
  .max(254)
  .email("Enter a valid email address.")
  .transform((value) => value.toLowerCase());

const phone = z
  .string()
  .trim()
  .regex(/^[0-9+\-\s()]{7,20}$/, "Enter a valid phone number.");

export const passwordSchema = z
  .string()
  .min(8, "Use at least 8 characters.")
  .max(128, "Password is too long.")
  .refine((value) => /[A-Za-z]/.test(value), "Include at least one letter.")
  .refine((value) => /[0-9]/.test(value), "Include at least one number.");

export const registerSchema = z.object({
  name: z.string().trim().min(2, "Tell us your name.").max(80),
  email,
  password: passwordSchema,
  phone: phone.optional().or(z.literal("")),
});

export const loginSchema = z.object({
  email,
  password: z.string().min(1, "Enter your password.").max(128),
});

export const updateProfileSchema = z.object({
  name: z.string().trim().min(2).max(80).optional(),
  phone: phone.optional().or(z.literal("")).nullable(),
});

export const changePasswordSchema = z.object({
  currentPassword: z.string().min(1).max(128),
  newPassword: passwordSchema,
});

export const addressSchema = z.object({
  label: z.string().trim().max(40).optional().or(z.literal("")),
  fullName: z.string().trim().min(2, "Full name is required.").max(80),
  phone,
  line1: z.string().trim().min(4, "Address line 1 is required.").max(160),
  line2: z.string().trim().max(160).optional().or(z.literal("")),
  city: z.string().trim().min(2, "City is required.").max(80),
  state: z.string().trim().min(2, "State is required.").max(80),
  postalCode: z.string().trim().regex(/^[1-9][0-9]{5}$/, "Enter a valid 6-digit PIN code."),
  country: z.string().trim().length(2).default("IN"),
  isDefault: z.boolean().optional(),
});

export const cartItemSchema = z.object({
  variantId: z.string().min(3).max(80),
  quantity: z.number().int().min(1).max(10),
});

export const cartUpdateSchema = z.object({
  variantId: z.string().min(3).max(80),
  quantity: z.number().int().min(0).max(10),
});

export const checkoutSchema = z
  .object({
    email: email.optional(),
    addressId: z.string().min(3).max(80).optional(),
    address: addressSchema.omit({ isDefault: true }).optional(),
    couponCode: z.string().trim().max(32).optional().or(z.literal("")),
    notes: z.string().trim().max(500).optional().or(z.literal("")),
    idempotencyKey: z.string().trim().min(8).max(100).optional(),
  })
  .refine((value) => Boolean(value.addressId || value.address), {
    message: "A delivery address is required.",
    path: ["address"],
  });

export const productQuerySchema = z.object({
  q: z.string().trim().max(120).optional(),
  category: z.string().trim().max(80).optional(),
  minPrice: z.coerce.number().int().min(0).optional(),
  maxPrice: z.coerce.number().int().min(0).optional(),
  scent: z.string().trim().max(60).optional(),
  sort: z.enum(["newest", "price_asc", "price_desc", "rating", "featured"]).default("featured"),
  page: z.coerce.number().int().min(1).max(200).default(1),
  perPage: z.coerce.number().int().min(1).max(48).default(12),
});

export const reviewSchema = z.object({
  rating: z.number().int().min(1).max(5),
  title: z.string().trim().max(100).optional().or(z.literal("")),
  body: z.string().trim().min(10, "Share a little more detail.").max(2000),
});

export const contactSchema = z.object({
  name: z.string().trim().min(2).max(80),
  email,
  subject: z.string().trim().max(120).optional().or(z.literal("")),
  message: z.string().trim().min(10, "Please add a little more detail.").max(2000),
});

const variantInput = z.object({
  id: z.string().min(3).max(80).optional(),
  name: z.string().trim().min(1).max(80),
  sku: z
    .string()
    .trim()
    .min(3)
    .max(60)
    .regex(/^[A-Za-z0-9-_]+$/, "SKU may contain letters, numbers, dashes and underscores."),
  price: z.number().int().min(100, "Price must be at least ₹1.").max(100_000_00),
  stock: z.number().int().min(0).max(100_000),
  weightGrams: z.number().int().min(0).max(100_000).optional(),
  lowStockThreshold: z.number().int().min(0).max(10_000).optional(),
  isActive: z.boolean().optional(),
});

export const adminProductSchema = z.object({
  name: z.string().trim().min(3).max(120),
  slug: z
    .string()
    .trim()
    .min(3)
    .max(120)
    .regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/, "Use lowercase words separated by dashes."),
  tagline: z.string().trim().max(160).optional().or(z.literal("")),
  description: z.string().trim().min(20, "Add a product description.").max(5000),
  categoryId: z.string().min(3).max(80).nullable().optional(),
  waxType: z.string().trim().max(80).optional().or(z.literal("")),
  wickType: z.string().trim().max(80).optional().or(z.literal("")),
  burnTimeHours: z.number().int().min(0).max(1000).optional(),
  scentNotes: z.string().trim().max(200).optional().or(z.literal("")),
  basePrice: z.number().int().min(100).max(100_000_00),
  compareAtPrice: z.number().int().min(0).max(100_000_00).nullable().optional(),
  status: z.enum(["draft", "active", "archived"]).default("draft"),
  isFeatured: z.boolean().optional(),
  images: z
    .array(
      z.object({
        url: z.string().trim().min(1).max(500),
        alt: z.string().trim().min(1).max(160),
      }),
    )
    .max(6)
    .optional(),
  variants: z.array(variantInput).min(1, "At least one variant is required.").max(10),
});

export const adminVariantPatchSchema = z.object({
  price: z.number().int().min(100).max(100_000_00).optional(),
  stock: z.number().int().min(0).max(100_000).optional(),
  lowStockThreshold: z.number().int().min(0).max(10_000).optional(),
  isActive: z.boolean().optional(),
});

export const adminOrderPatchSchema = z.object({
  status: z
    .enum(["pending_payment", "paid", "processing", "packed", "shipped", "delivered", "cancelled", "payment_failed", "refunded"])
    .optional(),
  trackingNumber: z.string().trim().max(80).optional().or(z.literal("")),
  carrier: z.string().trim().max(80).optional().or(z.literal("")),
  note: z.string().trim().max(500).optional().or(z.literal("")),
});

export const couponSchema = z.object({
  code: z
    .string()
    .trim()
    .min(3)
    .max(32)
    .transform((value) => value.toUpperCase())
    .refine((value) => /^[A-Z0-9_-]+$/.test(value), "Use letters, numbers, dashes or underscores."),
  description: z.string().trim().max(160).optional().or(z.literal("")),
  type: z.enum(["percent", "fixed"]),
  value: z.number().int().min(1),
  minSubtotal: z.number().int().min(0).default(0),
  maxDiscount: z.number().int().min(1).nullable().optional(),
  usageLimit: z.number().int().min(1).nullable().optional(),
  startsAt: z.string().datetime().nullable().optional(),
  endsAt: z.string().datetime().nullable().optional(),
  isActive: z.boolean().default(true),
});

export const refundSchema = z.object({
  orderId: z.string().min(3).max(80),
  amount: z.number().int().min(1),
  reason: z.string().trim().min(5).max(300),
  /** Optional client key so a retried submission cannot issue a second refund. */
  requestKey: z.string().trim().min(8).max(100).optional(),
});

export const reviewModerationSchema = z.object({
  status: z.enum(["published", "rejected"]),
});

export const cancelOrderSchema = z.object({
  reason: z.string().trim().max(300).optional().or(z.literal("")),
});

export type RegisterInput = z.infer<typeof registerSchema>;
export type AddressInput = z.infer<typeof addressSchema>;
export type CheckoutInput = z.infer<typeof checkoutSchema>;
export type AdminProductInput = z.infer<typeof adminProductSchema>;
