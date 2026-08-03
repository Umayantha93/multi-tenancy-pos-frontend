"use client";

import { FormEvent, useState } from "react";
import { useRouter } from "next/navigation";
import { Building2, Check, ChevronRight } from "lucide-react";
import { PlatformShell } from "@/components/platform-shell";
import { ErrorMessage, Panel, buttonClass, inputClass } from "@/components/ui";
import { api, Tenant } from "@/lib/api";

const modules = [
  ["admit_vehicle", "Vehicle admission"],
  ["billing", "Billing and job cards"],
  ["parts_inventory", "Parts inventory"],
  ["employees_management", "Employee management"],
  ["payroll", "Payroll"],
  ["balance_sheet", "Finance"],
  ["reports", "Reports"],
];

export default function NewTenantPage() {
  const router = useRouter();
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [features, setFeatures] = useState(modules.map(([key]) => key));
  const [logoPreview, setLogoPreview] = useState<string | null>(null);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setLoading(true);
    setError("");
    const form = event.currentTarget;
    const formData = new FormData(form);
    formData.set("features", JSON.stringify(features));
    try {
      const tenant = await api<Tenant>("/super-admin/tenants", { method: "POST", body: formData });
      router.push(`/super-admin/tenants/${tenant.id}`);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Unable to onboard business.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <PlatformShell title="Onboard business" eyebrow="Tenant setup">
      <form onSubmit={submit} className="grid gap-5 xl:grid-cols-[1fr_0.7fr]">
        <div className="space-y-5">
          <Panel className="p-5">
            <div className="mb-6 flex items-center gap-3">
              <span className="grid size-10 place-items-center bg-[#f5c842]"><Building2 size={20} /></span>
              <div>
                <h2 className="font-display text-2xl font-semibold uppercase">Business identity</h2>
                <p className="text-xs text-[#6f746e]">Tenant and initial owner account</p>
              </div>
            </div>
            <div className="grid gap-4 sm:grid-cols-2">
              <label className="text-sm font-semibold sm:col-span-2">
                Business name
                <input name="business_name" required className={`mt-2 ${inputClass}`} />
              </label>
              <label className="text-sm font-semibold">
                Business type
                <select name="business_type" className={`mt-2 ${inputClass}`}>
                  <option value="garage">Garage</option>
                  <option value="cottage">Cottage</option>
                  <option value="shop">Shop</option>
                  <option value="supermarket">Supermarket</option>
                </select>
              </label>
              <label className="text-sm font-semibold">
                Plan
                <input name="plan" placeholder="Growth, custom..." className={`mt-2 ${inputClass}`} />
              </label>
              <label className="text-sm font-semibold sm:col-span-2">
                Business logo
                <input
                  name="logo"
                  type="file"
                  accept="image/*"
                  className="mt-2 block w-full border border-[#c9c5b9] bg-white p-3 text-sm"
                  onChange={(event) => {
                    const file = event.target.files?.[0];
                    setLogoPreview(file ? URL.createObjectURL(file) : null);
                  }}
                />
              </label>
              {logoPreview && (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={logoPreview} alt="" className="h-20 w-auto object-contain sm:col-span-2" />
              )}
              <label className="text-sm font-semibold">
                Business mobile
                <input name="contact_phone" placeholder="Shown on printed bills" className={`mt-2 ${inputClass}`} />
              </label>
              <label className="text-sm font-semibold">
                Business email
                <input name="contact_email" type="email" placeholder="Shown on printed bills" className={`mt-2 ${inputClass}`} />
              </label>
              <label className="text-sm font-semibold">
                Owner name
                <input name="owner_name" required className={`mt-2 ${inputClass}`} />
              </label>
              <label className="text-sm font-semibold">
                Owner phone
                <input name="owner_phone" required className={`mt-2 ${inputClass}`} />
              </label>
              <label className="text-sm font-semibold">
                Owner email
                <input name="owner_email" type="email" required className={`mt-2 ${inputClass}`} />
              </label>
              <label className="text-sm font-semibold">
                Temporary password
                <input name="password" type="password" minLength={8} required className={`mt-2 ${inputClass}`} />
              </label>
            </div>
          </Panel>
          {error && <ErrorMessage message={error} />}
        </div>
        <Panel className="h-fit p-5">
          <p className="text-xs font-bold uppercase text-[#167c73]">Enabled modules</p>
          <h2 className="mt-2 font-display text-3xl font-semibold uppercase">Shape the plan</h2>
          <div className="mt-6 space-y-2">
            {modules.map(([key, label]) => {
              const enabled = features.includes(key);
              return (
                <button
                  type="button"
                  key={key}
                  onClick={() => setFeatures((value) => enabled ? value.filter((item) => item !== key) : [...value, key])}
                  className={`flex h-12 w-full items-center justify-between border px-3 text-left text-sm font-semibold ${enabled ? "border-[#167c73] bg-[#167c73]/7" : "border-[#d7d3c8] text-[#6f746e]"}`}
                >
                  <span>{label}</span>
                  <span className={`grid size-6 place-items-center ${enabled ? "bg-[#167c73] text-white" : "bg-[#e7e4db]"}`}>
                    {enabled && <Check size={15} />}
                  </span>
                </button>
              );
            })}
          </div>
          <button disabled={loading} className={`${buttonClass} mt-6 w-full justify-between`}>
            {loading ? "Creating tenant..." : "Create tenant and owner"}
            <ChevronRight size={18} />
          </button>
        </Panel>
      </form>
    </PlatformShell>
  );
}
