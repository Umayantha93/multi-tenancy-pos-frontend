"use client";

import { FormEvent, useEffect, useMemo, useState } from "react";
import { Plus, Save, Trash2 } from "lucide-react";
import { AppShell } from "@/components/app-shell";
import { ErrorMessage, PageState, Panel, buttonClass, inputClass } from "@/components/ui";
import { api, currentUser, money } from "@/lib/api";

type ServiceAddon = {
  id: number;
  name: string;
  price: string;
  sort_order: number;
  is_full_service: boolean;
  active: boolean;
  inclusions: Array<{ id: number; name: string }>;
};

export default function ServiceAddonsPage() {
  const [isOwner, setIsOwner] = useState(false);
  const [addons, setAddons] = useState<ServiceAddon[]>([]);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [fullPrice, setFullPrice] = useState("");
  const [includedIds, setIncludedIds] = useState<number[]>([]);
  const [savingFull, setSavingFull] = useState(false);

  const regularAddons = useMemo(() => addons.filter((addon) => !addon.is_full_service), [addons]);
  const fullService = useMemo(() => addons.find((addon) => addon.is_full_service) ?? null, [addons]);

  function load() {
    setLoading(true);
    api<ServiceAddon[]>("/service-addons")
      .then((result) => {
        setAddons(result);
        const full = result.find((addon) => addon.is_full_service);
        setFullPrice(full ? String(Number(full.price)) : "");
        setIncludedIds(full?.inclusions.map((item) => item.id) ?? []);
      })
      .catch((caught) => setError(caught instanceof Error ? caught.message : "Could not load service addons."))
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
      await api("/service-addons", {
        method: "POST",
        body: JSON.stringify({
          name: data.get("name"),
          price: Number(data.get("price")),
        }),
      });
      form.reset();
      load();
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Unable to save addon.");
    }
  }

  async function savePrice(addon: ServiceAddon, price: string) {
    if (!isOwner) return;
    setSaving(true);
    setError("");
    try {
      await api(`/service-addons/${addon.id}`, {
        method: "PUT",
        body: JSON.stringify({ price: Number(price) }),
      });
      load();
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Unable to update price.");
    } finally {
      setSaving(false);
    }
  }

  async function remove(id: number) {
    if (!isOwner) return;
    setError("");
    try {
      await api(`/service-addons/${id}`, { method: "DELETE" });
      load();
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Unable to delete addon.");
    }
  }

  async function saveFullService(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!isOwner) return;
    setSavingFull(true);
    setError("");
    try {
      if (fullService) {
        await api(`/service-addons/${fullService.id}`, {
          method: "PUT",
          body: JSON.stringify({
            name: "Full service",
            price: Number(fullPrice),
            is_full_service: true,
            included_addon_ids: includedIds,
          }),
        });
      } else {
        await api("/service-addons", {
          method: "POST",
          body: JSON.stringify({
            name: "Full service",
            price: Number(fullPrice),
            is_full_service: true,
            included_addon_ids: includedIds,
          }),
        });
      }
      load();
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Unable to save full service.");
    } finally {
      setSavingFull(false);
    }
  }

  function toggleIncluded(id: number) {
    setIncludedIds((current) => (
      current.includes(id) ? current.filter((value) => value !== id) : [...current, id]
    ));
  }

  return (
    <AppShell title="Service addons" eyebrow="Buttons on service job cards">
      {!isOwner && (
        <p className="mb-5 text-sm text-[#6f746e]">Only the garage owner can add, price, or remove these buttons.</p>
      )}
      {error && <div className="mb-5"><ErrorMessage message={error} /></div>}
      <div className="grid gap-5 xl:grid-cols-[0.9fr_1.1fr]">
        {isOwner && (
          <Panel className="p-5">
            <h2 className="font-display text-2xl font-semibold uppercase">Add a button</h2>
            <p className="mt-1 text-sm text-[#6f746e]">This appears on service job cards. Staff tap it to add the priced line.</p>
            <form onSubmit={create} className="mt-4 space-y-3">
              <input name="name" required placeholder="e.g. Under wash" className={inputClass} />
              <input name="price" required type="number" min="0" step="0.01" placeholder="Amount" className={inputClass} />
              <button className={buttonClass}><Plus size={16} /> Save addon</button>
            </form>
          </Panel>
        )}
        <Panel className={isOwner ? "" : "xl:col-span-2"}>
          {loading ? <PageState message="Loading service addons..." /> : (
            <div className="divide-y divide-[#e2ded4]">
              {regularAddons.map((addon) => (
                <AddonRow
                  key={addon.id}
                  addon={addon}
                  canEdit={isOwner}
                  busy={saving}
                  onSavePrice={savePrice}
                  onRemove={remove}
                />
              ))}
              {regularAddons.length === 0 && (
                <p className="p-8 text-center text-sm text-[#6f746e]">No service buttons yet.</p>
              )}
            </div>
          )}
        </Panel>
      </div>

      <Panel className="mt-5 p-5">
        <h2 className="font-display text-2xl font-semibold uppercase">Full service</h2>
        <p className="mt-1 text-sm text-[#6f746e]">
          Set the package price and choose which buttons are included. Tapping Full service on a job card adds one line at this price.
        </p>
        <form onSubmit={saveFullService} className="mt-4 space-y-4">
          <label className="block max-w-xs text-xs font-bold uppercase">
            Full service price
            <input
              type="number"
              min="0"
              step="0.01"
              required
              value={fullPrice}
              onChange={(event) => setFullPrice(event.target.value)}
              disabled={!isOwner}
              className={`${inputClass} mt-2`}
            />
          </label>
          <div>
            <p className="text-xs font-bold uppercase">Included services</p>
            <div className="mt-2 grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
              {regularAddons.map((addon) => (
                <label key={addon.id} className="flex cursor-pointer items-center gap-2 border border-[#d7d3c8] bg-white px-3 py-2 text-sm">
                  <input
                    type="checkbox"
                    checked={includedIds.includes(addon.id)}
                    disabled={!isOwner}
                    onChange={() => toggleIncluded(addon.id)}
                    className="size-4 accent-[#167c73]"
                  />
                  <span>
                    <span className="font-semibold">{addon.name}</span>
                    <span className="ml-2 text-[#6f746e]">{money(addon.price)}</span>
                  </span>
                </label>
              ))}
            </div>
          </div>
          {isOwner && (
            <button disabled={savingFull} className={buttonClass}>
              <Save size={16} />{savingFull ? "Saving..." : "Save full service"}
            </button>
          )}
        </form>
      </Panel>
    </AppShell>
  );
}

