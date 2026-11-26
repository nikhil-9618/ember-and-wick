import { describe, expect, it } from "vitest";
import { senderAddressIssue } from "./services/email";

describe("senderAddressIssue", () => {
  it("accepts an address on a domain the store owns", () => {
    expect(senderAddressIssue("no-reply@emberandwick.com")).toBeNull();
    expect(senderAddressIssue("  orders@shop.emberandwick.com  ")).toBeNull();
  });

  it("accepts a verified mailbox sender, which Brevo sends from its own authenticated domain", () => {
    for (const address of [
      "applepandu.1love@gmail.com",
      "someone@yahoo.co.in",
      "studio@outlook.com",
      "shop@hotmail.com",
      "hello@icloud.com",
      "admin@rediffmail.com",
    ]) {
      expect(senderAddressIssue(address), address).toBeNull();
    }
  });

  it("accepts mailbox domains case-insensitively", () => {
    expect(senderAddressIssue("Shop@GMAIL.com")).toBeNull();
  });

  it("rejects malformed addresses", () => {
    expect(senderAddressIssue("no-reply")).toContain("not a valid email address");
    expect(senderAddressIssue("no-reply@localhost")).toContain("not a valid email address");
    expect(senderAddressIssue("")).toContain("not a valid email address");
  });
});
