import { createHmac } from "node:crypto";
import { describe, expect, it } from "vitest";
import { verifyPaymentSignature, verifyWebhookSignature } from "./razorpay";

const SECRET = "test_secret_key";

function sign(message: string, secret = SECRET): string {
  return createHmac("sha256", secret).update(message).digest("hex");
}

describe("verifyPaymentSignature", () => {
  const orderId = "order_ABC123";
  const paymentId = "pay_XYZ789";

  it("accepts a signature produced by the provider", async () => {
    const signature = sign(`${orderId}|${paymentId}`);
    await expect(verifyPaymentSignature({ orderId, paymentId, signature, secret: SECRET })).resolves.toBe(true);
  });

  it("rejects a tampered payment id", async () => {
    const signature = sign(`${orderId}|${paymentId}`);
    await expect(
      verifyPaymentSignature({ orderId, paymentId: "pay_TAMPERED", signature, secret: SECRET }),
    ).resolves.toBe(false);
  });

  it("rejects a signature made with the wrong secret", async () => {
    const signature = sign(`${orderId}|${paymentId}`, "other_secret");
    await expect(verifyPaymentSignature({ orderId, paymentId, signature, secret: SECRET })).resolves.toBe(false);
  });

  it("rejects an empty signature", async () => {
    await expect(verifyPaymentSignature({ orderId, paymentId, signature: "", secret: SECRET })).resolves.toBe(false);
  });
});

describe("verifyWebhookSignature", () => {
  const rawBody = JSON.stringify({ event: "payment.captured", payload: { payment: { entity: { id: "pay_1" } } } });

  it("accepts the exact raw body", async () => {
    await expect(
      verifyWebhookSignature({ rawBody, signature: sign(rawBody), secret: SECRET }),
    ).resolves.toBe(true);
  });

  it("rejects a body modified after signing", async () => {
    const signature = sign(rawBody);
    await expect(
      verifyWebhookSignature({ rawBody: rawBody.replace("pay_1", "pay_2"), signature, secret: SECRET }),
    ).resolves.toBe(false);
  });
});
