"use client";

import { FormEvent, useEffect, useState } from "react";
import { Check, Power, UserPlus } from "lucide-react";
import { AppShell } from "@/components/app-shell";
import { ErrorMessage, PageState, Panel, buttonClass, inputClass } from "@/components/ui";
import { api } from "@/lib/api";
import { groupModules } from "@/lib/feature-modules";

type Feature = { id: number; key: string; name: string; group?: string | null; pivot?: { can_access: boolean } };
type Staff = { id: number; name: string; email: string; status: "active" | "inactive"; permissions: Feature[] };
type PermissionResponse = { available: Feature[]; permissions: Feature[] };

export default function StaffPage() {
  const [staff, setStaff] = useState<Staff[] | null>(null);
  const [selected, setSelected] = useState<Staff | null>(null);
  const [available, setAvailable] = useState<Feature[]>([]);
  const [enabled, setEnabled] = useState<string[]>([]);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  function load() {
    api<Staff[]>("/tenant/staff").then(setStaff).catch((caught) => setError(caught.message));
  }

  useEffect(load, []);

  async function create(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setLoading(true);
    setError("");
    const form = new FormData(event.currentTarget);
    try {
      await api("/tenant/staff", { method: "POST", body: JSON.stringify(Object.fromEntries(form)) });
      event.currentTarget.reset();
      load();
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Unable to add staff.");
    } finally {
      setLoading(false);
    }
  }

  async function edit(user: Staff) {
    setSelected(user);
    setError("");
    try {
      const result = await api<PermissionResponse>(`/tenant/staff/${user.id}/permissions`);
      setAvailable(result.available);
      setEnabled(result.permissions.filter((feature) => feature.pivot?.can_access).map((feature) => feature.key));
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Unable to load permissions.");
    }
  }

  async function save() {
    if (!selected) return;
    setLoading(true);
    try {
      await api(`/tenant/staff/${selected.id}/permissions`, {
        method: "PUT",
        body: JSON.stringify({
          permissions: Object.fromEntries(available.map((feature) => [feature.key, enabled.includes(feature.key)])),
        }),
      });
      setSelected(null);
      load();
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Unable to save permissions.");
    } finally {
      setLoading(false);
    }
  }

  async function deactivate(user: Staff) {
    try {
      await api(`/tenant/staff/${user.id}/deactivate`, { method: "POST" });
      load();
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Unable to deactivate staff.");
    }
  }

  const grouped = groupModules(available);

  return (
    <AppShell title="Staff access" eyebrow="Owner control">
      <div className="grid gap-5 xl:grid-cols-[1fr_0.55fr]">
        {error && <div className="xl:col-span-2"><ErrorMessage message={error} /></div>}
        {!staff ? (
          <PageState message="Loading staff access..." />
        ) : (
          <Panel>
            <div className="border-b border-[#d7d3c8] px-5 py-4">
              <h2 className="font-display text-2xl font-semibold uppercase">Team permissions</h2>
              <p className="text-xs text-[#6f746e]">Modules follow your tenant plan. Turning one off hides it from that staff member’s sidebar.</p>
            </div>
            <div className="divide-y divide-[#dedad0]">
              {staff.map((user) => (
                <div key={user.id} className="flex flex-wrap items-center gap-4 px-5 py-4">
                  <span className="grid size-10 place-items-center bg-[#e7e4db] font-bold">{user.name.charAt(0)}</span>
                  <div className="min-w-44 flex-1">
                    <strong className="block text-sm">{user.name}</strong>
                    <span className="text-xs text-[#6f746e]">{user.email}</span>
                  </div>
                  <span className={`px-2 py-1 text-[10px] font-bold uppercase ${user.status === "active" ? "bg-[#167c73]/10 text-[#167c73]" : "bg-[#b84837]/10 text-[#b84837]"}`}>
                    {user.status}
                  </span>
                  <button onClick={() => edit(user)} className="h-9 border border-[#cbc7bc] px-3 text-xs font-semibold hover:bg-[#f5c842]">Permissions</button>
                  {user.status === "active" && (
                    <button onClick={() => deactivate(user)} title="Deactivate staff" className="grid size-9 place-items-center border border-[#cbc7bc] text-[#b84837]">
                      <Power size={16} />
                    </button>
                  )}
                </div>
              ))}
              {staff.length === 0 && <p className="p-8 text-center text-sm text-[#6f746e]">No staff accounts yet.</p>}
            </div>
          </Panel>
        )}
        <Panel className="h-fit p-5">
          <div className="flex items-center gap-2">
            <UserPlus size={19} className="text-[#167c73]" />
            <h2 className="font-display text-2xl font-semibold uppercase">Add staff</h2>
          </div>
          <form onSubmit={create} className="mt-5 space-y-4">
            <label className="block text-sm font-semibold">Name<input required name="name" className={`mt-2 ${inputClass}`} /></label>
            <label className="block text-sm font-semibold">Email<input required name="email" type="email" className={`mt-2 ${inputClass}`} /></label>
            <label className="block text-sm font-semibold">Temporary password<input required name="password" type="password" minLength={8} className={`mt-2 ${inputClass}`} /></label>
            <button disabled={loading} className={`${buttonClass} w-full`}>{loading ? "Creating..." : "Create staff account"}</button>
          </form>
        </Panel>
      </div>

      {selected && (
        <div className="fixed inset-0 z-50 grid place-items-center bg-black/50 p-4">
          <Panel className="max-h-[90vh] w-full max-w-2xl overflow-y-auto p-5">
            <div className="flex items-start justify-between gap-4">
              <div>
                <p className="text-xs font-bold uppercase text-[#167c73]">Effective access</p>
                <h2 className="font-display text-3xl font-semibold uppercase">{selected.name}</h2>
                <p className="mt-1 text-sm text-[#6f746e]">Modules are listed under their area. Off = hidden from their sidebar.</p>
              </div>
              <button onClick={() => setSelected(null)} className="text-sm text-[#6f746e]">Close</button>
            </div>
            <div className="mt-6 space-y-6">
              {grouped.map(({ group, features }) => (
                <div key={group}>
                  <p className="mb-2 text-[10px] font-bold uppercase tracking-wide text-[#6f746e]">{group}</p>
                  <div className="grid gap-2 sm:grid-cols-2">
                    {features.map((feature) => {
                      const active = enabled.includes(feature.key);
                      return (
                        <button
                          type="button"
                          key={feature.id}
                          onClick={() => setEnabled((value) => active ? value.filter((key) => key !== feature.key) : [...value, feature.key])}
                          className={`flex min-h-12 items-center justify-between border px-3 py-2 text-left text-sm font-semibold ${active ? "border-[#167c73] bg-[#167c73]/7" : "border-[#d7d3c8] text-[#6f746e]"}`}
                        >
                          <span>{feature.name}</span>
                          <span className={`grid size-6 place-items-center ${active ? "bg-[#167c73] text-white" : "bg-[#e7e4db]"}`}>
                            {active && <Check size={15} />}
                          </span>
                        </button>
                      );
                    })}
                  </div>
                </div>
              ))}
            </div>
            <button onClick={save} disabled={loading} className={`${buttonClass} mt-6 w-full`}>
              {loading ? "Saving..." : "Save permissions"}
            </button>
          </Panel>
        </div>
      )}
    </AppShell>
  );
}
