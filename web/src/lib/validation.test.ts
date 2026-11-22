import { describe, expect, it } from "vitest";
import { addressSchema, adminProductSchema, checkoutSchema, loginSchema, registerSchema } from "./validation";

describe("registerSchema", () => {
  it("normalises the email to lowercase", () => {
    const result = registerSchema.parse({ name: "Aarav", email: "AARAV@Example.COM", password: "Password123" });
    expect(result.email).toBe("aarav@example.com");
  });

  it("rejects a password without a number", () => {
    expect(() => registerSchema.parse({ name: "Aarav", email: "a@b.co", password: "onlyletters" })).toThrow();
  });

  it("rejects a password shorter than 8 characters", () => {
    expect(() => registerSchema.parse({ name: "Aarav", email: "a@b.co", password: "Ab1" })).toThrow();
  });

  it("accepts an empty optional phone", () => {
    expect(() => registerSchema.parse({ name: "Aarav", email: "a@b.co", password: "Password123", phone: "" })).not.toThrow();
  });
});

describe("loginSchema", () => {
  it("requires a password", () => {
    expect(() => loginSchema.parse({ email: "a@b.co", password: "" })).toThrow();
  });
});

describe("addressSchema", () => {
  const base = {
    fullName: "Aarav Menon",
    phone: "+91 98450 11223",
    line1: "12 Test Lane",
    city: "Bengaluru",
    state: "Karnataka",
    postalCode: "560038",
  };

  it("accepts a valid Indian address", () => {
    expect(addressSchema.parse(base).postalCode).toBe("560038");
  });

  it("rejects a PIN code starting with zero", () => {
    expect(() => addressSchema.parse({ ...base, postalCode: "060038" })).toThrow();
  });

  it("rejects a 5-digit PIN code", () => {
    expect(() => addressSchema.parse({ ...base, postalCode: "56003" })).toThrow();
  });

  it("defaults the country to IN", () => {
    expect(addressSchema.parse(base).country).toBe("IN");
  });
});

describe("checkoutSchema", () => {
  const address = {
    fullName: "Aarav Menon",
    phone: "+91 98450 11223",
    line1: "12 Test Lane",
    city: "Bengaluru",
    state: "Karnataka",
    postalCode: "560038",
  };

  it("requires either a saved address or a new one", () => {
    expect(() => checkoutSchema.parse({})).toThrow();
  });

  it("accepts a saved address", () => {
    expect(checkoutSchema.parse({ addressId: "adr_123" }).addressId).toBe("adr_123");
  });

  it("accepts an inline address", () => {
    expect(checkoutSchema.parse({ address }).address?.fullName).toBe("Aarav Menon");
  });
});

describe("adminProductSchema", () => {
  const product = {
    name: "Cedar Candle",
    slug: "cedar-candle",
    description: "A long enough description for the candle product.",
    basePrice: 89900,
    variants: [{ name: "200 g", sku: "CED-200", price: 89900, stock: 10 }],
  };

  it("accepts a valid product", () => {
    expect(adminProductSchema.parse(product).slug).toBe("cedar-candle");
  });

  it("requires at least one variant", () => {
    expect(() => adminProductSchema.parse({ ...product, variants: [] })).toThrow();
  });

  it("rejects an invalid slug", () => {
    expect(() => adminProductSchema.parse({ ...product, slug: "Cedar Candle" })).toThrow();
  });

  it("rejects a negative stock", () => {
    expect(() =>
      adminProductSchema.parse({ ...product, variants: [{ ...product.variants[0], stock: -1 }] }),
    ).toThrow();
  });
});
