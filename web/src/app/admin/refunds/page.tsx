import type { Metadata } from "next";
import { allRows } from "@/lib/db";
import { formatMoney } from "@/lib/money";
import { RefundForm } from "@/components/admin/refund-form";
import { getPaymentConfig } from "@/lib/config";

export const metadata: Metadata = { title: "Refunds", robots: { index: false, follow: false } };

export default async function AdminRefundsPage() {
  const [refunds, paymentConfig] = await Promise.all([
    allRows<{
      id: string;
      amount: number;
      reason: string;
      status: string;
      provider_refund_id: string | null;
      created_at: string;
      processed_at: string | null;
      order_number: string;
      email: string;
    }>(
      `SELECT r.id, r.amount, r.reason, r.status, r.provider_refund_id, r.created_at, r.processed_at,
              o.number AS order_number, o.email
         FROM refunds r JOIN orders o ON o.id = r.order_id
        ORDER BY r.created_at DESC LIMIT 100`,
    ),
    getPaymentConfig(),
  ]);

  return (
    <div>
      <h1 className="text-2xl">Refunds</h1>
      <p className="mt-1 text-sm text-ink-soft">
        Refunds are issued against the captured payment. In test mode they complete instantly and are clearly
        labelled.
      </p>

      {paymentConfig.mode === "unconfigured" ? (
        <p className="mt-4 border border-clay/40 bg-clay/5 px-4 py-3 text-sm text-clay-dark">
          Payments are not configured, so refunds cannot be processed from this dashboard.
        </p>
      ) : null}

      <div className="mt-6 grid gap-8 lg:grid-cols-[1fr_20rem]">
        <div>
          {refunds.length === 0 ? (
            <p className="border border-line bg-sand/30 p-6 text-sm text-ink-soft">No refunds issued yet.</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full min-w-[32rem] border-collapse text-sm">
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
