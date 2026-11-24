import { describe, expect, it } from "vitest";
import { senderAddressIssue } from "./services/email";

describe("senderAddressIssue", () => {
  it("accepts an address on the store's own domain", () => {
    expect(senderAddressIssue("no-reply@emberandwick.com")).toBeNull();
    expect(senderAddressIssue("  orders@shop.emberandwick.com  ")).toBeNull();
  });

  it("rejects personal mailboxes so mail never comes from a private inbox", () => {
    for (const address of [
      "applepandu.1love@gmail.com",
      "someone@yahoo.co.in",
      "studio@outlook.com",
      "shop@hotmail.com",
      "hello@icloud.com",
      "admin@rediffmail.com",
    ]) {
      const issue = senderAddressIssue(address);
      expect(issue, address).toContain("personal mailbox");
    }
  });

  it("matches the domain case-insensitively", () => {
    expect(senderAddressIssue("Shop@GMAIL.com")).toContain("personal mailbox");
  });

  it("rejects malformed addresses", () => {
    expect(senderAddressIssue("no-reply")).toContain("not a valid email address");
    expect(senderAddressIssue("no-reply@localhost")).toContain("not a valid email address");
    expect(senderAddressIssue("")).toContain("not a valid email address");
  });
});
