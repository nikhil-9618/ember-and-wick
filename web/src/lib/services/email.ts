import { getEnv } from "../db";
import { ApiError } from "../errors";

/**
 * Verification and password-reset code delivery.
 *
 * Three free-tier HTTP providers are supported, because there is no SMTP: Brevo
 * (`BREVO_API_KEY`, 300 emails/day free), MailerSend (`MAILERSEND_API_KEY`) and
 * Resend (`RESEND_API_KEY`). Only a server-side key is used; the browser opens
 * no third-party connection and never sees it.
 *
 * The sender is `OTP_FROM_EMAIL`. It is either an address on a domain the store
 * owns and has authenticated, or — when there is no domain yet — a mailbox the
 * provider has verified as a sender. Brevo cannot authenticate a free domain, so
 * it rewrites such a sender to the store's own authenticated Brevo domain
 * (`<account>.brevosend.com`): the message still comes from an authenticated
 * domain, and the code reaches real inboxes. That rewrite is why a mailbox
 * sender is accepted here instead of rejected, and why Brevo is the default
 * provider.
 *
 * Resend and MailerSend only send from a domain you control (or their own trial
 * domain), so a free-mailbox sender is refused for them up front with an
 * operator message rather than failing mid-signup.
 *
 * Provider choice: `EMAIL_PROVIDER` (brevo | mailersend | resend) wins when it
 * is set; otherwise the first configured key in that same order is used. The
 * explicit setting matters because the presence of a key says nothing about
 * whether its sending domain finished verification.
 *
 * There is no on-screen fallback: an account is verified only by a code that
 * reached a real inbox.
 */

