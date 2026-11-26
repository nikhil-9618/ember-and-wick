import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { emailConfigIssue, sendPasswordResetEmail } from "./services/email";

const MANAGED_KEYS = [
  "BREVO_API_KEY",
  "MAILERSEND_API_KEY",
  "RESEND_API_KEY",
  "OTP_FROM_EMAIL",
  "EMAIL_PROVIDER",
  "EMAIL_FROM_NAME",
  "EMAIL_REPLY_TO",
  "EMAIL_API_BASE",
];

let saved: Record<string, string | undefined> = {};

function useEnv(values: Record<string, string>): void {
  for (const key of MANAGED_KEYS) delete process.env[key];
  Object.assign(process.env, values);
}

beforeEach(() => {
  saved = Object.fromEntries(MANAGED_KEYS.map((key) => [key, process.env[key]]));
});

afterEach(() => {
  vi.unstubAllGlobals();
  for (const key of MANAGED_KEYS) {
    delete process.env[key];
    if (saved[key] !== undefined) process.env[key] = saved[key];
  }
});

describe("emailConfigIssue", () => {
  it("accepts a verified mailbox sender with Brevo, which needs no domain", async () => {
    useEnv({ BREVO_API_KEY: "xkeysib-test", OTP_FROM_EMAIL: "store@gmail.com" });
    expect(await emailConfigIssue()).toBeNull();
  });

  it("refuses a mailbox sender on a provider that cannot rewrite the domain", async () => {
    useEnv({ RESEND_API_KEY: "re_test", OTP_FROM_EMAIL: "store@gmail.com" });
    expect(await emailConfigIssue()).toContain("free mailbox");
  });

  it("names the missing key when no provider is configured", async () => {
    useEnv({ OTP_FROM_EMAIL: "store@gmail.com" });
    const issue = await emailConfigIssue();
    expect(issue).toContain("BREVO_API_KEY");
    expect(issue).toContain("MAILERSEND_API_KEY");
    expect(issue).toContain("RESEND_API_KEY");
  });

  it("honours an explicit EMAIL_PROVIDER even when another key exists", async () => {
    useEnv({
      EMAIL_PROVIDER: "resend",
      BREVO_API_KEY: "xkeysib-test",
      OTP_FROM_EMAIL: "store@gmail.com",
    });
    expect(await emailConfigIssue()).toContain("RESEND_API_KEY is not set");
  });

  it("requires a sender address", async () => {
    useEnv({ BREVO_API_KEY: "xkeysib-test" });
    expect(await emailConfigIssue()).toContain("OTP_FROM_EMAIL");
  });
});

describe("Brevo delivery", () => {
  it("posts an authenticated request to the Brevo endpoint", async () => {
    const calls: { url: string; init: RequestInit }[] = [];
    vi.stubGlobal("fetch", async (url: string, init: RequestInit) => {
      calls.push({ url, init });
      return new Response(JSON.stringify({ messageId: "<test@brevo>" }), { status: 201 });
    });
    useEnv({
      BREVO_API_KEY: "xkeysib-test",
      OTP_FROM_EMAIL: "store@gmail.com",
      EMAIL_FROM_NAME: "Ember & Wick",
      EMAIL_REPLY_TO: "hello@emberandwick.com",
    });

    await sendPasswordResetEmail("customer@example.com", "123456");

    expect(calls).toHaveLength(1);
    const [call] = calls;
    expect(call!.url).toBe("https://api.brevo.com/v3/smtp/email");
    const headers = call!.init.headers as Record<string, string>;
    expect(headers["api-key"]).toBe("xkeysib-test");
    expect(headers["Content-Type"]).toBe("application/json");

    const body = JSON.parse(String(call!.init.body));
    expect(body.sender).toEqual({ email: "store@gmail.com", name: "Ember & Wick" });
    expect(body.to).toEqual([{ email: "customer@example.com" }]);
    expect(body.subject).toBe("Reset your Ember & Wick password");
    expect(body.textContent).toContain("123456");
    expect(body.htmlContent).toContain("123456");
    expect(body.replyTo).toEqual({ email: "hello@emberandwick.com" });
  });

  it("turns a provider rejection into a 502 without leaking the provider body", async () => {
    const log = vi.spyOn(console, "error").mockImplementation(() => {});
    vi.stubGlobal(
      "fetch",
      async () => new Response(JSON.stringify({ code: "unauthorized", message: "Key not found" }), { status: 401 }),
    );
    useEnv({ BREVO_API_KEY: "bad", OTP_FROM_EMAIL: "store@gmail.com" });

    await expect(sendPasswordResetEmail("customer@example.com", "123456")).rejects.toMatchObject({
      status: 502,
      code: "email_error",
    });
    expect(log).toHaveBeenCalled();
    log.mockRestore();
  });
});
