"use client";

import { FormEvent, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { Building2, Check, ChevronRight, Plus, Trash2 } from "lucide-react";
import { PlatformShell } from "@/components/platform-shell";
import { AddressField } from "@/components/address-field";
import { ErrorMessage, Panel, PasswordInput, buttonClass, inputClass } from "@/components/ui";
import { api, BusinessType, Tenant } from "@/lib/api";
import { BUSINESS_TYPE_OPTIONS, PAYMENT_PLAN_OPTIONS, PLAN_OPTIONS, defaultPlanFor, profileFor } from "@/lib/business-profiles";
import { groupModules } from "@/lib/feature-modules";

type PhoneRow = { label: string; number: string };

export default function NewTenantPage() {
  const router = useRouter();
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [businessType, setBusinessType] = useState<BusinessType>("garage");
  const [plan, setPlan] = useState(defaultPlanFor("garage"));
  const [paymentPlan, setPaymentPlan] = useState<"monthly" | "yearly">("monthly");
  const [planAmount, setPlanAmount] = useState("");
  const profile = useMemo(() => profileFor(businessType), [businessType]);
  const [features, setFeatures] = useState(profile.defaultFeatures);
  const [logoPreview, setLogoPreview] = useState<string | null>(null);
  const [ownerPhones, setOwnerPhones] = useState<PhoneRow[]>([{ label: "Primary", number: "" }]);
  const [contactPhones, setContactPhones] = useState<PhoneRow[]>([{ label: "Business", number: "" }]);

  useEffect(() => {
    setFeatures(profile.defaultFeatures);
    setPlan(defaultPlanFor(businessType));
  }, [profile, businessType]);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setLoading(true);
    setError("");
    const form = event.currentTarget;
    const formData = new FormData(form);
    formData.set("business_type", businessType);
    formData.set("plan", plan);
    formData.set("payment_plan", paymentPlan);
    formData.set("plan_amount", planAmount);
    formData.set("features", JSON.stringify(features));
    formData.set("owner_phones", JSON.stringify(ownerPhones.filter((p) => p.number.trim())));
    formData.set("contact_phones", JSON.stringify(contactPhones.filter((p) => p.number.trim())));
    formData.set("owner_phone", ownerPhones.find((p) => p.number.trim())?.number ?? "");
    formData.set("vat_registered", formData.get("vat_registered") ? "1" : "0");
    formData.set("sscl_registered", formData.get("sscl_registered") ? "1" : "0");
    formData.set("demo_access", formData.get("demo_access") ? "1" : "0");
    const primaryContact = contactPhones.find((p) => p.number.trim())?.number;
    if (primaryContact) formData.set("contact_phone", primaryContact);
    try {
      const tenant = await api<Tenant & { welcome_email_sent?: boolean }>("/super-admin/tenants", { method: "POST", body: formData });
      const welcome = tenant.welcome_email_sent === false ? "failed" : "sent";
      router.push(`/super-admin/tenants/${tenant.id}?welcome_email=${welcome}`);
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
                <select
                  value={businessType}
                  onChange={(event) => setBusinessType(event.target.value as BusinessType)}
                  className={`mt-2 ${inputClass}`}
                >
                  {BUSINESS_TYPE_OPTIONS.map((option) => (
                    <option key={option.value} value={option.value}>{option.label}</option>
                  ))}
                </select>
              </label>
              <label className="text-sm font-semibold">
                Plan
                <select
                  name="plan"
                  value={plan}
                  onChange={(event) => setPlan(event.target.value)}
                  className={`mt-2 ${inputClass}`}
                >
                  {PLAN_OPTIONS.map((option) => (
                    <option key={option.value} value={option.value}>{option.label}</option>
                  ))}
                </select>
              </label>
              <label className="text-sm font-semibold">
                Payment plan
                <select
                  value={paymentPlan}
                  onChange={(event) => setPaymentPlan(event.target.value as "monthly" | "yearly")}
                  className={`mt-2 ${inputClass}`}
                >
                  {PAYMENT_PLAN_OPTIONS.map((option) => (
                    <option key={option.value} value={option.value}>{option.label}</option>
                  ))}
                </select>
              </label>
              <label className="text-sm font-semibold">
                Amount (LKR)
                <input
                  type="number"
                  min="0"
                  step="0.01"
                  required
                  value={planAmount}
                  onChange={(event) => setPlanAmount(event.target.value)}
                  placeholder={paymentPlan === "monthly" ? "Monthly fee" : "Yearly fee"}
                  className={`mt-2 ${inputClass}`}
                />
              </label>
              <label className="flex items-center gap-2 text-sm font-semibold sm:col-span-2">
                <input name="demo_access" type="checkbox" className="size-4" />
                21-day demo access (auto-deactivates when the days end)
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

              <div className="sm:col-span-2">
                <div className="mb-2 flex items-center justify-between">
                  <p className="text-sm font-semibold">Business phones</p>
                  <button
                    type="button"
                    disabled={contactPhones.length >= 5}
                    onClick={() => setContactPhones((rows) => [...rows, { label: `Phone ${rows.length + 1}`, number: "" }])}
                    className="flex items-center gap-1 text-xs font-bold uppercase text-[#167c73]"
                  >
                    <Plus size={14} /> Add phone
                  </button>
                </div>
                <div className="space-y-2">
                  {contactPhones.map((row, index) => (
                    <div key={`contact-${index}`} className="flex gap-2">
                      <input
                        value={row.label}
                        onChange={(event) => setContactPhones((rows) => rows.map((item, i) => i === index ? { ...item, label: event.target.value } : item))}
                        placeholder="Label"
                        className={`${inputClass} max-w-[140px]`}
                      />
                      <input
                        value={row.number}
                        onChange={(event) => setContactPhones((rows) => rows.map((item, i) => i === index ? { ...item, number: event.target.value } : item))}
                        placeholder="Shown on printed bills"
                        className={inputClass}
                      />
                      {contactPhones.length > 1 && (
                        <button type="button" aria-label="Remove phone" onClick={() => setContactPhones((rows) => rows.filter((_, i) => i !== index))} className="grid size-11 place-items-center border border-[#d7d3c8] text-[#b84837]">
                          <Trash2 size={16} />
                        </button>
                      )}
                    </div>
                  ))}
                </div>
              </div>

              <label className="text-sm font-semibold sm:col-span-2">
                Business email
                <input name="contact_email" type="email" placeholder="Shown on printed bills" className={`mt-2 ${inputClass}`} />
              </label>
              <AddressField name="address" label="Business address" className="sm:col-span-2" placeholder="Shown on printed bills" />
              <label className="text-sm font-semibold">
                TIN
                <input name="tin" className={`mt-2 ${inputClass}`} placeholder="Optional" />
              </label>
              <label className="flex items-center gap-2 text-sm font-semibold">
                <input name="vat_registered" type="checkbox" value="1" className="size-4" />
                VAT registered (18%)
              </label>
              <label className="flex items-center gap-2 text-sm font-semibold">
                <input name="sscl_registered" type="checkbox" value="1" className="size-4" />
                SSCL registered (2.5%)
              </label>
              <label className="text-sm font-semibold">
                Owner name
                <input name="owner_name" required className={`mt-2 ${inputClass}`} />
              </label>
              <label className="text-sm font-semibold">
                Owner email
                <input name="owner_email" type="email" required className={`mt-2 ${inputClass}`} />
              </label>

              <div className="sm:col-span-2">
                <div className="mb-2 flex items-center justify-between">
                  <p className="text-sm font-semibold">Owner phones</p>
                  <button
                    type="button"
                    disabled={ownerPhones.length >= 5}
                    onClick={() => setOwnerPhones((rows) => [...rows, { label: `Phone ${rows.length + 1}`, number: "" }])}
                    className="flex items-center gap-1 text-xs font-bold uppercase text-[#167c73]"
                  >
                    <Plus size={14} /> Add phone
                  </button>
                </div>
                <div className="space-y-2">
                  {ownerPhones.map((row, index) => (
                    <div key={`owner-${index}`} className="flex gap-2">
                      <input
                        value={row.label}
                        onChange={(event) => setOwnerPhones((rows) => rows.map((item, i) => i === index ? { ...item, label: event.target.value } : item))}
                        placeholder="Label"
                        className={`${inputClass} max-w-[140px]`}
                      />
                      <input
                        required={index === 0}
                        value={row.number}
                        onChange={(event) => setOwnerPhones((rows) => rows.map((item, i) => i === index ? { ...item, number: event.target.value } : item))}
                        placeholder="Owner mobile"
                        className={inputClass}
                      />
                      {ownerPhones.length > 1 && (
                        <button type="button" aria-label="Remove phone" onClick={() => setOwnerPhones((rows) => rows.filter((_, i) => i !== index))} className="grid size-11 place-items-center border border-[#d7d3c8] text-[#b84837]">
                          <Trash2 size={16} />
                        </button>
                      )}
                    </div>
                  ))}
                </div>
              </div>

              <label className="text-sm font-semibold sm:col-span-2">
                Temporary password
                <div className="mt-2">
                  <PasswordInput name="password" minLength={8} required className={inputClass} />
                </div>
              </label>
            </div>
          </Panel>
          {error && <ErrorMessage message={error} />}
        </div>
        <Panel className="h-fit p-5">
          <p className="text-xs font-bold uppercase text-[#167c73]">{profile.label} plan</p>
          <h2 className="mt-2 font-display text-3xl font-semibold uppercase">Shape the plan</h2>
          <p className="mt-2 text-sm text-[#6f746e]">Modules switch when you change business type — only what fits {profile.label.toLowerCase()}.</p>
          <div className="mt-6 space-y-5">
            {groupModules(profile.moduleCatalog).map(({ group, features: modules }) => (
              <div key={group}>
                <p className="mb-2 text-[10px] font-bold uppercase tracking-wide text-[#6f746e]">{group}</p>
                <div className="space-y-2">
                  {modules.map((module) => {
                    const enabled = features.includes(module.key);
                    return (
                      <button
                        type="button"
                        key={module.key}
                        onClick={() => setFeatures((value) => enabled ? value.filter((item) => item !== module.key) : [...value, module.key])}
                        className={`flex h-12 w-full items-center justify-between border px-3 text-left text-sm font-semibold ${enabled ? "border-[#167c73] bg-[#167c73]/7" : "border-[#d7d3c8] text-[#6f746e]"}`}
                      >
                        <span>{module.name}</span>
                        <span className={`grid size-6 place-items-center ${enabled ? "bg-[#167c73] text-white" : "bg-[#e7e4db]"}`}>
                          {enabled && <Check size={15} />}
                        </span>
                      </button>
                    );
                  })}
                </div>
              </div>
            ))}
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
