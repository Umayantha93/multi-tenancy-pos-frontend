"use client";

import { FormEvent, useEffect, useState } from "react";
import { ChevronDown, Plus, Save, Trash2 } from "lucide-react";
import { AppShell } from "@/components/app-shell";
import { ConfirmModal, ErrorMessage, PageState, Panel, buttonClass, inputClass } from "@/components/ui";
import { api, currentUser, money } from "@/lib/api";
import { useBusinessProfile } from "@/lib/use-business-profile";

type LaborItem = {
  id: number;
  name: string;
  hourly_rate: string;
  standard_hours: string;
  standard_price: string;
  active: boolean;
};

type LaborCategory = {
  id: number;
  name: string;
  items: LaborItem[];
};

type PendingDelete =
  | { kind: "category"; id: number; label: string }
  | { kind: "item"; id: number; label: string };

export default function LaborCatalogPage() {
  const [isOwner, setIsOwner] = useState(false);
  const [categories, setCategories] = useState<LaborCategory[]>([]);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);
  const [openId, setOpenId] = useState<number | null>(null);
  const [pendingDelete, setPendingDelete] = useState<PendingDelete | null>(null);
  const [deleting, setDeleting] = useState(false);
  const isPaint = useBusinessProfile().type === "paint";

  function load() {
    setLoading(true);
    api<LaborCategory[]>("/labor-catalog")
      .then((result) => {
        setCategories(result);
        setOpenId((current) => current ?? result[0]?.id ?? null);
      })
      .catch((caught) => setError(caught instanceof Error ? caught.message : "Could not load labor catalog."))
      .finally(() => setLoading(false));
  }

  useEffect(() => {
    setIsOwner(currentUser()?.role === "business_owner");
    load();
  }, []);

  async function createCategory(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!isOwner) return;
    const form = event.currentTarget;
    const name = String(new FormData(form).get("name") || "").trim();
    if (!name) return;
    setError("");
    try {
      const created = await api<LaborCategory>("/labor-categories", {
        method: "POST",
        body: JSON.stringify({ name }),
      });
      form.reset();
      setOpenId(created.id);
      load();
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Could not add category.");
    }
  }

  async function renameCategory(category: LaborCategory, name: string) {
    if (!isOwner || !name.trim()) return;
    setError("");
    try {
      await api(`/labor-categories/${category.id}`, { method: "PUT", body: JSON.stringify({ name: name.trim() }) });
      load();
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Could not rename category.");
    }
  }

  async function createItem(event: FormEvent<HTMLFormElement>, categoryId: number) {
    event.preventDefault();
    if (!isOwner) return;
    const form = event.currentTarget;
    const data = Object.fromEntries(new FormData(form));
    setError("");
    try {
      await api(`/labor-categories/${categoryId}/items`, {
        method: "POST",
        body: JSON.stringify({
          name: data.name,
          hourly_rate: Number(data.hourly_rate),
          standard_hours: Number(data.standard_hours),
        }),
      });
      form.reset();
      load();
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Could not add labor item.");
    }
  }

  async function saveItem(item: LaborItem, patch: Partial<{ name: string; hourly_rate: number; standard_hours: number }>) {
    if (!isOwner) return;
    setError("");
    try {
      await api(`/labor-items/${item.id}`, { method: "PUT", body: JSON.stringify(patch) });
      load();
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Could not update labor item.");
    }
  }

  async function confirmDelete() {
    if (!pendingDelete) return;
    setDeleting(true);
    setError("");
    try {
      if (pendingDelete.kind === "category") {
        await api(`/labor-categories/${pendingDelete.id}`, { method: "DELETE" });
      } else {
        await api(`/labor-items/${pendingDelete.id}`, { method: "DELETE" });
      }
      setPendingDelete(null);
      load();
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Could not delete.");
    } finally {
      setDeleting(false);
    }
  }

  return (
    <AppShell title={isPaint ? "Paint labor" : "Repair addons"} eyebrow={isPaint ? "Hourly catalog for panel-work jobs" : "Labor catalog for repair job cards"}>
      <ConfirmModal
        open={Boolean(pendingDelete)}
        title={pendingDelete?.kind === "category" ? "Delete category" : "Delete labor item"}
        message={
          pendingDelete?.kind === "category"
            ? `Delete “${pendingDelete.label}” and all of its labor items? Existing bills keep their descriptions.`
            : `Delete “${pendingDelete?.label}” from the catalog? Existing bills keep their descriptions.`
        }
        confirmLabel="Delete"
        tone="danger"
        busy={deleting}
        onCancel={() => { if (!deleting) setPendingDelete(null); }}
        onConfirm={confirmDelete}
      />
      {!isOwner && (
        <p className="mb-5 text-sm text-[#6f746e]">Only the owner can add, edit, or remove labor categories and items.</p>
      )}
      {error && <div className="mb-5"><ErrorMessage message={error} /></div>}

      {isOwner && (
        <Panel className="mb-5 p-5">
          <h2 className="font-display text-2xl font-semibold uppercase">Add category</h2>
          <p className="mt-1 text-sm text-[#6f746e]">
            {isPaint
              ? "Group paint labor (Prep, Paint, Finish…). Staff search these on panel jobs."
              : "Group labor jobs (Brakes, Engine, Electrical…). Staff search these on repair bills."}
          </p>
          <form onSubmit={createCategory} className="mt-4 flex max-w-xl items-stretch gap-2">
            <input name="name" required placeholder={isPaint ? "e.g. Prep" : "e.g. Brakes"} className={inputClass} />
            <button className={`${buttonClass} shrink-0`}><Plus size={14} /> Add</button>
          </form>
        </Panel>
      )}

      {loading ? <PageState message="Loading labor catalog..." /> : (
        <div className="space-y-3">
          {categories.map((category) => {
            const open = openId === category.id;
            return (
              <Panel key={category.id}>
                <div className="flex flex-wrap items-center gap-2 border-b border-[#e2ded4] px-4 py-3">
                  <button type="button" onClick={() => setOpenId(open ? null : category.id)} className="flex min-w-0 flex-1 items-center gap-2 text-left">
                    <ChevronDown size={16} className={`shrink-0 transition ${open ? "" : "-rotate-90"}`} />
                    <span className="font-display text-xl font-semibold uppercase">{category.name}</span>
                    <span className="text-xs text-[#6f746e]">{category.items.length} items</span>
                  </button>
                  {isOwner && (
                    <button
                      type="button"
                      onClick={() => setPendingDelete({ kind: "category", id: category.id, label: category.name })}
                      className="text-[#b84837]"
                      aria-label={`Delete ${category.name}`}
                    >
                      <Trash2 size={16} />
                    </button>
                  )}
                </div>
                {open && (
                  <div className="p-4">
                    {isOwner && (
                      <form
                        onSubmit={(event) => {
                          event.preventDefault();
                          void renameCategory(category, String(new FormData(event.currentTarget).get("name") || ""));
                        }}
                        className="mb-4 flex max-w-md items-stretch gap-2"
                      >
                        <input name="name" defaultValue={category.name} className={inputClass} />
                        <button type="submit" className="h-9 border border-[#c9c5b9] bg-white px-3 text-[13px] font-semibold">Rename</button>
                      </form>
                    )}
                    <div className="overflow-x-auto">
                      <table className="w-full min-w-[640px] text-left text-sm">
                        <thead className="bg-[#eeece5] text-[10px] uppercase text-[#6f746e]">
                          <tr>
                            <th className="px-3 py-2">Labor item</th>
                            <th className="px-3 py-2">Hourly rate</th>
                            <th className="px-3 py-2">Std hours</th>
                            <th className="px-3 py-2 text-right">Standard price</th>
                            {isOwner && <th className="px-3 py-2" />}
                          </tr>
                        </thead>
                        <tbody>
                          {category.items.map((item) => (
                            <LaborItemRow
                              key={item.id}
                              item={item}
                              canEdit={isOwner}
                              onSave={saveItem}
                              onRemove={() => setPendingDelete({ kind: "item", id: item.id, label: item.name })}
                            />
                          ))}
                        </tbody>
                      </table>
                      {category.items.length === 0 && <p className="p-6 text-center text-sm text-[#6f746e]">No labor items in this category yet.</p>}
                    </div>
                    {isOwner && (
                      <form onSubmit={(event) => createItem(event, category.id)} className="mt-4 grid gap-2 sm:grid-cols-[1.4fr_0.8fr_0.6fr_auto]">
                        <input name="name" required placeholder={isPaint ? "New paint labor" : "New labor item"} className={inputClass} />
                        <input name="hourly_rate" required type="number" min="0" step="0.01" placeholder="Hourly rate" defaultValue="3000" className={inputClass} />
                        <input name="standard_hours" required type="number" min="0.01" step="0.01" placeholder="Hours" defaultValue="1" className={inputClass} />
                        <button className={buttonClass}><Plus size={14} /> Add item</button>
                      </form>
                    )}
                  </div>
                )}
              </Panel>
            );
          })}
          {categories.length === 0 && <PageState message="No labor categories yet." />}
        </div>
      )}
    </AppShell>
  );
}

