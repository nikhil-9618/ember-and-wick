import type { Metadata } from "next";
import { listAuditEntries } from "@/lib/services/audit";

export const metadata: Metadata = { title: "Audit log", robots: { index: false, follow: false } };

export default async function AdminAuditPage() {
  const entries = await listAuditEntries({ limit: 200 });

  return (
    <div>
      <h1 className="text-2xl">Audit log</h1>
      <p className="mt-1 text-sm text-ink-soft">
        Every privileged change — order status, refunds, prices, stock, coupons and review moderation — is recorded
        here with the admin who made it. Entries are append-only.
      </p>

      {entries.length === 0 ? (
        <p className="mt-6 border border-line bg-sand/30 p-6 text-sm text-ink-soft">No admin changes recorded yet.</p>
      ) : (
        <div className="mt-6 overflow-x-auto">
          <table className="w-full min-w-[42rem] border-collapse text-sm">
            <thead>
              <tr className="border-b border-line text-left text-xs uppercase tracking-wider text-ink-soft">
                <th scope="col" className="py-2 font-medium">When</th>
                <th scope="col" className="py-2 font-medium">Admin</th>
                <th scope="col" className="py-2 font-medium">Action</th>
                <th scope="col" className="py-2 font-medium">Detail</th>
              </tr>
            </thead>
            <tbody>
              {entries.map((entry) => (
                <tr key={entry.id} className="border-b border-line/70 align-top">
                  <td className="py-2 whitespace-nowrap text-ink-soft">
                    {new Date(entry.createdAt).toLocaleString("en-IN", { dateStyle: "medium", timeStyle: "short" })}
                  </td>
                  <td className="py-2">{entry.actorEmail}</td>
                  <td className="py-2 font-mono text-xs">{entry.action}</td>
                  <td className="py-2">
                    {entry.summary}
                    <span className="block text-xs text-ink-soft">
                      {entry.entityType}
                      {entry.entityId ? ` · ${entry.entityId}` : ""}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
