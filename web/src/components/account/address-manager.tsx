"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { api, errorMessage } from "@/lib/client/api";

export interface Address {
  id: string;
  label: string | null;
  fullName: string;
  phone: string;
  line1: string;
  line2: string | null;
  city: string;
  state: string;
  postalCode: string;
  country: string;
  isDefault: boolean;
}

const EMPTY = {
  label: "",
  fullName: "",
  phone: "",
  line1: "",
  line2: "",
  city: "",
  state: "",
  postalCode: "",
  country: "IN",
};

export function AddressManager({ initial }: { initial: Address[] }) {
  const router = useRouter();
  const [addresses, setAddresses] = useState(initial);
  const [editing, setEditing] = useState<string | null>(null);
  const [draft, setDraft] = useState({ ...EMPTY });
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function startNew() {
    setEditing("new");
    setDraft({ ...EMPTY });
    setError(null);
  }

  function startEdit(address: Address) {
    setEditing(address.id);
    setDraft({
      label: address.label ?? "",
      fullName: address.fullName,
      phone: address.phone,
      line1: address.line1,
      line2: address.line2 ?? "",
      city: address.city,
      state: address.state,
      postalCode: address.postalCode,
      country: address.country || "IN",
    });
    setError(null);
  }

  async function save(event: React.FormEvent) {
    event.preventDefault();
    setBusy(true);
    setError(null);
    try {
      const body = {
        ...draft,
        line2: draft.line2 || undefined,
        label: draft.label || undefined,
        country: "IN",
      };
      const path = editing === "new" ? "/api/v1/addresses" : `/api/v1/addresses/${editing}`;
      const result = await api<{ addresses: Address[] }>(path, {
        method: editing === "new" ? "POST" : "PATCH",
        body,
      });
      setAddresses(result.addresses);
      setEditing(null);
      router.refresh();
    } catch (issue) {
      setError(errorMessage(issue));
    } finally {
      setBusy(false);
    }
  }

  async function remove(id: string) {
    setBusy(true);
    setError(null);
    try {
      const result = await api<{ addresses: Address[] }>(`/api/v1/addresses/${id}`, { method: "DELETE" });
      setAddresses(result.addresses);
      if (editing === id) setEditing(null);
      router.refresh();
    } catch (issue) {
      setError(errorMessage(issue));
    } finally {
      setBusy(false);
    }
  }

  async function makeDefault(id: string) {
    setBusy(true);
    setError(null);
    try {
      const result = await api<{ addresses: Address[] }>("/api/v1/addresses", {
        method: "PATCH",
        body: { addressId: id },
      });
      setAddresses(result.addresses);
    } catch (issue) {
      setError(errorMessage(issue));
    } finally {
      setBusy(false);
    }
  }

  const input = (key: keyof typeof EMPTY, label: string, extra: Record<string, unknown> = {}) => (
    <label className="block">
      <span className="eyebrow">{label}</span>
      <input
        value={draft[key]}
        onChange={(event) => setDraft({ ...draft, [key]: event.target.value })}
        className="mt-1 w-full border border-line bg-ivory px-3 py-2.5 text-sm"
        {...extra}
      />
    </label>
  );

  return (
    <div className="space-y-6">
      {addresses.length === 0 && editing === null ? (
        <p className="border border-line bg-sand/30 p-5 text-sm text-ink-soft">No saved addresses yet.</p>
      ) : (
        <ul className="grid gap-4 sm:grid-cols-2">
          {addresses.map((address) => (
            <li key={address.id} className="border border-line p-5 text-sm">
              <p className="font-medium">
                {address.fullName}
                {address.isDefault ? <span className="ml-2 text-xs text-sage">Default</span> : null}
              </p>
              <p className="mt-1 text-ink-soft">
                {address.line1}
                {address.line2 ? `, ${address.line2}` : ""}
                <br />
                {address.city}, {address.state} {address.postalCode}
              </p>
              <p className="mt-1 text-xs text-ink-soft">{address.phone}</p>
              <div className="mt-3 flex flex-wrap gap-3 text-xs">
                <button type="button" onClick={() => startEdit(address)} className="underline underline-offset-4">
                  Edit
                </button>
                {!address.isDefault ? (
                  <button type="button" onClick={() => makeDefault(address.id)} className="underline underline-offset-4">
                    Make default
                  </button>
                ) : null}
                <button
                  type="button"
                  onClick={() => remove(address.id)}
                  className="text-clay-dark underline underline-offset-4"
                >
                  Delete
                </button>
              </div>
            </li>
          ))}
        </ul>
      )}

      {editing === null ? (
        <button type="button" onClick={startNew} className="bg-ink px-5 py-2.5 text-sm text-ivory hover:bg-clay-dark">
          Add address
        </button>
      ) : (
        <form onSubmit={save} className="max-w-xl space-y-4 border border-line p-5">
          <h3 className="text-lg">{editing === "new" ? "New address" : "Edit address"}</h3>
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="sm:col-span-2">{input("fullName", "Full name", { required: true, autoComplete: "name" })}</div>
            {input("phone", "Phone", { required: true, type: "tel", autoComplete: "tel" })}
            {input("postalCode", "PIN code", { required: true, inputMode: "numeric", pattern: "[1-9][0-9]{5}", autoComplete: "postal-code" })}
            <div className="sm:col-span-2">{input("line1", "Address line 1", { required: true, autoComplete: "address-line1" })}</div>
            <div className="sm:col-span-2">{input("line2", "Address line 2 (optional)", { autoComplete: "address-line2" })}</div>
            {input("city", "City", { required: true, autoComplete: "address-level2" })}
            {input("state", "State", { required: true, autoComplete: "address-level1" })}
            <div className="sm:col-span-2">{input("label", "Label (optional, e.g. Home)")}</div>
          </div>
          {error ? <p role="alert" className="text-sm text-clay-dark">{error}</p> : null}
          <div className="flex gap-3">
            <button type="submit" disabled={busy} className="bg-ink px-5 py-2.5 text-sm text-ivory disabled:opacity-50">
              {busy ? "Saving…" : "Save address"}
            </button>
            <button type="button" onClick={() => setEditing(null)} className="border border-line px-5 py-2.5 text-sm">
              Cancel
            </button>
          </div>
        </form>
      )}

      {error && editing === null ? <p role="alert" className="text-sm text-clay-dark">{error}</p> : null}
    </div>
  );
}
