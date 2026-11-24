import { getEnv } from "../db";
import { ApiError } from "../errors";

/**
 * Sign-in code delivery.
 *
 * Two free-tier HTTP email providers are supported so no paid service is
 * required: Resend (`RESEND_API_KEY`) and Brevo (`BREVO_API_KEY`). Only an API
 * key ever reaches the server; the browser opens no third-party connection.
 *
 * When neither key is configured, codes can be shown on screen instead, but
 * only if the operator explicitly opts in with `OTP_DEMO_MODE=1`. Without that
 * flag sign-in fails closed rather than handing out codes.
 */
export type OtpDelivery = "email" | "demo";

function read(env: Record<string, string | undefined>, name: string): string | null {
  const value = process.env[name] ?? env[name];
  return value && value.trim().length > 0 ? value.trim() : null;
}

export async function otpDeliveryMode(): Promise<OtpDelivery | null> {
  const env = await getEnv();
  if (read(env, "RESEND_API_KEY") || read(env, "BREVO_API_KEY")) return "email";
  if (read(env, "OTP_DEMO_MODE") === "1") return "demo";
  return null;
}

function codeEmail(code: string): { subject: string; text: string; html: string } {
  const subject = "Your Ember & Wick sign-in code";
  const text = [
    `Your sign-in code is ${code}.`,
    "",
    "It expires in 10 minutes and can only be used once.",
    "If you did not try to sign in, you can ignore this email.",
  ].join("\n");
  const html = `<div style="font-family:Helvetica,Arial,sans-serif;color:#1b1917;line-height:1.6">
  <p>Your Ember &amp; Wick sign-in code is</p>
  <p style="font-size:32px;letter-spacing:8px;font-weight:600;margin:16px 0">${code}</p>
  <p style="color:#554d44">It expires in 10 minutes and can only be used once.</p>
  <p style="color:#554d44">If you did not try to sign in, you can ignore this email.</p>
</div>`;
  return { subject, text, html };
}

/** Sends the code through whichever provider key is configured. */
export async function sendOtpEmail(to: string, code: string): Promise<void> {
  const env = await getEnv();
  const resendKey = read(env, "RESEND_API_KEY");
  const brevoKey = read(env, "BREVO_API_KEY");
  const fromEmail = read(env, "OTP_FROM_EMAIL");
  const mail = codeEmail(code);

  if (resendKey) {
    const response = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: { Authorization: `Bearer ${resendKey}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        from: fromEmail ?? "Ember & Wick <onboarding@resend.dev>",
        to: [to],
        subject: mail.subject,
        text: mail.text,
        html: mail.html,
      }),
    });
    if (!response.ok) {
      console.error("[otp] resend delivery failed:", response.status);
      throw new ApiError("email_error", "We couldn't send the code just now. Please try again.", 502);
    }
    return;
  }

  if (brevoKey) {
    if (!fromEmail) {
      throw new ApiError(
        "email_not_configured",
        "Email delivery needs a verified sender address in OTP_FROM_EMAIL.",
        503,
      );
    }
    const response = await fetch("https://api.brevo.com/v3/smtp/email", {
      method: "POST",
      headers: { "api-key": brevoKey, "Content-Type": "application/json" },
      body: JSON.stringify({
        sender: { email: fromEmail, name: "Ember & Wick" },
        to: [{ email: to }],
        subject: mail.subject,
        textContent: mail.text,
        htmlContent: mail.html,
      }),
    });
    if (!response.ok) {
      console.error("[otp] brevo delivery failed:", response.status);
      throw new ApiError("email_error", "We couldn't send the code just now. Please try again.", 502);
    }
    return;
  }

  throw new ApiError(
    "email_not_configured",
    "Email sign-in codes are not configured yet. Add RESEND_API_KEY or BREVO_API_KEY on the server.",
    503,
  );
}