function AddonRow({
  addon,
  canEdit,
  busy,
  onSavePrice,
  onRemove,
}: {
  addon: ServiceAddon;
  canEdit: boolean;
  busy: boolean;
  onSavePrice: (addon: ServiceAddon, price: string) => void;
  onRemove: (id: number) => void;
}) {
  const [price, setPrice] = useState(String(Number(addon.price)));

  useEffect(() => {
    setPrice(String(Number(addon.price)));
  }, [addon.price]);

  return (
    <div className="flex flex-wrap items-center justify-between gap-3 px-5 py-4">
      <div>
        <p className="font-semibold">{addon.name}</p>
        {!canEdit && <p className="text-sm text-[#6f746e]">{money(addon.price)}</p>}
      </div>
      {canEdit ? (
        <div className="flex items-center gap-2">
          <input
            type="number"
            min="0"
            step="0.01"
            value={price}
            onChange={(event) => setPrice(event.target.value)}
            className={`${inputClass} w-32`}
          />
          <button
            type="button"
            disabled={busy || price === String(Number(addon.price))}
            onClick={() => onSavePrice(addon, price)}
            className="h-9 border border-[#c9c5b9] bg-white px-3 text-[13px] font-semibold disabled:opacity-40"
          >
            Save
          </button>
          <button type="button" onClick={() => onRemove(addon.id)} className="text-[#b84837]" aria-label={`Delete ${addon.name}`}>
            <Trash2 size={16} />
          </button>
        </div>
      ) : null}
    </div>
  );
}
