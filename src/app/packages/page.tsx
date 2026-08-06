"use client";

import { FormEvent, useEffect, useState } from "react";
import { Plus, Trash2 } from "lucide-react";
import { AppShell } from "@/components/app-shell";
import { ErrorMessage, PageState, Panel, buttonClass, inputClass } from "@/components/ui";
import { api, money } from "@/lib/api";

type Package = {
  id: number;
  name: string;
  price: string;
  duration_minutes: number | null;
  description: string | null;
  active: boolean;
};

export default function PackagesPage() {
  const [packages, setPackages] = useState<Package[]>([]);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);

  function load() {
    setLoading(true);
    api<Package[]>("/photo-packages")
      .then(setPackages)
      .catch((caught) => setError(caught.message))
      .finally(() => setLoading(false));
  }

  useEffect(load, []);

  async function create(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");
    const form = event.currentTarget;
    const data = new FormData(form);
    try {
      await api("/photo-packages", {
        method: "POST",
        body: JSON.stringify({
          name: data.get("name"),
          price: Number(data.get("price")),
          duration_minutes: data.get("duration_minutes") ? Number(data.get("duration_minutes")) : null,
          description: data.get("description") || null,
        }),
      });
      form.reset();
      load();
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Unable to save package.");
    }
  }

  async function remove(id: number) {
    try {
      await api(`/photo-packages/${id}`, { method: "DELETE" });
      load();
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Unable to delete.");
    }
  }

  return (
    <AppShell title="Packages" eyebrow="Session offerings">
      <div className="grid gap-5 xl:grid-cols-[0.9fr_1.1fr]">
        <Panel className="p-5">
          <h2 className="font-display text-2xl font-semibold uppercase">Add package</h2>
          <form onSubmit={create} className="mt-4 space-y-3">
            <input name="name" required placeholder="Package name" className={inputClass} />
            <input name="price" required type="number" min="0" step="0.01" placeholder="Price" className={inputClass} />
            <input name="duration_minutes" type="number" min="15" placeholder="Duration (minutes)" className={inputClass} />
            <textarea name="description" rows={3} placeholder="What's included" className={inputClass} />
            <button className={buttonClass}><Plus size={16} /> Save package</button>
          </form>
        </Panel>
        <Panel>
          {error && <div className="p-4"><ErrorMessage message={error} /></div>}
          {loading ? <PageState message="Loading packages..." /> : (
            <div className="divide-y divide-[#e2ded4]">
              {packages.map((pkg) => (
                <div key={pkg.id} className="flex items-start justify-between gap-3 px-5 py-4">
                  <div>
                    <p className="font-semibold">{pkg.name}</p>
                    <p className="text-sm text-[#6f746e]">{money(pkg.price)}{pkg.duration_minutes ? ` · ${pkg.duration_minutes} min` : ""}</p>
                    {pkg.description && <p className="mt-1 text-sm text-[#6f746e]">{pkg.description}</p>}
                  </div>
                  <button type="button" onClick={() => remove(pkg.id)} className="text-[#b84837]" aria-label="Delete package"><Trash2 size={16} /></button>
                </div>
              ))}
              {packages.length === 0 && <p className="p-8 text-center text-sm text-[#6f746e]">No packages yet.</p>}
            </div>
          )}
        </Panel>
      </div>
    </AppShell>
  );
}
