import { describe, expect, it } from "vitest";
import {
  DEFAULT_REFUND_APPROVAL_THRESHOLD_PAISE,
  checkRefundApproval,
  refundApprovalThreshold,
  refundRequiresApproval,
} from "./refunds";

describe("refund approval threshold", () => {
  it("defaults to ₹5,000 when nothing is configured", () => {
    expect(refundApprovalThreshold({})).toBe(DEFAULT_REFUND_APPROVAL_THRESHOLD_PAISE);
    expect(DEFAULT_REFUND_APPROVAL_THRESHOLD_PAISE).toBe(500_000);
  });

  it("reads a valid override and ignores junk", () => {
    expect(refundApprovalThreshold({ REFUND_APPROVAL_THRESHOLD_PAISE: "250000" })).toBe(250_000);
    expect(refundApprovalThreshold({ REFUND_APPROVAL_THRESHOLD_PAISE: "abc" })).toBe(
      DEFAULT_REFUND_APPROVAL_THRESHOLD_PAISE,
    );
    expect(refundApprovalThreshold({ REFUND_APPROVAL_THRESHOLD_PAISE: "-10" })).toBe(
      DEFAULT_REFUND_APPROVAL_THRESHOLD_PAISE,
    );
  });

  it("holds refunds at or above the threshold, not below it", () => {
    expect(refundRequiresApproval(99_999, 100_000)).toBe(false);
    expect(refundRequiresApproval(100_000, 100_000)).toBe(true);
    expect(refundRequiresApproval(150_000, 100_000)).toBe(true);
  });

  it("treats a zero threshold as disabled", () => {
    expect(refundRequiresApproval(10_000_000, 0)).toBe(false);
  });
});

describe("checkRefundApproval", () => {
  const requested = { status: "requested", createdBy: "usr_admin" };

  it("allows a different admin to approve a pending refund", () => {
    expect(checkRefundApproval(requested, "usr_manager")).toEqual({ ok: true });
  });

  it("refuses self approval", () => {
    const result = checkRefundApproval(requested, "usr_admin");
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.code).toBe("self_approval");
  });

  it("refuses a refund that is not pending, so it cannot execute twice", () => {
    for (const status of ["processing", "completed", "failed"]) {
      const result = checkRefundApproval({ status, createdBy: "usr_admin" }, "usr_manager");
      expect(result.ok).toBe(false);
      if (!result.ok) expect(result.code).toBe("not_pending");
    }
  });
});
