/**
 * Refund approval policy.
 *
 * Refunds at or above the threshold are created with status `requested` and only
 * move money when a *different* admin approves them. Below the threshold the
 * single-admin flow is unchanged, which keeps small refunds operationally cheap.
 */

export const DEFAULT_REFUND_APPROVAL_THRESHOLD_PAISE = 500_000; // ₹5,000

export type RefundStatus = "requested" | "processing" | "completed" | "failed";

export const REFUND_STATUS_LABELS: Record<RefundStatus, string> = {
  requested: "Awaiting approval",
  processing: "Processing",
  completed: "Completed",
  failed: "Failed",
};

/** Reads the threshold from env, falling back to the documented default. */
export function refundApprovalThreshold(
  env: Record<string, string | undefined>,
  fallback = DEFAULT_REFUND_APPROVAL_THRESHOLD_PAISE,
): number {
  const raw = (process.env.REFUND_APPROVAL_THRESHOLD_PAISE ?? env.REFUND_APPROVAL_THRESHOLD_PAISE ?? "").trim();
  if (!raw) return fallback;
  const parsed = Number.parseInt(raw, 10);
  if (!Number.isFinite(parsed) || parsed < 0) return fallback;
  return parsed;
}

export function refundRequiresApproval(amount: number, thresholdPaise: number): boolean {
  return thresholdPaise > 0 && amount >= thresholdPaise;
}

export type RefundApprovalCheck =
  | { ok: true }
  | { ok: false; code: "not_pending" | "self_approval"; message: string };

/**
 * Guards the approve step. Status alone is not enough: the approver must not be
 * the admin who requested the refund, otherwise the threshold is decorative.
 */
export function checkRefundApproval(
  refund: { status: string; createdBy: string | null },
  approverId: string,
): RefundApprovalCheck {
  if (refund.status !== "requested") {
    return {
      ok: false,
      code: "not_pending",
      message: "This refund is not awaiting approval. It may already have been processed.",
    };
  }
  if (refund.createdBy && refund.createdBy === approverId) {
    return {
      ok: false,
      code: "self_approval",
      message: "A refund at or above the approval threshold must be approved by a different admin.",
    };
  }
  return { ok: true };
}
