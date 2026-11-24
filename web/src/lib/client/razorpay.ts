export interface PaymentIntentView {
  provider: "razorpay" | "test" | "demo";
  keyId: string | null;
  providerOrderId: string;
  amount: number;
  currency: string;
}

export function loadRazorpayScript(): Promise<boolean> {
  return new Promise((resolve) => {
    if (typeof window === "undefined") return resolve(false);
    if (window.Razorpay) return resolve(true);
    const existing = document.querySelector<HTMLScriptElement>('script[src="https://checkout.razorpay.com/v1/checkout.js"]');
    if (existing) {
      existing.addEventListener("load", () => resolve(true));
      existing.addEventListener("error", () => resolve(false));
      return;
    }
    const script = document.createElement("script");
    script.src = "https://checkout.razorpay.com/v1/checkout.js";
    script.async = true;
    script.onload = () => resolve(true);
    script.onerror = () => resolve(false);
    document.body.appendChild(script);
  });
}

export interface OpenCheckoutOptions {
  intent: PaymentIntentView;
  orderNumber: string;
  email: string;
  themeColor?: string;
  onSuccess: (response: { razorpay_order_id: string; razorpay_payment_id: string; razorpay_signature: string }) => void;
  onDismiss: () => void;
}

export async function openRazorpayCheckout(options: OpenCheckoutOptions): Promise<boolean> {
  const loaded = await loadRazorpayScript();
  if (!loaded || !options.intent.keyId) return false;

  const instance = new window.Razorpay!({
    key: options.intent.keyId,
    amount: options.intent.amount,
    currency: options.intent.currency,
    name: "Ember & Wick",
    description: `Order ${options.orderNumber}`,
    order_id: options.intent.providerOrderId,
    prefill: { email: options.email },
    notes: { orderNumber: options.orderNumber },
    theme: { color: options.themeColor ?? "#a45c2b" },
    handler: options.onSuccess,
    modal: { ondismiss: options.onDismiss },
  });

  instance.open();
  return true;
}
