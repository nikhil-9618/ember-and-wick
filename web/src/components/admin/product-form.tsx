"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { api, errorMessage } from "@/lib/client/api";
import type { AdminProduct } from "@/lib/services/admin";

interface Category {
  id: string;
  name: string;
}

interface VariantDraft {
  name: string;
  sku: string;
  price: string;
  stock: string;
  weightGrams: string;
}

interface Props {
  categories: Category[];
  initial?: AdminProduct;
}

export function ProductForm({ categories, initial }: Props) {
  const router = useRouter();
  const [form, setForm] = useState({
    name: initial?.name ?? "",
    slug: initial?.slug ?? "",
    tagline: initial?.tagline ?? "",
    description: initial?.description ?? "",
    categoryId: initial?.categoryId ?? "",
    waxType: initial?.waxType ?? "",
    wickType: initial?.wickType ?? "",
    burnTimeHours: initial?.burnTimeHours ? String(initial.burnTimeHours) : "",
    scentNotes: initial?.scentNotes ?? "",
    basePrice: initial ? (initial.basePrice / 100).toFixed(2) : "",
    compareAtPrice: initial?.compareAtPrice ? (initial.compareAtPrice / 100).toFixed(2) : "",
    status: initial?.status ?? "draft",
    isFeatured: initial?.isFeatured ?? false,
  });
  const [images, setImages] = useState<{ url: string; alt: string }[]>(
    initial?.images.length ? initial.images : [{ url: "", alt: "" }],
  );
  const [variants, setVariants] = useState<VariantDraft[]>([
    { name: "", sku: "", price: "", stock: "0", weightGrams: "" },
  ]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const isEdit = Boolean(initial);

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    setBusy(true);
    setError(null);
    try {
      const payload: Record<string, unknown> = {
        name: form.name,
        slug: form.slug,
        tagline: form.tagline || undefined,
        description: form.description,
        categoryId: form.categoryId || null,
        waxType: form.waxType || undefined,
        wickType: form.wickType || undefined,
        burnTimeHours: form.burnTimeHours ? Number(form.burnTimeHours) : undefined,
        scentNotes: form.scentNotes || undefined,
        basePrice: Math.round(Number(form.basePrice) * 100),
        compareAtPrice: form.compareAtPrice ? Math.round(Number(form.compareAtPrice) * 100) : null,
        status: form.status,
        isFeatured: form.isFeatured,
        images: images.filter((image) => image.url.trim()).map((image) => ({ url: image.url, alt: image.alt || form.name })),
      };

      if (!isEdit) {
        payload.variants = variants.map((variant) => ({
          name: variant.name,
          sku: variant.sku.toUpperCase(),
          price: Math.round(Number(variant.price) * 100),
          stock: Number(variant.stock || 0),
          weightGrams: variant.weightGrams ? Number(variant.weightGrams) : undefined,
        }));
      }

      if (isEdit && initial) {
        await api(`/api/v1/admin/products/${initial.id}`, { method: "PATCH", body: payload });
        router.push("/admin/products");
        router.refresh();
      } else {
        const created = await api<{ id: string }>("/api/v1/admin/products", { method: "POST", body: payload });
        router.push(`/admin/products/${created.id}`);
        router.refresh();
      }
    } catch (issue) {
      setError(errorMessage(issue));
      setBusy(false);
    }
  }

  function slugify(value: string) {
    return value
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "");
  }

  const text = (key: keyof typeof form, label: string, props: Record<string, unknown> = {}) => (
    <label className="block">
      <span className="eyebrow">{label}</span>
      <input
        value={String(form[key])}
        onChange={(event) => setForm({ ...form, [key]: event.target.value })}
        className="mt-1 w-full border border-line bg-ivory px-3 py-2 text-sm"
        {...props}
      />
    </label>
  );

  return (
    <form onSubmit={submit} className="space-y-8">
      <section className="grid gap-4 sm:grid-cols-2">
        {text("name", "Name", {
          required: true,
          onBlur: () => {
            if (!form.slug) setForm((current) => ({ ...current, slug: slugify(current.name) }));
          },
        })}
        {text("slug", "URL slug", { required: true, pattern: "[a-z0-9]+(-[a-z0-9]+)*" })}
        <div className="sm:col-span-2">{text("tagline", "Tagline")}</div>
        <label className="block sm:col-span-2">
          <span className="eyebrow">Description</span>
          <textarea
            required
            minLength={20}
            rows={6}
            value={form.description}
            onChange={(event) => setForm({ ...form, description: event.target.value })}
            className="mt-1 w-full border border-line bg-ivory px-3 py-2 text-sm"
          />
        </label>
        <label className="block">
          <span className="eyebrow">Category</span>
          <select
            value={form.categoryId}
            onChange={(event) => setForm({ ...form, categoryId: event.target.value })}
            className="mt-1 w-full border border-line bg-ivory px-3 py-2 text-sm"
          >
            <option value="">No category</option>
            {categories.map((category) => (
              <option key={category.id} value={category.id}>
                {category.name}
              </option>
            ))}
          </select>
        </label>
        <label className="block">
          <span className="eyebrow">Status</span>
          <select
            value={form.status}
            onChange={(event) => setForm({ ...form, status: event.target.value })}
            className="mt-1 w-full border border-line bg-ivory px-3 py-2 text-sm"
          >
            <option value="draft">Draft</option>
            <option value="active">Active</option>
            <option value="archived">Archived</option>
          </select>
        </label>
        {text("waxType", "Wax")}
        {text("wickType", "Wick")}
        {text("burnTimeHours", "Burn time (hours)", { inputMode: "numeric" })}
        {text("scentNotes", "Scent notes")}
        {text("basePrice", "Base price (₹)", { required: true, inputMode: "decimal" })}
        {text("compareAtPrice", "Compare-at price (₹)")}
        <label className="flex items-center gap-2 sm:col-span-2">
          <input
            type="checkbox"
            checked={form.isFeatured}
            onChange={(event) => setForm({ ...form, isFeatured: event.target.checked })}
          />
          <span className="text-sm">Feature on the homepage</span>
        </label>
      </section>

      <section>
        <h2 className="text-lg">Images</h2>
        <p className="text-xs text-ink-soft">Use paths served by the site (e.g. /images/products/cedar.jpg) or absolute URLs.</p>
        <div className="mt-3 space-y-2">
          {images.map((image, index) => (
            <div key={index} className="grid gap-2 sm:grid-cols-[2fr_2fr_auto]">
              <input
                value={image.url}
                onChange={(event) => {
                  const next = [...images];
                  next[index] = { ...image, url: event.target.value };
                  setImages(next);
                }}
                placeholder="/images/products/cedar.jpg"
                aria-label={`Image ${index + 1} URL`}
                className="border border-line px-2 py-1.5 text-sm"
              />
              <input
                value={image.alt}
                onChange={(event) => {
                  const next = [...images];
                  next[index] = { ...image, alt: event.target.value };
                  setImages(next);
                }}
                placeholder="Alt text"
                aria-label={`Image ${index + 1} alt text`}
                className="border border-line px-2 py-1.5 text-sm"
              />
              <button
                type="button"
                onClick={() => setImages(images.filter((_, position) => position !== index))}
                className="border border-line px-3 text-xs"
              >
                Remove
              </button>
            </div>
          ))}
        </div>
        <button
          type="button"
          onClick={() => setImages([...images, { url: "", alt: "" }])}
          className="mt-2 text-xs underline underline-offset-4"
        >
          Add image
        </button>
      </section>

      {!isEdit ? (
        <section>
          <h2 className="text-lg">Variants</h2>
          <p className="text-xs text-ink-soft">At least one variant is required. Prices are in rupees.</p>
          <div className="mt-3 space-y-2">
            {variants.map((variant, index) => (
              <div key={index} className="grid gap-2 sm:grid-cols-5">
                <input
                  value={variant.name}
                  onChange={(event) => {
                    const next = [...variants];
                    next[index] = { ...variant, name: event.target.value };
                    setVariants(next);
                  }}
                  placeholder="200 g / 45 hr"
                  aria-label={`Variant ${index + 1} name`}
                  className="border border-line px-2 py-1.5 text-sm"
                />
                <input
                  value={variant.sku}
                  onChange={(event) => {
                    const next = [...variants];
                    next[index] = { ...variant, sku: event.target.value };
                    setVariants(next);
                  }}
                  placeholder="SKU-200"
                  aria-label={`Variant ${index + 1} SKU`}
                  className="border border-line px-2 py-1.5 text-sm"
                />
                <input
                  value={variant.price}
                  onChange={(event) => {
                    const next = [...variants];
                    next[index] = { ...variant, price: event.target.value };
                    setVariants(next);
                  }}
                  placeholder="Price ₹"
                  aria-label={`Variant ${index + 1} price`}
                  inputMode="decimal"
                  className="border border-line px-2 py-1.5 text-sm"
                />
                <input
                  value={variant.stock}
                  onChange={(event) => {
                    const next = [...variants];
                    next[index] = { ...variant, stock: event.target.value };
                    setVariants(next);
                  }}
                  placeholder="Stock"
                  aria-label={`Variant ${index + 1} stock`}
                  inputMode="numeric"
                  className="border border-line px-2 py-1.5 text-sm"
                />
                <input
                  value={variant.weightGrams}
                  onChange={(event) => {
                    const next = [...variants];
                    next[index] = { ...variant, weightGrams: event.target.value };
                    setVariants(next);
                  }}
                  placeholder="Weight g"
                  aria-label={`Variant ${index + 1} weight`}
                  inputMode="numeric"
                  className="border border-line px-2 py-1.5 text-sm"
                />
              </div>
            ))}
          </div>
          <button
            type="button"
            onClick={() =>
              setVariants([...variants, { name: "", sku: "", price: "", stock: "0", weightGrams: "" }])
            }
            className="mt-2 text-xs underline underline-offset-4"
          >
            Add variant
          </button>
        </section>
      ) : null}

      {error ? (
        <p role="alert" className="border border-clay/40 bg-clay/5 px-3 py-2 text-sm text-clay-dark">
          {error}
        </p>
      ) : null}

      <button
        type="submit"
        disabled={busy}
        className="bg-ink px-6 py-2.5 text-sm text-ivory hover:bg-clay-dark disabled:opacity-50"
      >
        {busy ? "Saving…" : isEdit ? "Save product" : "Create product"}
      </button>
    </form>
  );
}
