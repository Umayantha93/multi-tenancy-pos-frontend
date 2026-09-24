"use client";

import { FormEvent, useEffect, useMemo, useState } from "react";
import { Plus, Save, Trash2 } from "lucide-react";
import { AppShell } from "@/components/app-shell";
import { ErrorMessage, PageState, Panel, SuccessMessage, buttonClass, inputClass } from "@/components/ui";
import { api, currentFeatures, currentUser, money } from "@/lib/api";
import { useBusinessProfile } from "@/lib/use-business-profile";
import { allowsServiceJobs } from "@/lib/business-profiles";

type VehicleClass = {
  id: number;
  name: string;
  sort_order: number;
  active: boolean;
};

type ServiceAddon = {
  id: number;
  name: string;
  price: string;
  sort_order: number;
  is_full_service: boolean;
  active: boolean;
  service_vehicle_class_id?: number | null;
  inclusions: Array<{ id: number; name: string }>;
};

export default function ServiceAddonsPage() {
  const [isOwner, setIsOwner] = useState(false);
  const [classes, setClasses] = useState<VehicleClass[]>([]);
  const [selectedClassId, setSelectedClassId] = useState("");
  const [addons, setAddons] = useState<ServiceAddon[]>([]);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [fullPrice, setFullPrice] = useState("");
  const [includedIds, setIncludedIds] = useState<number[]>([]);
  const [savingFull, setSavingFull] = useState(false);
  const [newClassName, setNewClassName] = useState("");
  const [renaming, setRenaming] = useState("");

  const isPaint = useBusinessProfile().type === "paint";
  const profileType = useBusinessProfile().type;
  const serviceAllowed = allowsServiceJobs(profileType, currentFeatures());
  const usesClasses = !isPaint;

  const activeClassId = selectedClassId || (classes[0] ? String(classes[0].id) : "");
  const classAddons = useMemo(
    () => (usesClasses
      ? addons.filter((addon) => String(addon.service_vehicle_class_id ?? "") === activeClassId)
      : addons),
    [addons, activeClassId, usesClasses],
  );
  const regularAddons = useMemo(() => classAddons.filter((addon) => !addon.is_full_service), [classAddons]);
  const fullService = useMemo(() => classAddons.find((addon) => addon.is_full_service) ?? null, [classAddons]);
  const selectedClass = classes.find((row) => String(row.id) === activeClassId) ?? null;

  function loadAddons(classId?: string) {
    const query = usesClasses && classId ? `?service_vehicle_class_id=${classId}` : "";
    return api<ServiceAddon[]>(`/service-addons${query}`).then((result) => {
      setAddons(result);
      const scoped = usesClasses && classId
        ? result.filter((addon) => String(addon.service_vehicle_class_id ?? "") === classId)
        : result;
      const full = scoped.find((addon) => addon.is_full_service);
      setFullPrice(full ? String(Number(full.price)) : "");
      setIncludedIds(full?.inclusions.map((item) => item.id) ?? []);
    });
  }

  function load() {
    setLoading(true);
    setError("");
    const boot = usesClasses
      ? api<VehicleClass[]>("/service-vehicle-classes").then((rows) => {
          const active = rows.filter((row) => row.active !== false);
          setClasses(active);
          const nextId = selectedClassId && active.some((row) => String(row.id) === selectedClassId)
            ? selectedClassId
            : (active[0] ? String(active[0].id) : "");
          setSelectedClassId(nextId);
          setRenaming(active.find((row) => String(row.id) === nextId)?.name ?? "");
          return loadAddons(nextId);
        })
      : loadAddons();

    boot
      .catch((caught) => setError(caught instanceof Error ? caught.message : "Could not load service addons."))
      .finally(() => setLoading(false));
  }

  useEffect(() => {
    setIsOwner(currentUser()?.role === "business_owner");
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function switchClass(nextId: string) {
    setSelectedClassId(nextId);
    setRenaming(classes.find((row) => String(row.id) === nextId)?.name ?? "");
    setLoading(true);
    setError("");
    try {
      await loadAddons(nextId);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Could not load services.");
    } finally {
      setLoading(false);
    }
  }

  async function createClass(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!isOwner || !newClassName.trim()) return;
    setError("");
    setNotice("");
    try {
      const created = await api<VehicleClass & { services_copied?: number }>("/service-vehicle-classes", {
        method: "POST",
        body: JSON.stringify({ name: newClassName.trim() }),
      });
      setNewClassName("");
      setClasses((current) => [...current, created]);
      setSelectedClassId(String(created.id));
      setRenaming(created.name);
      setLoading(true);
      try {
        await loadAddons(String(created.id));
        if ((created.services_copied ?? 0) > 0) {
          setNotice("Services copied from an existing type — set prices for this vehicle type.");
        }
      } finally {
        setLoading(false);
      }
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Unable to add vehicle type.");
    }
  }

  async function renameClass() {
    if (!isOwner || !selectedClass || !renaming.trim()) return;
    setError("");
    try {
      const updated = await api<VehicleClass>(`/service-vehicle-classes/${selectedClass.id}`, {
        method: "PUT",
        body: JSON.stringify({ name: renaming.trim() }),
      });
      setClasses((current) => current.map((row) => (row.id === updated.id ? updated : row)));
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Unable to rename vehicle type.");
    }
  }

  async function removeClass(id: number) {
    if (!isOwner) return;
    setError("");
    try {
      await api(`/service-vehicle-classes/${id}`, { method: "DELETE" });
      const next = classes.filter((row) => row.id !== id);
      setClasses(next);
      setSelectedClassId(next[0] ? String(next[0].id) : "");
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Unable to delete vehicle type.");
    }
  }

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
          ...(usesClasses ? { service_vehicle_class_id: Number(activeClassId) } : {}),
        }),
      });
      form.reset();
      await loadAddons(activeClassId || undefined);
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
      await loadAddons(activeClassId || undefined);
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
      await loadAddons(activeClassId || undefined);
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
            ...(usesClasses ? { service_vehicle_class_id: Number(activeClassId) } : {}),
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
            ...(usesClasses ? { service_vehicle_class_id: Number(activeClassId) } : {}),
          }),
        });
      }
      await loadAddons(activeClassId || undefined);
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
    <AppShell title={isPaint ? "Paint packages" : "Service addons"} eyebrow={isPaint ? "Buttons on paint-package jobs" : "Prices by vehicle type on service jobs"}>
      {!serviceAllowed && profileType === "garage" ? (
        <PageState message="Service jobs are off for this shop. Super-admin can enable them under Admit vehicle." />
      ) : (
      <>
      {!isOwner && (
        <p className="mb-5 text-sm text-[#6f746e]">Only the owner can add, price, or remove these buttons.</p>
      )}
      {error && <div className="mb-5"><ErrorMessage message={error} /></div>}
      {notice && <div className="mb-5"><SuccessMessage message={notice} /></div>}

      {usesClasses && (
        <Panel className="mb-5 p-4">
          <div className="flex flex-wrap items-end justify-between gap-3">
            <div>
              <h2 className="font-display text-xl font-semibold uppercase">Vehicle type</h2>
              <p className="mt-1 text-sm text-[#6f746e]">Car, van, bus — each type has its own prices. New types copy service names automatically; set prices after adding.</p>
            </div>
            {isOwner && (
              <form onSubmit={createClass} className="flex flex-wrap items-center gap-2">
                <input
                  value={newClassName}
                  onChange={(event) => setNewClassName(event.target.value)}
                  placeholder="e.g. SUV"
                  className={`${inputClass} w-36`}
                />
                <button className={buttonClass} type="submit"><Plus size={14} /> Add type</button>
              </form>
            )}
          </div>
          <div className="mt-3 flex flex-wrap gap-1">
            {classes.map((row) => (
              <button
                key={row.id}
                type="button"
                onClick={() => void switchClass(String(row.id))}
                className={`h-8 border px-3 text-[11px] font-bold uppercase ${
                  String(row.id) === activeClassId
                    ? "border-[#20221f] bg-[#20221f] text-white"
                    : "border-[#d7d3c8] bg-[#fbfaf6] hover:border-[#20221f]"
                }`}
              >
                {row.name}
              </button>
            ))}
            {classes.length === 0 && <p className="text-sm text-[#6f746e]">No vehicle types yet.</p>}
          </div>
          {isOwner && selectedClass && (
            <div className="mt-3 flex flex-wrap items-center gap-2">
              <input
                value={renaming}
                onChange={(event) => setRenaming(event.target.value)}
                className={`${inputClass} w-40`}
              />
              <button
                type="button"
                onClick={() => void renameClass()}
                disabled={renaming.trim() === selectedClass.name}
                className="h-8 border border-[#c9c5b9] bg-white px-3 text-[11px] font-semibold disabled:opacity-40"
              >
                Rename
              </button>
              <button type="button" onClick={() => void removeClass(selectedClass.id)} className="text-[11px] font-bold uppercase text-[#b84837]">
                Delete type
              </button>
            </div>
          )}
        </Panel>
      )}

      <div className="grid gap-5 xl:grid-cols-[0.9fr_1.1fr]">
        {isOwner && (
          <Panel className="p-5">
            <h2 className="font-display text-2xl font-semibold uppercase">Add a button</h2>
            <p className="mt-1 text-sm text-[#6f746e]">
              {isPaint
                ? "This appears on paint-package jobs. Staff tap it to add the priced line."
                : `This appears on service jobs for ${selectedClass?.name ?? "this vehicle type"}.`}
            </p>
            <form onSubmit={create} className="mt-4 space-y-3">
              <input name="name" required placeholder={isPaint ? "e.g. Bumper respray" : "e.g. Under wash"} className={inputClass} />
              <input name="price" required type="number" min="0" step="0.01" placeholder="Amount" className={inputClass} />
              <button disabled={usesClasses && !activeClassId} className={buttonClass}><Plus size={16} /> Save addon</button>
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
                <p className="p-8 text-center text-sm text-[#6f746e]">{isPaint ? "No paint packages yet." : "No service buttons for this vehicle type yet."}</p>
              )}
            </div>
          )}
        </Panel>
      </div>

      {!isPaint && (
      <Panel className="mt-5 p-5">
        <h2 className="font-display text-2xl font-semibold uppercase">Full service{selectedClass ? ` · ${selectedClass.name}` : ""}</h2>
        <p className="mt-1 text-sm text-[#6f746e]">
          Set the package price and choose which buttons are included for this vehicle type.
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
              disabled={!isOwner || (usesClasses && !activeClassId)}
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
            {regularAddons.length === 0 && (
              <p className="mt-2 text-sm text-[#6f746e]">Add regular services for this type before setting Full service inclusions.</p>
            )}
          </div>
          {isOwner && (
            <button disabled={savingFull || (usesClasses && !activeClassId)} className={buttonClass}>
              <Save size={16} />{savingFull ? "Saving..." : "Save full service"}
            </button>
          )}
        </form>
      </Panel>
      )}
      </>
      )}
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
            className="h-8 border border-[#c9c5b9] bg-white px-3 text-[11px] font-semibold disabled:opacity-40"
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
