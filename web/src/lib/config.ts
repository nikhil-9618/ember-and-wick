import { getEnv } from "./db";
import { refundApprovalThreshold } from "./refunds";

export type PaymentMode = "razorpay" | "test" | "unconfigured";

export interface PaymentConfig {
  mode: PaymentMode;
  keyId: string | null;
  keySecret: string | null;
  webhookSecret: string | null;
}

function readEnv(env: Record<string, string | undefined>, name: string): string | null {
  const value = process.env[name] ?? env[name];
  return value && value.trim().length > 0 ? value.trim() : null;
}

/**
 * Payment configuration is resolved on the server only. The key secret and
 * webhook secret never leave this function's callers, which are server modules.
 *
 * Real money is the only production path: an order is marked paid exclusively by
 * `razorpay`, after a server-side HMAC signature check or a verified webhook.
 *
 * `test` mode exists for the automated suite and local runs. It is refused
 * whenever NODE_ENV is production, so a deployment can never fake a capture.
 * When no keys are present the mode is `unconfigured` and checkout pauses instead
 * of pretending to charge.
 */
export async function getPaymentConfig(): Promise<PaymentConfig> {
  const env = await getEnv();
  const isProduction = (readEnv(env, "NODE_ENV") ?? "production") === "production";
  const keyId = readEnv(env, "RAZORPAY_KEY_ID");
  const keySecret = readEnv(env, "RAZORPAY_KEY_SECRET");
  const webhookSecret = readEnv(env, "RAZORPAY_WEBHOOK_SECRET");
  const requested = readEnv(env, "PAYMENT_PROVIDER");

  if (requested === "test" && !isProduction) {
    // The webhook secret is independent of the payment mode: keeping it lets the
    // test suite verify real HMAC signature handling and replay protection.
    return { mode: "test", keyId: null, keySecret: null, webhookSecret };
  }
  if (keyId && keySecret) {
    return { mode: "razorpay", keyId, keySecret, webhookSecret };
  }
  return { mode: "unconfigured", keyId: null, keySecret: null, webhookSecret: null };
}

export async function getAppUrl(): Promise<string> {
  const env = await getEnv();
  return readEnv(env, "APP_ORIGIN") ?? process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000";
}

export async function isProduction(): Promise<boolean> {
  const env = await getEnv();
  return (readEnv(env, "NODE_ENV") ?? "production") === "production";
}

export interface RefundPolicy {
  /** Refunds at or above this amount need a second admin's approval. */
  approvalThresholdPaise: number;
}

export async function getRefundPolicy(): Promise<RefundPolicy> {
  const env = await getEnv();
  return { approvalThresholdPaise: refundApprovalThreshold(env) };
}
