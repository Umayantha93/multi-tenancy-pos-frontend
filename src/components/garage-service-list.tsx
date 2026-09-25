"use client";

import { KeyboardEvent, useCallback, useEffect, useMemo, useState, useSyncExternalStore } from "react";
import { Trash2 } from "lucide-react";
import { AppShell } from "@/components/app-shell";
import { ConfirmModal, ErrorMessage, PageState, Panel } from "@/components/ui";
import { api, currentUser } from "@/lib/api";

type Named = { id: number; name: string };
type VehiclePrice = { service_vehicle_class_id: number; price: string | null; offered: boolean };
type Addon = Named & { is_full_service: boolean; active: boolean; inclusions: Named[]; vehicle_prices?: VehiclePrice[] };
type PendingDelete = { kind: "category" | "service"; item: Named } | null;

const noopSubscribe = () => () => {};
const errorText = (caught: unknown, fallback: string) => (caught instanceof Error ? caught.message : fallback);

export function GarageServiceList() {
  const isOwner = useSyncExternalStore(noopSubscribe, () => currentUser()?.role === "business_owner", () => false);
  const [categories, setCategories] = useState<Named[]>([]);
  const [addons, setAddons] = useState<Addon[]>([]);
  const [selectedTypeId, setSelectedTypeId] = useState<number | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [pendingDelete, setPendingDelete] = useState<PendingDelete>(null);
  const [busy, setBusy] = useState(false);

  const services = useMemo(() => addons.filter((addon) => !addon.is_full_service), [addons]);
  const fullService = useMemo(() => addons.find((addon) => addon.is_full_service) ?? null, [addons]);
  const includedIds = useMemo(() => new Set(fullService?.inclusions.map((item) => item.id) ?? []), [fullService]);
  const selectedType = categories.find((row) => row.id === selectedTypeId) ?? categories[0] ?? null;

  const load = useCallback(() => {
    return Promise.all([api<Named[]>("/service-vehicle-classes"), api<Addon[]>("/service-addons")])
      .then(([classRows, addonRows]) => {
        setCategories(classRows);
        setAddons(addonRows);
      })
      .catch((caught) => setError(errorText(caught, "Could not load the service list.")))
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  async function run(action: () => Promise<unknown>, fallback: string) {
    setError("");
    try {
      await action();
      await load();
      return true;
    } catch (caught) {
      setError(errorText(caught, fallback));
      return false;
    }
  }

  const addCategory = (name: string) => run(
    () => api("/service-vehicle-classes", { method: "POST", body: JSON.stringify({ name }) }),
    "Could not add the vehicle type.",
  );
  const renameCategory = (item: Named, name: string) => run(
    () => api(`/service-vehicle-classes/${item.id}`, { method: "PUT", body: JSON.stringify({ name }) }),
    "Could not rename the vehicle type.",
  );
  const addService = (name: string) => run(
    () => api("/service-addons", { method: "POST", body: JSON.stringify({ name }) }),
    "Could not add the service.",
  );
  const renameService = (item: Named, name: string) => run(
    () => api(`/service-addons/${item.id}`, { method: "PUT", body: JSON.stringify({ name }) }),
    "Could not rename the service.",
  );
  const saveSetting = (addon: Addon, typeId: number, offered: boolean, price: number | null) => run(
    () => api(`/service-addons/${addon.id}/vehicle-classes/${typeId}`, {
      method: "PUT",
      body: JSON.stringify({ offered, price }),
    }),
    "Could not save this vehicle type's setting.",
  );

  async function confirmDelete() {
    if (!pendingDelete) return;
    setBusy(true);
    const path = pendingDelete.kind === "category" ? "/service-vehicle-classes" : "/service-addons";
    const ok = await run(() => api(`${path}/${pendingDelete.item.id}`, { method: "DELETE" }), "Could not delete.");
    setBusy(false);
    if (ok) setPendingDelete(null);
  }

  function toggleFullService(enabled: boolean) {
    if (enabled) {
      void run(
        () => api("/service-addons", {
          method: "POST",
          body: JSON.stringify({ name: "Full service", is_full_service: true, included_addon_ids: [] }),
        }),
        "Could not turn on Full service.",
      );
    } else if (fullService) {
      setPendingDelete({ kind: "service", item: fullService });
    }
  }

  function toggleIncluded(id: number) {
    if (!fullService) return;
    const next = includedIds.has(id) ? [...includedIds].filter((value) => value !== id) : [...includedIds, id];
    void run(
      () => api(`/service-addons/${fullService.id}`, {
        method: "PUT",
        body: JSON.stringify({ is_full_service: true, included_addon_ids: next }),
      }),
      "Could not update Full service.",
    );
  }

  const blueprintRows = fullService ? [fullService, ...services] : services;

  return (
    <AppShell title="Service addons" eyebrow="One service blueprint for every vehicle type">
      {!isOwner && <p className="mb-4 text-sm text-[#6f746e]">Only the owner can change these lists.</p>}
      {error && <div className="mb-4"><ErrorMessage message={error} /></div>}

      {loading ? <PageState message="Loading..." /> : (
        <div className="space-y-4">
          <div className="grid gap-4 xl:grid-cols-2">
            <Panel className="p-4">
              <StepTitle step={1} title="Service blueprint" />
              <p className="mt-0.5 text-xs text-[#6f746e]">Write every service once — Body wash, Under wash, Hypower wash… Every vehicle type uses this same list.</p>
              <NameList
                items={services}
                canEdit={isOwner}
                placeholder="+ New service, press Enter"
                empty="No services yet."
                onAdd={addService}
                onRename={renameService}
                onRemove={(item) => setPendingDelete({ kind: "service", item })}
              />
              <label className="mt-4 flex cursor-pointer items-center gap-2">
                <input
                  type="checkbox"
                  checked={Boolean(fullService)}
                  disabled={!isOwner}
                  onChange={(event) => toggleFullService(event.target.checked)}
                  className="size-4 accent-[#167c73]"
                />
                <span className="text-[11px] font-bold uppercase">Full service package</span>
              </label>
              {fullService && (
                <div className="mt-2 flex flex-wrap gap-1.5">
                  {services.map((service) => (
                    <label key={service.id} className="flex cursor-pointer items-center gap-1.5 border border-[#d7d3c8] bg-white px-2 py-1 text-[11px]">
                      <input
                        type="checkbox"
                        checked={includedIds.has(service.id)}
                        disabled={!isOwner}
                        onChange={() => toggleIncluded(service.id)}
                        className="size-3.5 accent-[#167c73]"
                      />
                      {service.name}
                    </label>
                  ))}
                  {services.length === 0 && <p className="text-xs text-[#6f746e]">Add services first, then tick what Full service includes.</p>}
                </div>
              )}
            </Panel>

            <Panel className="p-4">
              <StepTitle step={2} title="Vehicle types" />
              <p className="mt-0.5 text-xs text-[#6f746e]">Car, SUV, Van, Tata bus, Leyland bus, Lorry… A new type gets the whole blueprint straight away.</p>
              <NameList
                items={categories}
                canEdit={isOwner}
                placeholder="+ New vehicle type, press Enter"
                empty="No vehicle types yet."
                onAdd={addCategory}
                onRename={renameCategory}
                onRemove={(item) => setPendingDelete({ kind: "category", item })}
              />
            </Panel>
          </div>

          <Panel className="p-4">
            <StepTitle step={3} title="Set up each vehicle type" />
            <p className="mt-0.5 text-xs text-[#6f746e]">
              Untick a service this type doesn&apos;t get. Enter a price to fill it in on the job card, or leave it blank and staff type the price. Staff can always change it on the job card.
            </p>
            {categories.length === 0 || blueprintRows.length === 0 ? (
              <p className="mt-3 text-sm text-[#6f746e]">Add services in step 1 and vehicle types in step 2 first.</p>
            ) : (
              <>
                <div className="mt-3 flex flex-wrap gap-1">
                  {categories.map((row) => (
                    <button
                      key={row.id}
                      type="button"
                      onClick={() => setSelectedTypeId(row.id)}
                      className={`h-8 border px-3 text-[11px] font-bold uppercase ${
                        row.id === selectedType?.id
                          ? "border-[#20221f] bg-[#20221f] text-white"
                          : "border-[#d7d3c8] bg-[#fbfaf6] hover:border-[#20221f]"
                      }`}
                    >
                      {row.name}
                    </button>
                  ))}
                </div>
                {selectedType && (
                  <div className="mt-3 divide-y divide-[#e2ded4] border border-[#e2ded4] bg-white">
                    {blueprintRows.map((addon) => (
                      <TypeServiceRow
                        key={`${selectedType.id}-${addon.id}`}
                        addon={addon}
                        setting={addon.vehicle_prices?.find((row) => row.service_vehicle_class_id === selectedType.id) ?? null}
                        canEdit={isOwner}
                        onSave={(offered, price) => saveSetting(addon, selectedType.id, offered, price)}
                      />
                    ))}
                  </div>
                )}
              </>
            )}
          </Panel>
        </div>
      )}

      <ConfirmModal
        open={Boolean(pendingDelete)}
        title={`Delete ${pendingDelete?.item.name ?? ""}?`}
        message={pendingDelete?.kind === "category"
          ? "Its settings are removed. Old job cards keep their lines."
          : "It is removed from the blueprint and every vehicle type. Old bills keep their lines."}
        confirmLabel="Delete"
        tone="danger"
        busy={busy}
        onConfirm={() => void confirmDelete()}
        onCancel={() => setPendingDelete(null)}
      />
    </AppShell>
  );
}

function StepTitle({ step, title }: { step: number; title: string }) {
  return (
    <h2 className="flex items-center gap-2 font-display text-lg font-semibold uppercase">
      <span className="grid size-6 place-items-center bg-[#167c73] text-[11px] text-white">{step}</span>
      {title}
    </h2>
  );
}

function TypeServiceRow({
  addon,
  setting,
  canEdit,
  onSave,
}: {
  addon: Addon;
  setting: VehiclePrice | null;
  canEdit: boolean;
  onSave: (offered: boolean, price: number | null) => Promise<boolean>;
}) {
  const offered = setting ? setting.offered : true;
  const savedPrice = setting?.price != null ? String(Number(setting.price)) : "";
  const [price, setPrice] = useState(savedPrice);

  function commitPrice() {
    const trimmed = price.trim();
    if (trimmed === savedPrice) return;
    void onSave(offered, trimmed === "" ? null : Number(trimmed));
  }

  return (
    <div className={`flex items-center gap-2 px-3 py-1.5 ${offered ? "" : "bg-[#f3f1ea]"}`}>
      <label className="flex min-w-0 flex-1 cursor-pointer items-center gap-2">
        <input
          type="checkbox"
          checked={offered}
          disabled={!canEdit}
          onChange={(event) => void onSave(event.target.checked, price.trim() === "" ? null : Number(price))}
          className="size-4 accent-[#167c73]"
        />
        <span className={`truncate text-[12px] font-semibold ${offered ? "" : "text-[#9a9d97] line-through"}`}>
          {addon.name}
          {addon.is_full_service && <span className="ml-1.5 text-[9px] font-bold uppercase text-[#167c73]">Package</span>}
        </span>
      </label>
      <input
        type="number"
        min="0"
        step="0.01"
        inputMode="decimal"
        value={price}
        disabled={!canEdit || !offered}
        onChange={(event) => setPrice(event.target.value)}
        onBlur={commitPrice}
        onKeyDown={(event) => {
          if (event.key === "Enter") event.currentTarget.blur();
        }}
        placeholder="Typed on job card"
        className="h-8 w-36 border border-[#d7d3c8] bg-white px-2 text-right text-[11px] tabular-nums outline-none placeholder:text-[#b5b1a6] focus:border-[#167c73] disabled:opacity-40"
      />
    </div>
  );
}

function NameList({
  items,
  canEdit,
  placeholder,
  empty,
  onAdd,
  onRename,
  onRemove,
}: {
  items: Named[];
  canEdit: boolean;
  placeholder: string;
  empty: string;
  onAdd: (name: string) => Promise<boolean>;
  onRename: (item: Named, name: string) => Promise<boolean>;
  onRemove: (item: Named) => void;
}) {
  const [draft, setDraft] = useState("");

  async function submit(event: KeyboardEvent<HTMLInputElement>) {
    if (event.key !== "Enter") return;
    event.preventDefault();
    const name = draft.trim();
    if (!name) return;
    if (await onAdd(name)) setDraft("");
  }

  return (
    <div className="mt-3 divide-y divide-[#e2ded4] border border-[#e2ded4] bg-white">
      {items.map((item) => (
        <NameRow key={item.id} item={item} canEdit={canEdit} onRename={onRename} onRemove={onRemove} />
      ))}
      {items.length === 0 && !canEdit && <p className="px-3 py-3 text-xs text-[#6f746e]">{empty}</p>}
      {canEdit && (
        <div className="px-2 py-1.5">
          <input
            value={draft}
            onChange={(event) => setDraft(event.target.value)}
            onKeyDown={(event) => void submit(event)}
            placeholder={placeholder}
            className="h-8 w-full border border-dashed border-[#c9c5b9] bg-[#fbfaf6] px-2 text-[11px] outline-none focus:border-[#167c73] focus:bg-white"
          />
        </div>
      )}
    </div>
  );
}

function NameRow({
  item,
  canEdit,
  onRename,
  onRemove,
}: {
  item: Named;
  canEdit: boolean;
  onRename: (item: Named, name: string) => Promise<boolean>;
  onRemove: (item: Named) => void;
}) {
  const [name, setName] = useState(item.name);

  async function save() {
    const next = name.trim();
    if (!next) {
      setName(item.name);
      return;
    }
    if (next === item.name) return;
    if (!(await onRename(item, next))) setName(item.name);
  }

  if (!canEdit) {
    return <p className="px-3 py-2 text-[12px] font-semibold">{item.name}</p>;
  }

  return (
    <div className="flex items-center gap-1 px-2 py-1">
      <input
        value={name}
        onChange={(event) => setName(event.target.value)}
        onBlur={() => void save()}
        onKeyDown={(event) => {
          if (event.key === "Enter") event.currentTarget.blur();
        }}
        className="h-8 w-full min-w-0 border border-transparent bg-transparent px-1.5 text-[12px] font-semibold outline-none hover:border-[#d7d3c8] focus:border-[#167c73] focus:bg-white"
      />
      <button type="button" onClick={() => onRemove(item)} className="shrink-0 p-1.5 text-[#b84837]" aria-label={`Delete ${item.name}`}>
        <Trash2 size={14} />
      </button>
    </div>
  );
}
