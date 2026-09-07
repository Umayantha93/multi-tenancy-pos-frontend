"use client";

import { FormEvent, useEffect, useState } from "react";
import { Plus, Trash2 } from "lucide-react";
import { AppShell } from "@/components/app-shell";
import { buttonClass, ErrorMessage, PageState, Panel, inputClass } from "@/components/ui";
import { api, money } from "@/lib/api";
import { useBusinessProfile } from "@/lib/use-business-profile";

type Supplier = {
  id: number;
  name: string;
  phone?: string | null;
  phone_secondary?: string | null;
  email?: string | null;
  address?: string | null;
  tin?: string | null;
  contact_person?: string | null;
  notes?: string | null;
  is_system?: boolean;
  active?: boolean;
};

type SupplierDetail = Supplier & {
  open_credit?: number;
  last_due_date?: string | null;
  purchase_count?: number;
  part_kind_count?: number;
  purchases?: Array<{
    id: number | string;
    receipt_number?: string | null;
    received_at?: string | null;
    payment_status?: string | null;
    amount?: number | string | null;
    items_label?: string | null;
  }>;
  parts_bought?: Array<{
    part_id: number;
    name: string;
    kind?: string | null;
    times_bought: number;
    total_qty: number;
    last_unit_cost?: number | string | null;
    last_buy_date?: string | null;
  }>;
  settlements?: Array<{
    id: number;
    description?: string | null;
    amount: number | string;
    settled_on?: string | null;
  }>;
};

function supplierPayload(form: HTMLFormElement) {
  const data = Object.fromEntries(new FormData(form));
  return {
    name: data.name,
    phone: data.phone || null,
    phone_secondary: data.phone_secondary || null,
    email: data.email || null,
    address: data.address || null,
    tin: data.tin || null,
    contact_person: data.contact_person || null,
    notes: data.notes || null,
  };
}

