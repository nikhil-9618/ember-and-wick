import type { Metadata } from "next";
import { allRows } from "@/lib/db";
import { formatMoney } from "@/lib/money";
import { RefundForm } from "@/components/admin/refund-form";
import { RefundApproveButton } from "@/components/admin/refund-approve-button";
import { getPaymentConfig, getRefundPolicy } from "@/lib/config";
import { getCurrentUser } from "@/lib/auth";

export const metadata: Metadata = { title: "Refunds", robots: { index: false, follow: false } };

interface RefundListRow {
  id: string;
  amount: number;
  reason: string;
  status: string;
  provider_refund_id: string | null;
  created_at: string;
  processed_at: string | null;
  created_by: string | null;
  approved_by: string | null;
  requested_by_email: string | null;
  approved_by_email: string | null;
  order_number: string;
  email: string;
}

export default async function AdminRefundsPage() {
  const [refunds, paymentConfig, policy, currentUser] = await Promise.all([
    allRows<RefundListRow>(
      `SELECT r.id, r.amount, r.reason, r.status, r.provider_refund_id, r.created_at, r.processed_at,
              r.created_by, r.approved_by,
              o.number AS order_number, o.email,
              requester.email AS requested_by_email, approver.email AS approved_by_email
         FROM refunds r
         JOIN orders o ON o.id = r.order_id
         LEFT JOIN users requester ON requester.id = r.created_by
         LEFT JOIN users approver ON approver.id = r.approved_by
        ORDER BY r.created_at DESC LIMIT 100`,
    ),
    getPaymentConfig(),
    getRefundPolicy(),
    getCurrentUser(),
  ]);

  const pending = refunds.filter((refund) => refund.status === "requested");

  return (
    <div>
      <h1 className="text-2xl">Refunds</h1>
      <p className="mt-1 text-sm text-ink-soft">
        Refunds are issued against the captured payment. Refunds of {formatMoney(policy.approvalThresholdPaise)} or more
        need approval from a second admin before any money moves. In test mode they complete instantly and are clearly
        labelled.
      </p>

      {paymentConfig.mode === "unconfigured" ? (
        <p className="mt-4 border border-clay/40 bg-clay/5 px-4 py-3 text-sm text-clay-dark">
          Payments are not configured, so refunds cannot be processed from this dashboard.
        </p>
      ) : null}

      {pending.length > 0 ? (
        <section className="mt-6 border border-clay/40 bg-clay/5 p-4">
          <h2 className="text-lg">Awaiting approval</h2>
          <ul className="mt-3 divide-y divide-clay/20 text-sm">
            {pending.map((refund) => (
              <li key={refund.id} className="flex flex-wrap items-center justify-between gap-3 py-2">
                <div>
                  <p>
                    {refund.order_number} · {formatMoney(refund.amount)}
                  </p>
                  <p className="text-xs text-ink-soft">
                    {refund.reason} · requested by {refund.requested_by_email ?? "an admin"}
                  </p>
                </div>
                <RefundApproveButton
                  refundId={refund.id}
                  disabledReason={
                    currentUser && refund.created_by === currentUser.id
                      ? "Requested by you — another admin must approve."
                      : null
                  }
                />
              </li>
            ))}
          </ul>
        </section>
      ) : null}

      <div className="mt-6 grid gap-8 lg:grid-cols-[1fr_20rem]">
        <div>
          {refunds.length === 0 ? (
            <p className="border border-line bg-sand/30 p-6 text-sm text-ink-soft">No refunds issued yet.</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full min-w-[36rem] border-collapse text-sm">
                <thead>
                  <tr className="border-b border-line text-left text-xs uppercase tracking-wider text-ink-soft">
                    <th scope="col" className="py-2 font-medium">Order</th>
                    <th scope="col" className="py-2 font-medium">Reason</th>
                    <th scope="col" className="py-2 font-medium">Status</th>
                    <th scope="col" className="py-2 text-right font-medium">Amount</th>
                  </tr>
                </thead>
                <tbody>
                  {refunds.map((refund) => (
                    <tr key={refund.id} className="border-b border-line/70">
                      <td className="py-2">
                        {refund.order_number}
                        <span className="block text-xs text-ink-soft">{refund.email}</span>
                      </td>
                      <td className="py-2 text-ink-soft">{refund.reason}</td>
                      <td className="py-2">
                        {refund.status}
                        {refund.approved_by_email ? (
                          <span className="block text-xs text-ink-soft">approved by {refund.approved_by_email}</span>
                        ) : null}
                        {refund.provider_refund_id ? (
                          <span className="block font-mono text-[0.625rem] text-ink-soft">{refund.provider_refund_id}</span>
                        ) : null}
                      </td>
                      <td className="py-2 text-right">{formatMoney(refund.amount)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>

        <RefundForm mode={paymentConfig.mode} />
      </div>
    </div>
  );
}
