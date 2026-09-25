"use client";

import { FormEvent, useCallback, useEffect, useState, useSyncExternalStore } from "react";
import { Plus, Trash2 } from "lucide-react";
import { AppShell } from "@/components/app-shell";
import { GarageServiceList } from "@/components/garage-service-list";
import { ErrorMessage, PageState, Panel, buttonClass, inputClass } from "@/components/ui";
import { api, currentFeatures, currentUser, money } from "@/lib/api";
import { allowsServiceJobs } from "@/lib/business-profiles";

type PaintPackage = {
  id: number;
  name: string;
  price: string;
};

const noopSubscribe = () => () => {};

export default function ServiceAddonsPage() {
  const businessType = useSyncExternalStore(
    noopSubscribe,
    () => currentUser()?.tenant?.business_type ?? "",
    () => null,
  );

  if (businessType === null) {
    return <AppShell title="Service addons"><PageState message="Loading..." /></AppShell>;
  }
  if (businessType === "garage") {
    return allowsServiceJobs("garage", currentFeatures())
      ? <GarageServiceList />
      : (
        <AppShell title="Service addons">
          <PageState message="Service jobs are off for this shop. Super-admin can enable them under Admit vehicle." />
        </AppShell>
      );
  }
  return <PaintPackagesPage />;
}

function PaintPackagesPage() {
  const isOwner = useSyncExternalStore(noopSubscribe, () => currentUser()?.role === "business_owner", () => false);
  const [packages, setPackages] = useState<PaintPackage[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  const load = useCallback(() => {
    return api<PaintPackage[]>("/service-addons")
      .then(setPackages)
      .catch((caught) => setError(caught instanceof Error ? caught.message : "Could not load paint packages."))
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  async function create(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!isOwner) return;
    const form = event.currentTarget;
    const data = new FormData(form);
    setError("");
    try {
      await api("/service-addons", {
        method: "POST",
        body: JSON.stringify({ name: data.get("name"), price: Number(data.get("price")) }),
      });
      form.reset();
      await load();
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Unable to save package.");
    }
  }

  async function savePrice(item: PaintPackage, price: string) {
    setSaving(true);
    setError("");
    try {
      await api(`/service-addons/${item.id}`, { method: "PUT", body: JSON.stringify({ price: Number(price) }) });
      await load();
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Unable to update price.");
    } finally {
      setSaving(false);
    }
  }

  async function remove(id: number) {
    setError("");
    try {
      await api(`/service-addons/${id}`, { method: "DELETE" });
      await load();
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Unable to delete package.");
    }
  }

  return (
    <AppShell title="Paint packages" eyebrow="Buttons on paint-package jobs">
      {!isOwner && <p className="mb-5 text-sm text-[#6f746e]">Only the owner can add, price, or remove these buttons.</p>}
      {error && <div className="mb-5"><ErrorMessage message={error} /></div>}
      <div className="grid gap-5 xl:grid-cols-[0.9fr_1.1fr]">
        {isOwner && (
          <Panel className="p-5">
            <h2 className="font-display text-2xl font-semibold uppercase">Add a package</h2>
            <p className="mt-1 text-sm text-[#6f746e]">Staff tap it on paint-package jobs to add the priced line.</p>
            <form onSubmit={create} className="mt-4 space-y-3">
              <input name="name" required placeholder="e.g. Bumper respray" className={inputClass} />
              <input name="price" required type="number" min="0" step="0.01" placeholder="Amount" className={inputClass} />
              <button className={buttonClass}><Plus size={16} /> Save package</button>
            </form>
          </Panel>
        )}
        <Panel className={isOwner ? "" : "xl:col-span-2"}>
          {loading ? <PageState message="Loading paint packages..." /> : (
            <div className="divide-y divide-[#e2ded4]">
              {packages.map((item) => (
                <PackageRow key={item.id} item={item} canEdit={isOwner} busy={saving} onSavePrice={savePrice} onRemove={remove} />
              ))}
              {packages.length === 0 && <p className="p-8 text-center text-sm text-[#6f746e]">No paint packages yet.</p>}
            </div>
          )}
        </Panel>
      </div>
    </AppShell>
  );
}

function PackageRow({
  item,
  canEdit,
  busy,
  onSavePrice,
  onRemove,
}: {
  item: PaintPackage;
  canEdit: boolean;
  busy: boolean;
  onSavePrice: (item: PaintPackage, price: string) => void;
  onRemove: (id: number) => void;
}) {
  const [price, setPrice] = useState(String(Number(item.price)));

  return (
    <div className="flex flex-wrap items-center justify-between gap-3 px-5 py-4">
      <div>
        <p className="font-semibold">{item.name}</p>
        {!canEdit && <p className="text-sm text-[#6f746e]">{money(item.price)}</p>}
      </div>
      {canEdit && (
        <div className="flex items-center gap-2">
          <input
            type="number"
            min="0"
            step="0.01"
            value={price}
            onChange={(event) => setPrice(event.target.value)}
            onBlur={() => {
              if (!busy && price !== String(Number(item.price))) onSavePrice(item, price);
            }}
            className={`${inputClass} w-32`}
          />
          <button type="button" onClick={() => onRemove(item.id)} className="text-[#b84837]" aria-label={`Delete ${item.name}`}>
            <Trash2 size={16} />
          </button>
        </div>
      )}
    </div>
  );
}