export default function SuppliersPage() {
  const isGarage = useBusinessProfile().type === "garage";
  const [rows, setRows] = useState<Supplier[]>([]);
  const [selectedId, setSelectedId] = useState<number | null>(null);
  const [detail, setDetail] = useState<SupplierDetail | null>(null);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  function load() {
    setLoading(true);
    api<{ data: Supplier[] }>("/suppliers?per_page=100")
      .then((result) => {
        setRows(result.data);
        if (isGarage && result.data.length && selectedId == null) {
          setSelectedId(result.data[0].id);
        }
      })
      .catch((caught) => setError(caught.message))
      .finally(() => setLoading(false));
  }

  useEffect(load, []);

  useEffect(() => {
    if (!isGarage || !selectedId) {
      setDetail(null);
      return;
    }
    api<SupplierDetail>(`/suppliers/${selectedId}`)
      .then(setDetail)
      .catch((caught) => setError(caught.message));
  }, [isGarage, selectedId]);

  async function create(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");
    const form = event.currentTarget;
    try {
      await api("/suppliers", { method: "POST", body: JSON.stringify(supplierPayload(form)) });
      form.reset();
      load();
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Unable to save supplier.");
    }
  }

  async function update(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!detail) return;
    setSaving(true);
    setError("");
    try {
      await api(`/suppliers/${detail.id}`, { method: "PUT", body: JSON.stringify(supplierPayload(event.currentTarget)) });
      load();
      const refreshed = await api<SupplierDetail>(`/suppliers/${detail.id}`);
      setDetail(refreshed);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Unable to update supplier.");
    } finally {
      setSaving(false);
    }
  }

  async function remove(id: number) {
    setError("");
    try {
      await api(`/suppliers/${id}`, { method: "DELETE" });
      if (selectedId === id) setSelectedId(null);
      load();
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Unable to delete supplier.");
    }
  }

  if (!isGarage) {
    return (
      <AppShell title="Suppliers" eyebrow="Optional on restock — leave blank to keep the current purchase path">
        <div className="grid gap-5 xl:grid-cols-[0.85fr_1.15fr]">
          <Panel className="p-5">
            <h2 className="font-display text-2xl font-semibold uppercase">Add supplier</h2>
            <form onSubmit={create} className="mt-4 grid gap-3">
              <input name="name" required placeholder="Supplier name" className={inputClass} />
              <input name="phone" placeholder="Phone" className={inputClass} />
              <input name="notes" placeholder="Notes" className={inputClass} />
              <button className={buttonClass}><Plus size={16} /> Save supplier</button>
            </form>
          </Panel>
          <Panel>
            {error && <div className="p-4"><ErrorMessage message={error} /></div>}
            {loading ? <PageState message="Loading suppliers..." /> : (
              <div className="overflow-x-auto">
                <table className="w-full min-w-[520px] text-left text-sm">
                  <thead className="bg-[#eeece5] text-[10px] uppercase text-[#6f746e]">
                    <tr><th className="px-5 py-3">Name</th><th>Phone</th><th>Notes</th><th /></tr>
                  </thead>
                  <tbody>
                    {rows.map((row) => (
                      <tr key={row.id} className="border-t border-[#e2ded4]">
                        <td className="px-5 py-3 font-semibold">{row.name}</td>
                        <td>{row.phone || "—"}</td>
                        <td>{row.notes || "—"}</td>
                        <td className="pr-4 text-right">
                          <button type="button" onClick={() => remove(row.id)} className="text-[#b84837]" aria-label="Delete">
                            <Trash2 size={16} />
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
                {rows.length === 0 && <p className="p-8 text-center text-sm text-[#6f746e]">No suppliers yet. Restock still works without one.</p>}
              </div>
            )}
          </Panel>
        </div>
      </AppShell>
    );
  }

  return (
    <AppShell title="Suppliers" eyebrow="Every inventory buy names a house — walk-in covers cash with no named supplier">
      {error && <div className="mb-5"><ErrorMessage message={error} /></div>}
      <div className="grid gap-5 xl:grid-cols-[0.85fr_1.35fr]">
        <div className="space-y-5">
          <Panel className="p-5">
            <h2 className="font-display text-2xl font-semibold uppercase">Add supplier</h2>
            <form onSubmit={create} className="mt-4 grid gap-3">
              <input name="name" required placeholder="Supplier name" className={inputClass} />
              <input name="phone" placeholder="Phone" className={inputClass} />
              <input name="phone_secondary" placeholder="Second phone" className={inputClass} />
              <input name="email" type="email" placeholder="Email" className={inputClass} />
              <input name="contact_person" placeholder="Contact person" className={inputClass} />
              <input name="address" placeholder="Address" className={inputClass} />
              <input name="tin" placeholder="TIN" className={inputClass} />
              <input name="notes" placeholder="Notes" className={inputClass} />
              <button className={buttonClass}><Plus size={16} /> Save supplier</button>
            </form>
          </Panel>
          <Panel>
            {loading ? <PageState message="Loading suppliers..." /> : (
              <div className="divide-y divide-[#e2ded4]">
                {rows.map((row) => (
                  <button
                    key={row.id}
                    type="button"
                    onClick={() => setSelectedId(row.id)}
                    className={`flex w-full items-start justify-between px-5 py-3 text-left text-sm ${selectedId === row.id ? "bg-[#167c73]/8" : ""}`}
                  >
                    <span>
                      <span className="font-semibold">{row.name}</span>
                      {row.is_system && <span className="ml-2 text-[10px] font-bold uppercase text-[#9a5b12]">Walk-in</span>}
                      <span className="mt-0.5 block text-xs text-[#6f746e]">{row.phone || "No phone"}</span>
                    </span>
                  </button>
                ))}
              </div>
            )}
          </Panel>
        </div>

        {detail ? (
          <div className="space-y-5">
            <Panel className="p-5">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <h2 className="font-display text-2xl font-semibold uppercase">{detail.name}</h2>
                  <p className="mt-1 text-sm text-[#6f746e]">
                    {[detail.address, detail.phone, detail.tin ? `TIN ${detail.tin}` : null].filter(Boolean).join(" · ") || "No contact details yet"}
                  </p>
                </div>
                {!detail.is_system && (
                  <button type="button" onClick={() => remove(detail.id)} className="text-[#b84837]" aria-label="Delete">
                    <Trash2 size={16} />
                  </button>
                )}
              </div>
              <div className="mt-4 flex flex-wrap gap-2 text-[10px] font-bold uppercase">
                <span className="border border-[#20221f] bg-[#20221f] px-2 py-1 text-white">Open credit {money(detail.open_credit ?? 0)}</span>
                <span className="border border-[#d7d3c8] px-2 py-1">{detail.purchase_count ?? 0} purchases</span>
                <span className="border border-[#d7d3c8] px-2 py-1">{detail.part_kind_count ?? 0} part kinds</span>
              </div>
              <form key={detail.id} onSubmit={update} className="mt-5 grid gap-3 sm:grid-cols-2">
                <input name="name" required defaultValue={detail.name} className={inputClass} />
                <input name="phone" defaultValue={detail.phone ?? ""} placeholder="Phone" className={inputClass} />
                <input name="phone_secondary" defaultValue={detail.phone_secondary ?? ""} placeholder="Second phone" className={inputClass} />
                <input name="email" type="email" defaultValue={detail.email ?? ""} placeholder="Email" className={inputClass} />
                <input name="contact_person" defaultValue={detail.contact_person ?? ""} placeholder="Contact person" className={inputClass} />
                <input name="tin" defaultValue={detail.tin ?? ""} placeholder="TIN" className={inputClass} />
                <input name="address" defaultValue={detail.address ?? ""} placeholder="Address" className={`${inputClass} sm:col-span-2`} />
                <input name="notes" defaultValue={detail.notes ?? ""} placeholder="Notes" className={`${inputClass} sm:col-span-2`} />
                <button disabled={saving} className={`${buttonClass} sm:col-span-2`}>{saving ? "Saving..." : "Save details"}</button>
              </form>
            </Panel>
            <Panel>
              <div className="border-b border-[#d7d3c8] px-5 py-4">
                <h3 className="font-display text-xl font-semibold uppercase">Purchases</h3>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full min-w-[520px] text-left text-sm">
                  <thead className="bg-[#eeece5] text-[10px] uppercase text-[#6f746e]">
                    <tr><th className="px-5 py-3">Date</th><th>Ref</th><th>Items</th><th>Status</th><th className="pr-5 text-right">Amount</th></tr>
                  </thead>
                  <tbody>
                    {(detail.purchases ?? []).map((row) => (
                      <tr key={row.id} className="border-t border-[#e2ded4]">
                        <td className="px-5 py-3">{row.received_at || "—"}</td>
                        <td>{row.receipt_number || "—"}</td>
                        <td>{row.items_label || "—"}</td>
                        <td className="capitalize">{row.payment_status || "—"}</td>
                        <td className="pr-5 text-right tabular-nums">{row.amount != null ? money(row.amount) : "—"}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
                {(detail.purchases ?? []).length === 0 && <p className="p-8 text-center text-sm text-[#6f746e]">No purchases on this supplier yet.</p>}
              </div>
            </Panel>
            <Panel>
              <div className="border-b border-[#d7d3c8] px-5 py-4">
                <h3 className="font-display text-xl font-semibold uppercase">Parts bought</h3>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full min-w-[480px] text-left text-sm">
                  <thead className="bg-[#eeece5] text-[10px] uppercase text-[#6f746e]">
                    <tr><th className="px-5 py-3">Part</th><th>Kind</th><th>Times</th><th>Qty</th><th className="pr-5 text-right">Last cost</th></tr>
                  </thead>
                  <tbody>
                    {(detail.parts_bought ?? []).map((row) => (
                      <tr key={row.part_id} className="border-t border-[#e2ded4]">
                        <td className="px-5 py-3 font-semibold">{row.name}</td>
                        <td>{row.kind || "—"}</td>
                        <td>{row.times_bought}</td>
                        <td>{row.total_qty}</td>
                        <td className="pr-5 text-right tabular-nums">{row.last_unit_cost != null ? money(row.last_unit_cost) : "—"}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
                {(detail.parts_bought ?? []).length === 0 && <p className="p-8 text-center text-sm text-[#6f746e]">No parts linked yet.</p>}
              </div>
            </Panel>
          </div>
        ) : (
          <Panel className="p-8 text-sm text-[#6f746e]">Select a supplier to see purchases and credit.</Panel>
        )}
      </div>
    </AppShell>
  );
}