function LaborItemRow({
  item,
  canEdit,
  onSave,
  onRemove,
}: {
  item: LaborItem;
  canEdit: boolean;
  onSave: (item: LaborItem, patch: { name?: string; hourly_rate?: number; standard_hours?: number }) => void;
  onRemove: () => void;
}) {
  const [name, setName] = useState(item.name);
  const [rate, setRate] = useState(String(Number(item.hourly_rate)));
  const [hours, setHours] = useState(String(Number(item.standard_hours)));
  const standardPrice = Number(rate || 0) * Number(hours || 0);
  const dirty = name !== item.name || Number(rate) !== Number(item.hourly_rate) || Number(hours) !== Number(item.standard_hours);

  useEffect(() => {
    setName(item.name);
    setRate(String(Number(item.hourly_rate)));
    setHours(String(Number(item.standard_hours)));
  }, [item.name, item.hourly_rate, item.standard_hours]);

  if (!canEdit) {
    return (
      <tr className="border-t border-[#e2ded4]">
        <td className="px-3 py-2 font-semibold">{item.name}</td>
        <td className="px-3 py-2">{money(item.hourly_rate)}</td>
        <td className="px-3 py-2">{Number(item.standard_hours)}</td>
        <td className="px-3 py-2 text-right font-semibold">{money(item.standard_price)}</td>
      </tr>
    );
  }

  return (
    <tr className="border-t border-[#e2ded4]">
      <td className="px-3 py-2"><input value={name} onChange={(event) => setName(event.target.value)} className={inputClass} /></td>
      <td className="px-3 py-2"><input type="number" min="0" step="0.01" value={rate} onChange={(event) => setRate(event.target.value)} className={inputClass} /></td>
      <td className="px-3 py-2"><input type="number" min="0.01" step="0.01" value={hours} onChange={(event) => setHours(event.target.value)} className={inputClass} /></td>
      <td className="px-3 py-2 text-right font-semibold tabular-nums">{money(standardPrice)}</td>
      <td className="px-3 py-2">
        <div className="flex justify-end gap-2">
          <button
            type="button"
            disabled={!dirty}
            onClick={() => onSave(item, { name, hourly_rate: Number(rate), standard_hours: Number(hours) })}
            className="inline-flex h-9 items-center gap-1 border border-[#c9c5b9] bg-white px-2 text-[12px] font-semibold disabled:opacity-40"
          >
            <Save size={13} /> Save
          </button>
          <button type="button" onClick={onRemove} className="text-[#b84837]" aria-label={`Delete ${item.name}`}>
            <Trash2 size={16} />
          </button>
        </div>
      </td>
    </tr>
  );
}
