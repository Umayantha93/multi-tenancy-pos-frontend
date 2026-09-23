"use client";

import { FormEvent, useEffect, useState } from "react";
import { Plus, Trash2 } from "lucide-react";
import { AppShell } from "@/components/app-shell";
import { ErrorMessage, PageState, Panel, buttonClass, inputClass } from "@/components/ui";
import { api, currentUser, money } from "@/lib/api";
import { useBusinessProfile } from "@/lib/use-business-profile";

type DiscountType = {
  id: number;
  name: string;
  mode: "amount" | "percent";
  value: string | number;
  sort_order: number;
  active: boolean;
};

export default function DiscountTypesPage() {
  const profile = useBusinessProfile();
  const isPaint = profile.type === "paint";
  const [isOwner, setIsOwner] = useState(false);
  const [rows, setRows] = useState<DiscountType[]>([]);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);

  function load() {
    setLoading(true);
    api<DiscountType[]>("/discount-types")
      .then(setRows)
      .catch((caught) => setError(caught instanceof Error ? caught.message : "Could not load discount types."))
      .finally(() => setLoading(false));
  }

  useEffect(() => {
    setIsOwner(currentUser()?.role === "business_owner");
    load();
  }, []);

  async function create(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!isOwner) return;
    setError("");
    const form = event.currentTarget;
    const data = new FormData(form);
    try {
      await api("/discount-types", {
        method: "POST",
        body: JSON.stringify({
          name: data.get("name"),
          mode: data.get("mode"),
          value: Number(data.get("value")),
        }),
      });
      form.reset();
      load();
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Unable to save discount type.");
    }
  }

  async function saveRow(row: DiscountType, patch: Partial<DiscountType>) {
    if (!isOwner) return;
    setError("");
    try {
      await api(`/discount-types/${row.id}`, {
        method: "PUT",
        body: JSON.stringify(patch),
      });
      load();
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Unable to update discount type.");
    }
  }

  async function remove(id: number) {
    if (!isOwner) return;
    setError("");
    try {
      await api(`/discount-types/${id}`, { method: "DELETE" });
      load();
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Unable to delete discount type.");
    }
  }

  return (
    <AppShell title="Discount types" eyebrow={isPaint ? "Presets for paint job discounts" : "Presets for garage bill discounts"}>
      <p className="mb-5 max-w-2xl text-sm text-[#6f746e]">
        Create common discounts (fixed LKR or %). Staff pick them on the bill discount section instead of typing amounts each time.
      </p>
      {error && <div className="mb-5"><ErrorMessage message={error} /></div>}
      {isOwner && (
        <Panel className="mb-5 max-w-2xl p-5">
          <form onSubmit={create} className="grid gap-3 sm:grid-cols-[1.4fr_0.9fr_0.8fr_auto]">
            <label className="text-xs font-bold uppercase">
              Name
              <input name="name" required className={`${inputClass} mt-2`} placeholder="e.g. Staff discount" />
            </label>
            <label className="text-xs font-bold uppercase">
              Mode
              <select name="mode" defaultValue="percent" className={`${inputClass} mt-2`}>
                <option value="percent">Percent</option>
                <option value="amount">Fixed LKR</option>
              </select>
            </label>
            <label className="text-xs font-bold uppercase">
              Value
              <input name="value" type="number" min="0" step="0.01" required className={`${inputClass} mt-2`} />
            </label>
            <button className={`${buttonClass} self-end`}><Plus size={16} /> Add</button>
          </form>
        </Panel>
      )}
      {loading ? <PageState message="Loading discount types..." /> : (
        <Panel>
          <div className="divide-y divide-[#e2ded4]">
            {rows.map((row) => (
              <div key={row.id} className="flex flex-wrap items-center gap-3 px-4 py-3">
                <div className="min-w-0 flex-1">
                  <p className="font-semibold">{row.name}</p>
                  <p className="text-xs text-[#6f746e]">
                    {row.mode === "percent" ? `${Number(row.value)}% of charges` : money(row.value)}
                    {!row.active ? " · inactive" : ""}
                  </p>
                </div>
                {isOwner && (
                  <>
                    <input
                      type="number"
                      min="0"
                      step="0.01"
                      defaultValue={Number(row.value)}
                      onBlur={(event) => {
                        const next = Number(event.target.value);
                        if (Number.isFinite(next) && next !== Number(row.value)) {
                          void saveRow(row, { value: next });
                        }
                      }}
                      className={`${inputClass} w-28`}
                    />
                    <button type="button" onClick={() => void saveRow(row, { active: !row.active })} className="text-xs font-bold uppercase text-[#167c73]">
                      {row.active ? "Disable" : "Enable"}
                    </button>
                    <button type="button" onClick={() => void remove(row.id)} className="grid size-8 place-items-center text-[#b84837]" aria-label="Delete">
                      <Trash2 size={16} />
                    </button>
                  </>
                )}
              </div>
            ))}
            {rows.length === 0 && <p className="p-8 text-center text-sm text-[#6f746e]">No discount types yet.</p>}
          </div>
        </Panel>
      )}
    </AppShell>
  );
}
