"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { api, errorMessage } from "@/lib/client/api";
import { formatMoney } from "@/lib/money";

interface Coupon {
  id: string;
  code: string;
  description: string | null;
  type: "percent" | "fixed";
  value: number;
  minSubtotal: number;
  maxDiscount: number | null;
  usageLimit: number | null;
  usedCount: number;
  startsAt: string | null;
  endsAt: string | null;
  isActive: boolean;
}

export function CouponManager({ initial }: { initial: Coupon[] }) {
  const router = useRouter();
  const [coupons, setCoupons] = useState(initial);
  const [form, setForm] = useState({ code: "", type: "percent", value: "", minSubtotal: "", usageLimit: "" });
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function create(event: React.FormEvent) {
    event.preventDefault();
    setBusy(true);
    setError(null);
    try {
      await api("/api/v1/admin/coupons", {
        method: "POST",
        body: {
          code: form.code,
          type: form.type,
          value:
            form.type === "percent" ? Number(form.value) : Math.round(Number(form.value) * 100),
          minSubtotal: form.minSubtotal ? Math.round(Number(form.minSubtotal) * 100) : 0,
          usageLimit: form.usageLimit ? Number(form.usageLimit) : null,
        },
      });
      setForm({ code: "", type: "percent", value: "", minSubtotal: "", usageLimit: "" });
      router.refresh();
    } catch (issue) {
      setError(errorMessage(issue));
    } finally {
      setBusy(false);
    }
  }

  async function toggle(coupon: Coupon) {
    setBusy(true);
    setError(null);
    try {
      await api(`/api/v1/admin/coupons/${coupon.id}`, { method: "PATCH", body: { isActive: !coupon.isActive } });
      setCoupons(coupons.map((item) => (item.id === coupon.id ? { ...item, isActive: !item.isActive } : item)));
      router.refresh();
    } catch (issue) {
      setError(errorMessage(issue));
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="mt-6 space-y-8">
      <form onSubmit={create} className="grid gap-3 border border-line p-4 sm:grid-cols-6">
        <label className="block sm:col-span-2">
          <span className="eyebrow">Code</span>
          <input
            required
            value={form.code}
            onChange={(event) => setForm({ ...form, code: event.target.value.toUpperCase() })}
            placeholder="WELCOME10"
            className="mt-1 w-full border border-line bg-ivory px-2 py-1.5 text-sm uppercase"
          />
        </label>
        <label className="block">
          <span className="eyebrow">Type</span>
          <select
            value={form.type}
            onChange={(event) => setForm({ ...form, type: event.target.value })}
            className="mt-1 w-full border border-line bg-ivory px-2 py-1.5 text-sm"
          >
            <option value="percent">Percent</option>
            <option value="fixed">Fixed ₹</option>
          </select>
        </label>
        <label className="block">
          <span className="eyebrow">{form.type === "percent" ? "Percent off" : "Rupees off"}</span>
          <input
            required
            inputMode="decimal"
            value={form.value}
            onChange={(event) => setForm({ ...form, value: event.target.value })}
            className="mt-1 w-full border border-line bg-ivory px-2 py-1.5 text-sm"
          />
        </label>
        <label className="block">
          <span className="eyebrow">Min order ₹</span>
          <input
            inputMode="decimal"
            value={form.minSubtotal}
            onChange={(event) => setForm({ ...form, minSubtotal: event.target.value })}
            className="mt-1 w-full border border-line bg-ivory px-2 py-1.5 text-sm"
          />
        </label>
        <label className="block">
          <span className="eyebrow">Usage limit</span>
          <input
            inputMode="numeric"
            value={form.usageLimit}
            onChange={(event) => setForm({ ...form, usageLimit: event.target.value })}
            placeholder="Unlimited"
            className="mt-1 w-full border border-line bg-ivory px-2 py-1.5 text-sm"
          />
        </label>
        <div className="sm:col-span-6">
          {error ? <p role="alert" className="mb-2 text-sm text-clay-dark">{error}</p> : null}
          <button
            type="submit"
            disabled={busy}
            className="bg-ink px-4 py-2 text-sm text-ivory hover:bg-clay-dark disabled:opacity-50"
          >
            {busy ? "Saving…" : "Create coupon"}
          </button>
        </div>
      </form>

      {coupons.length === 0 ? (
        <p className="border border-line bg-sand/30 p-6 text-sm text-ink-soft">No coupons yet.</p>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full min-w-[36rem] border-collapse text-sm">
            <thead>
              <tr className="border-b border-line text-left text-xs uppercase tracking-wider text-ink-soft">
                <th scope="col" className="py-2 font-medium">Code</th>
                <th scope="col" className="py-2 font-medium">Discount</th>
                <th scope="col" className="py-2 font-medium">Min order</th>
                <th scope="col" className="py-2 text-right font-medium">Used</th>
                <th scope="col" className="py-2 text-right font-medium">Status</th>
                <th scope="col" className="py-2" />
              </tr>
            </thead>
            <tbody>
              {coupons.map((coupon) => (
                <tr key={coupon.id} className="border-b border-line/70">
                  <td className="py-2 font-mono text-xs">{coupon.code}</td>
                  <td className="py-2">
                    {coupon.type === "percent" ? `${coupon.value}%` : formatMoney(coupon.value)}
                    {coupon.maxDiscount ? (
                      <span className="block text-xs text-ink-soft">max {formatMoney(coupon.maxDiscount)}</span>
                    ) : null}
                  </td>
                  <td className="py-2 text-ink-soft">{formatMoney(coupon.minSubtotal)}</td>
                  <td className="py-2 text-right">
                    {coupon.usedCount}
                    {coupon.usageLimit ? ` / ${coupon.usageLimit}` : ""}
                  </td>
                  <td className="py-2 text-right">
                    <span className={coupon.isActive ? "text-sage" : "text-ink-soft"}>
                      {coupon.isActive ? "Active" : "Paused"}
                    </span>
                  </td>
                  <td className="py-2 text-right">
                    <button
                      type="button"
                      onClick={() => toggle(coupon)}
                      disabled={busy}
                      className="border border-line px-3 py-1 text-xs uppercase tracking-wider disabled:opacity-50"
                    >
                      {coupon.isActive ? "Pause" : "Activate"}
                    </button>
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
