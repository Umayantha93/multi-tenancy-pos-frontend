"use client";

import { FormEvent, useEffect, useState } from "react";
import { Plus, Trash2 } from "lucide-react";
import { AppShell } from "@/components/app-shell";
import { buttonClass, ErrorMessage, PageState, Panel, inputClass } from "@/components/ui";
import { api } from "@/lib/api";

type Supplier = { id: number; name: string; phone?: string | null; notes?: string | null };

export default function SuppliersPage() {
  const [rows, setRows] = useState<Supplier[]>([]);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);

  function load() {
    setLoading(true);
    api<{ data: Supplier[] }>("/suppliers?per_page=100")
      .then((result) => setRows(result.data))
      .catch((caught) => setError(caught.message))
      .finally(() => setLoading(false));
  }

  useEffect(load, []);

  async function create(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");
    const form = event.currentTarget;
    const data = Object.fromEntries(new FormData(form));
    try {
      await api("/suppliers", { method: "POST", body: JSON.stringify({
        name: data.name,
        phone: data.phone || null,
        notes: data.notes || null,
      }) });
      form.reset();
      load();
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Unable to save supplier.");
    }
  }

  async function remove(id: number) {
    setError("");
    try {
      await api(`/suppliers/${id}`, { method: "DELETE" });
      load();
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Unable to delete supplier.");
    }
  }

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
