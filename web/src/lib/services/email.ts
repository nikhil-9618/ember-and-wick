import { getEnv } from "../db";
import { ApiError } from "../errors";

/**
 * Sign-up verification email delivery.
 *
 * Two free-tier HTTP providers are supported, because a Worker has no SMTP:
 * Resend (`RESEND_API_KEY`) and Brevo (`BREVO_API_KEY` + `OTP_FROM_EMAIL`).
 * Only a server-side key is ever used; the browser opens no third-party
 * connection and never sees the key.
 *
 * There is no on-screen fallback: an account is verified only by a code that
 * reached a real inbox.
 */

function read(env: Record<string, string | undefined>, name: string): string | null {
  const value = process.env[name] ?? env[name];
  return value && value.trim().length > 0 ? value.trim() : null;
}

/** True when a provider is configured well enough to actually send. */
export async function emailConfigured(): Promise<boolean> {
  const env = await getEnv();
  if (read(env, "RESEND_API_KEY")) return true;
  if (read(env, "BREVO_API_KEY") && read(env, "OTP_FROM_EMAIL")) return true;
  return false;
}

function verificationEmail(code: string): { subject: string; text: string; html: string } {
  const subject = "Verify your Ember & Wick account";
  const text = [
    `Welcome to Ember & Wick. Your verification code is ${code}.`,
    "",
    "It expires in 10 minutes and can only be used once.",
    "If you did not create an account, you can ignore this email.",
  ].join("\n");
  const html = `<div style="font-family:Helvetica,Arial,sans-serif;color:#1b1917;line-height:1.6">
  <p>Welcome to Ember &amp; Wick. Your verification code is</p>
  <p style="font-size:32px;letter-spacing:8px;font-weight:600;margin:16px 0">${code}</p>
  <p style="color:#554d44">It expires in 10 minutes and can only be used once.</p>
  <p style="color:#554d44">If you did not create an account, you can ignore this email.</p>
</div>`;
  return { subject, text, html };
}

/** Sends the code through whichever provider key is configured. */
export async function sendVerificationEmail(to: string, code: string): Promise<void> {
  const env = await getEnv();
  const resendKey = read(env, "RESEND_API_KEY");
  const brevoKey = read(env, "BREVO_API_KEY");
  const fromEmail = read(env, "OTP_FROM_EMAIL");
  const mail = verificationEmail(code);

  if (resendKey) {
    // EMAIL_API_BASE lets an operator (and the integration suite) point delivery
    // at a Resend-compatible gateway instead of the public API.
    const base = read(env, "EMAIL_API_BASE") ?? "https://api.resend.com";
    const response = await fetch(`${base.replace(/\/$/, "")}/emails`, {
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
      console.error("[signup] resend delivery failed:", response.status);
      throw new ApiError("email_error", "We couldn't send the verification email. Please try again.", 502);
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
      console.error("[signup] brevo delivery failed:", response.status);
      throw new ApiError("email_error", "We couldn't send the verification email. Please try again.", 502);
    }
    return;
  }

  throw new ApiError(
    "email_not_configured",
    "Verification email is not configured yet. Add RESEND_API_KEY (and OTP_FROM_EMAIL) on the server.",
    503,
  );
}
