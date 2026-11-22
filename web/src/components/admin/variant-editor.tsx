"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { api, errorMessage } from "@/lib/client/api";
import { formatMoney } from "@/lib/money";
import type { AdminVariant } from "@/lib/services/admin";

export function VariantEditor({ variants, productId }: { variants: AdminVariant[]; productId: string }) {
  const router = useRouter();
  const [draft, setDraft] = useState<Record<string, { price: string; stock: string; threshold: string }>>(
    Object.fromEntries(
      variants.map((variant) => [
        variant.id,
        {
          price: (variant.price / 100).toFixed(2),
          stock: String(variant.stock),
          threshold: String(variant.lowStockThreshold),
        },
      ]),
    ),
  );
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState<string | null>(null);

  async function save(variant: AdminVariant) {
    setBusy(variant.id);
    setError(null);
    setSaved(null);
    try {
      const values = draft[variant.id]!;
      await api(`/api/v1/admin/variants/${variant.id}`, {
        method: "PATCH",
        body: {
          price: Math.round(Number(values.price) * 100),
          stock: Number(values.stock),
          lowStockThreshold: Number(values.threshold),
        },
      });
      setSaved(variant.id);
      router.refresh();
    } catch (issue) {
      setError(errorMessage(issue));
    } finally {
      setBusy(null);
    }
  }

  async function addVariant(values: { name: string; sku: string; price: string; stock: string }) {
    setBusy("new");
    setError(null);
    try {
      await api(`/api/v1/admin/products/${productId}/variants`, {
        method: "POST",
        body: {
          name: values.name,
          sku: values.sku.toUpperCase(),
          price: Math.round(Number(values.price) * 100),
          stock: Number(values.stock || 0),
        },
      });
      router.refresh();
    } catch (issue) {
      setError(errorMessage(issue));
    } finally {
      setBusy(null);
    }
  }

  return (
    <div className="space-y-4">
      <div className="overflow-x-auto">
        <table className="w-full min-w-[36rem] border-collapse text-sm">
          <thead>
            <tr className="border-b border-line text-left text-xs uppercase tracking-wider text-ink-soft">
              <th scope="col" className="py-2 font-medium">Variant</th>
              <th scope="col" className="py-2 font-medium">SKU</th>
              <th scope="col" className="py-2 font-medium">Price (₹)</th>
              <th scope="col" className="py-2 font-medium">Stock</th>
              <th scope="col" className="py-2 font-medium">Alert at</th>
              <th scope="col" className="py-2" />
            </tr>
          </thead>
          <tbody>
            {variants.map((variant) => {
              const values = draft[variant.id]!;
              return (
                <tr key={variant.id} className="border-b border-line/70">
                  <td className="py-2 pr-2">
                    {variant.name}
                    {!variant.isActive ? <span className="ml-2 text-xs text-ink-soft">inactive</span> : null}
                    <span className="block text-xs text-ink-soft">{formatMoney(variant.price)}</span>
                  </td>
                  <td className="py-2 pr-2 font-mono text-xs">{variant.sku}</td>
                  <td className="py-2 pr-2">
                    <input
                      aria-label={`Price for ${variant.sku}`}
                      value={values.price}
                      onChange={(event) =>
                        setDraft({ ...draft, [variant.id]: { ...values, price: event.target.value } })
                      }
                      inputMode="decimal"
                      className="w-24 border border-line px-2 py-1"
                    />
                  </td>
                  <td className="py-2 pr-2">
                    <input
                      aria-label={`Stock for ${variant.sku}`}
                      value={values.stock}
                      onChange={(event) =>
                        setDraft({ ...draft, [variant.id]: { ...values, stock: event.target.value } })
                      }
                      inputMode="numeric"
                      className={`w-20 border px-2 py-1 ${
                        Number(values.stock) <= Number(values.threshold) ? "border-clay text-clay-dark" : "border-line"
                      }`}
                    />
                  </td>
                  <td className="py-2 pr-2">
                    <input
                      aria-label={`Low stock threshold for ${variant.sku}`}
                      value={values.threshold}
                      onChange={(event) =>
                        setDraft({ ...draft, [variant.id]: { ...values, threshold: event.target.value } })
                      }
                      inputMode="numeric"
                      className="w-20 border border-line px-2 py-1"
                    />
                  </td>
                  <td className="py-2 text-right">
                    <button
                      type="button"
                      onClick={() => save(variant)}
                      disabled={busy === variant.id}
                      className="border border-ink px-3 py-1 text-xs uppercase tracking-wider disabled:opacity-50"
                    >
                      {busy === variant.id ? "…" : saved === variant.id ? "Saved" : "Save"}
                    </button>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {error ? <p role="alert" className="text-sm text-clay-dark">{error}</p> : null}
      <AddVariantForm onSubmit={addVariant} busy={busy === "new"} />
    </div>
  );
}

function AddVariantForm({
  onSubmit,
  busy,
}: {
  onSubmit: (values: { name: string; sku: string; price: string; stock: string }) => void;
  busy: boolean;
}) {
  const [values, setValues] = useState({ name: "", sku: "", price: "", stock: "0" });

  return (
    <form
      className="border border-line p-4"
      onSubmit={(event) => {
        event.preventDefault();
        onSubmit(values);
        setValues({ name: "", sku: "", price: "", stock: "0" });
      }}
    >
      <p className="eyebrow">Add a variant to this product</p>
      <div className="mt-2 grid gap-2 sm:grid-cols-4">
        <input
          name="name"
          placeholder="300 g / 60 hr"
          required
          value={values.name}
          onChange={(event) => setValues({ ...values, name: event.target.value })}
          className="border border-line px-2 py-1.5 text-sm"
        />
        <input
          name="sku"
          placeholder="SKU-300"
          required
          value={values.sku}
          onChange={(event) => setValues({ ...values, sku: event.target.value })}
          className="border border-line px-2 py-1.5 text-sm"
        />
        <input
          name="price"
          placeholder="Price ₹"
          required
          inputMode="decimal"
          value={values.price}
          onChange={(event) => setValues({ ...values, price: event.target.value })}
          className="border border-line px-2 py-1.5 text-sm"
        />
        <input
          name="stock"
          placeholder="Stock"
          inputMode="numeric"
          value={values.stock}
          onChange={(event) => setValues({ ...values, stock: event.target.value })}
          className="border border-line px-2 py-1.5 text-sm"
        />
      </div>
      <button
        type="submit"
        disabled={busy}
        className="mt-2 bg-ink px-4 py-1.5 text-xs uppercase tracking-wider text-ivory disabled:opacity-50"
      >
        {busy ? "Adding…" : "Add variant"}
      </button>
    </form>
  );
}
