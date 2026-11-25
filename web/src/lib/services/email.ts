import { getEnv } from "../db";
import { ApiError } from "../errors";

/**
 * Sign-up verification email delivery.
 *
 * Mail is sent as the store, never from a personal mailbox. `OTP_FROM_EMAIL` must
 * be an address on a domain the store owns and has authenticated with the
 * provider (a Brevo sender domain or a Resend verified domain), so free mailbox
 * providers are rejected outright: a deployment cannot quietly fall back to a
 * Gmail address.
 *
 * Two free-tier HTTP providers are supported, because there is no SMTP: Resend
 * (`RESEND_API_KEY`) and Brevo (`BREVO_API_KEY`). Only a server-side key is ever
 * used; the browser opens no third-party connection and never sees the key.
 *
 * There is no on-screen fallback: an account is verified only by a code that
 * reached a real inbox.
 */

const PERSONAL_MAILBOX_DOMAINS = new Set([
  "gmail.com",
  "googlemail.com",
  "yahoo.com",
  "yahoo.co.in",
  "yahoo.co.uk",
  "ymail.com",
  "outlook.com",
  "outlook.in",
  "hotmail.com",
  "hotmail.co.uk",
  "live.com",
  "live.in",
  "msn.com",
  "icloud.com",
  "me.com",
  "mac.com",
  "aol.com",
  "gmx.com",
  "gmx.net",
  "mail.com",
  "proton.me",
  "protonmail.com",
  "pm.me",
  "zoho.com",
  "zohomail.in",
  "rediffmail.com",
  "yandex.com",
  "yandex.ru",
  "tutanota.com",
  "fastmail.com",
  "qq.com",
  "163.com",
  "126.com",
]);

const DEFAULT_FROM_NAME = "Ember & Wick";

function read(env: Record<string, string | undefined>, name: string): string | null {
  const value = process.env[name] ?? env[name];
  return value && value.trim().length > 0 ? value.trim() : null;
}

/** Why a sender address is unusable, or null when it is a valid store domain. */
export function senderAddressIssue(fromEmail: string): string | null {
  const address = fromEmail.trim();
  const match = /^[^@\s]+@([a-z0-9-]+(?:\.[a-z0-9-]+)+)$/i.exec(address);
  if (!match) return `OTP_FROM_EMAIL (${address}) is not a valid email address.`;
  const domain = (match[1] ?? "").toLowerCase();
  if (PERSONAL_MAILBOX_DOMAINS.has(domain)) {
    return `OTP_FROM_EMAIL (${address}) is a personal mailbox. Verification mail must be sent from an address on the store's own domain, for example no-reply@your-store-domain.com.`;
  }
  return null;
}

/**
 * The single reason mail cannot be sent right now, or null when it can. The
 * message is written to be shown to an operator, so it names the exact setting
 * that is missing.
 */
export async function emailConfigIssue(): Promise<string | null> {
  const env = await getEnv();
  const provider = read(env, "RESEND_API_KEY") ? "Resend" : read(env, "BREVO_API_KEY") ? "Brevo" : null;
  if (!provider) {
    return "No email provider is configured. Add BREVO_API_KEY or RESEND_API_KEY on the server.";
  }
  const fromEmail = read(env, "OTP_FROM_EMAIL");
  if (!fromEmail) {
    return `Email delivery needs a sender on the store's own domain. Set OTP_FROM_EMAIL, for example no-reply@your-store-domain.com, and authenticate that domain with ${provider}.`;
  }
  return senderAddressIssue(fromEmail);
}

/** True when a provider and a store-domain sender are both configured. */
export async function emailConfigured(): Promise<boolean> {
  return (await emailConfigIssue()) === null;
}

interface Mail {
  subject: string;
  text: string;
  html: string;
}

function verificationEmail(code: string): Mail {
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

function passwordResetEmail(code: string): Mail {
  const subject = "Reset your Ember & Wick password";
  const text = [
    `We received a request to reset the password for your Ember & Wick account. Your reset code is ${code}.`,
    "",
    "It expires in 10 minutes and can only be used once.",
    "If you did not ask for a reset, ignore this email. Your password will not change.",
  ].join("\n");
  const html = `<div style="font-family:Helvetica,Arial,sans-serif;color:#1b1917;line-height:1.6">
  <p>We received a request to reset the password for your Ember &amp; Wick account. Your reset code is</p>
  <p style="font-size:32px;letter-spacing:8px;font-weight:600;margin:16px 0">${code}</p>
  <p style="color:#554d44">It expires in 10 minutes and can only be used once.</p>
  <p style="color:#554d44">If you did not ask for a reset, ignore this email. Your password will not change.</p>
</div>`;
  return { subject, text, html };
}

/** Sends a code as the store's own address through the configured provider. */
async function deliverEmail(to: string, mail: Mail): Promise<void> {
  const env = await getEnv();
  const issue = await emailConfigIssue();
  if (issue) throw new ApiError("email_not_configured", issue, 503);

  const resendKey = read(env, "RESEND_API_KEY");
  const brevoKey = read(env, "BREVO_API_KEY");
  const fromEmail = read(env, "OTP_FROM_EMAIL")!;
  const fromName = read(env, "EMAIL_FROM_NAME") ?? DEFAULT_FROM_NAME;
  const replyTo = read(env, "EMAIL_REPLY_TO");

  if (resendKey) {
    // EMAIL_API_BASE lets an operator (and the integration suite) point delivery
    // at a Resend-compatible gateway instead of the public API.
    const base = read(env, "EMAIL_API_BASE") ?? "https://api.resend.com";
    const response = await fetch(`${base.replace(/\/$/, "")}/emails`, {
      method: "POST",
      headers: { Authorization: `Bearer ${resendKey}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        from: `${fromName} <${fromEmail}>`,
        to: [to],
        subject: mail.subject,
        text: mail.text,
        html: mail.html,
        ...(replyTo ? { reply_to: replyTo } : {}),
      }),
    });
    if (!response.ok) {
      console.error("[email] resend delivery failed:", response.status);
      throw new ApiError("email_error", "We couldn't send the email. Please try again.", 502);
    }
    return;
  }

  const response = await fetch("https://api.brevo.com/v3/smtp/email", {
    method: "POST",
    headers: { "api-key": brevoKey!, "Content-Type": "application/json" },
    body: JSON.stringify({
      sender: { email: fromEmail, name: fromName },
      to: [{ email: to }],
      subject: mail.subject,
      textContent: mail.text,
      htmlContent: mail.html,
      ...(replyTo ? { replyTo: { email: replyTo } } : {}),
    }),
  });
  if (!response.ok) {
    console.error("[email] brevo delivery failed:", response.status);
    throw new ApiError("email_error", "We couldn't send the email. Please try again.", 502);
  }
}

export async function sendVerificationEmail(to: string, code: string): Promise<void> {
  await deliverEmail(to, verificationEmail(code));
}

export async function sendPasswordResetEmail(to: string, code: string): Promise<void> {
  await deliverEmail(to, passwordResetEmail(code));
}