const FREE_MAILBOX_DOMAINS = new Set([
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

type ProviderName = "brevo" | "mailersend" | "resend";

const PROVIDER_ORDER: ProviderName[] = ["brevo", "mailersend", "resend"];

const PROVIDER_KEY_ENV: Record<ProviderName, string> = {
  brevo: "BREVO_API_KEY",
  mailersend: "MAILERSEND_API_KEY",
  resend: "RESEND_API_KEY",
};

function read(env: Record<string, string | undefined>, name: string): string | null {
  const value = process.env[name] ?? env[name];
  return value && value.trim().length > 0 ? value.trim() : null;
}

/** The domain of a sender address, lowercased, or null when it is malformed. */
function senderDomain(fromEmail: string): string | null {
  const match = /^[^@\s]+@([a-z0-9-]+(?:\.[a-z0-9-]+)+)$/i.exec(fromEmail.trim());
  return match ? (match[1] ?? "").toLowerCase() : null;
}

/**
 * Why a sender address is unusable, or null when it is well formed. A mailbox
 * sender passes: Brevo turns it into an authenticated sender on its own domain.
 */
export function senderAddressIssue(fromEmail: string): string | null {
  const address = fromEmail.trim();
  if (!senderDomain(address)) {
    return `OTP_FROM_EMAIL (${address}) is not a valid email address.`;
  }
  return null;
}

interface Provider {
  name: ProviderName;
  key: string;
}

/** The selected provider, or null when none (or the selected one) is usable. */
function resolveProvider(env: Record<string, string | undefined>): Provider | null {
  const requested = read(env, "EMAIL_PROVIDER")?.toLowerCase();
  if (requested) {
    const name = PROVIDER_ORDER.find((candidate) => candidate === requested);
    if (!name) return null;
    const key = read(env, PROVIDER_KEY_ENV[name]);
    return key ? { name, key } : null;
  }
  for (const name of PROVIDER_ORDER) {
    const key = read(env, PROVIDER_KEY_ENV[name]);
    if (key) return { name, key };
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
  const requested = read(env, "EMAIL_PROVIDER")?.toLowerCase();

  if (requested && !PROVIDER_ORDER.includes(requested as ProviderName)) {
    return `EMAIL_PROVIDER (${requested}) must be one of: ${PROVIDER_ORDER.join(", ")}.`;
  }

  const provider = resolveProvider(env);
  if (!provider) {
    if (requested) {
      const keyEnv = PROVIDER_KEY_ENV[requested as ProviderName];
      return `EMAIL_PROVIDER=${requested} is selected but ${keyEnv} is not set on the server.`;
    }
    return `No email provider is configured. Set ${PROVIDER_ORDER.map((name) => PROVIDER_KEY_ENV[name]).join(", ")}.`;
  }

  const fromEmail = read(env, "OTP_FROM_EMAIL");
  if (!fromEmail) {
    return `Set OTP_FROM_EMAIL to the sender verified with ${provider.name}. With Brevo a normal mailbox works, for example store@gmail.com; no domain or DNS is needed.`;
  }

  const formatIssue = senderAddressIssue(fromEmail);
  if (formatIssue) return formatIssue;

  const domain = senderDomain(fromEmail);
  const isFreeMailbox = domain !== null && FREE_MAILBOX_DOMAINS.has(domain);
  if (isFreeMailbox && provider.name !== "brevo") {
    return `OTP_FROM_EMAIL (${fromEmail}) is a free mailbox, and ${provider.name} only sends from a domain you have verified. Use Brevo (EMAIL_PROVIDER=brevo with a verified mailbox sender), or set OTP_FROM_EMAIL to an address on a domain authenticated with ${provider.name}.`;
  }

  return null;
}

/** True when a provider and a usable sender are both configured. */
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

interface Request {
  url: string;
  headers: Record<string, string>;
  body: unknown;
}

function providerRequest(input: {
  provider: Provider;
  env: Record<string, string | undefined>;
  fromEmail: string;
  fromName: string;
  replyTo: string | null;
  to: string;
  mail: Mail;
}): Request {
  const { provider, env, fromEmail, fromName, replyTo, to, mail } = input;

  if (provider.name === "brevo") {
    return {
      url: "https://api.brevo.com/v3/smtp/email",
      headers: { "api-key": provider.key, "Content-Type": "application/json" },
      body: {
        sender: { email: fromEmail, name: fromName },
        to: [{ email: to }],
        subject: mail.subject,
        textContent: mail.text,
        htmlContent: mail.html,
        ...(replyTo ? { replyTo: { email: replyTo } } : {}),
      },
    };
  }

  if (provider.name === "mailersend") {
    return {
      url: "https://api.mailersend.com/v1/email",
      headers: { Authorization: `Bearer ${provider.key}`, "Content-Type": "application/json" },
      body: {
        from: { email: fromEmail, name: fromName },
        to: [{ email: to }],
        subject: mail.subject,
        text: mail.text,
        html: mail.html,
        ...(replyTo ? { reply_to: { email: replyTo } } : {}),
      },
    };
  }

  // EMAIL_API_BASE lets an operator (and the integration suite) point delivery
  // at a Resend-compatible gateway instead of the public API.
  const base = read(env, "EMAIL_API_BASE") ?? "https://api.resend.com";
  return {
    url: `${base.replace(/\/$/, "")}/emails`,
    headers: { Authorization: `Bearer ${provider.key}`, "Content-Type": "application/json" },
    body: {
      from: `${fromName} <${fromEmail}>`,
      to: [to],
      subject: mail.subject,
      text: mail.text,
      html: mail.html,
      ...(replyTo ? { reply_to: replyTo } : {}),
    },
  };
}

/** Sends a code through the configured provider. */
async function deliverEmail(to: string, mail: Mail): Promise<void> {
  const env = await getEnv();
  const issue = await emailConfigIssue();
  if (issue) throw new ApiError("email_not_configured", issue, 503);

  const provider = resolveProvider(env)!;
  const request = providerRequest({
    provider,
    env,
    fromEmail: read(env, "OTP_FROM_EMAIL")!,
    fromName: read(env, "EMAIL_FROM_NAME") ?? DEFAULT_FROM_NAME,
    replyTo: read(env, "EMAIL_REPLY_TO"),
    to,
    mail,
  });

  const response = await fetch(request.url, {
    method: "POST",
    headers: request.headers,
    body: JSON.stringify(request.body),
  });

  if (!response.ok) {
    // The provider's own message is the only thing that explains a rejection
    // (unverified sender, exhausted free quota, revoked key), so it goes to the
    // server log — never to the browser.
    const detail = (await response.text().catch(() => "")).slice(0, 300);
    console.error(`[email] ${provider.name} delivery failed:`, response.status, detail);
    throw new ApiError("email_error", "We couldn't send the email. Please try again.", 502);
  }
}

export async function sendVerificationEmail(to: string, code: string): Promise<void> {
  await deliverEmail(to, verificationEmail(code));
}

export async function sendPasswordResetEmail(to: string, code: string): Promise<void> {
  await deliverEmail(to, passwordResetEmail(code));
}
