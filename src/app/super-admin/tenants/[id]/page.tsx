"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { FormEvent, useEffect, useState } from "react";
import { Check, Plus, Power, Trash2, Users } from "lucide-react";
import { PlatformShell } from "@/components/platform-shell";
import { ErrorMessage, PageState, Panel, buttonClass, inputClass } from "@/components/ui";
import { api, mediaUrl, PhoneEntry, Tenant } from "@/lib/api";
import { profileFor } from "@/lib/business-profiles";
import { groupModules } from "@/lib/feature-modules";

type Feature = { id: number; key: string; name: string; group?: string | null };
type Detail = Tenant & {
  owner_name: string;
  owner_email: string;
  owner_phone: string;
  plan: string | null;
  users_count: number;
  users: Array<{ id: number; name: string; email: string; role: string; status: string }>;
  features: Feature[];
};
type FeatureResponse = { available: Feature[]; enabled: string[]; business_type?: string };

export default function TenantDetailPage() {
  const { id } = useParams<{ id: string }>();
  const [tenant, setTenant] = useState<Detail | null>(null);
  const [featureData, setFeatureData] = useState<FeatureResponse | null>(null);
  const [enabled, setEnabled] = useState<string[]>([]);
  const [contactPhones, setContactPhones] = useState<PhoneEntry[]>([{ label: "Business", number: "" }]);
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);
  const [logoSaving, setLogoSaving] = useState(false);

  function load() {
    Promise.all([
      api<Detail>(`/super-admin/tenants/${id}`),
      api<FeatureResponse>(`/super-admin/tenants/${id}/features`),
    ])
      .then(([detail, features]) => {
        setTenant(detail);
        setFeatureData(features);
        setEnabled(features.enabled);
        const phones = detail.contact_phones?.length
          ? detail.contact_phones
          : [{ label: "Business", number: detail.contact_phone || detail.owner_phone || "" }];
        setContactPhones(phones);
      })
      .catch((caught) => setError(caught.message));
  }

  useEffect(load, [id]);

  async function changeStatus() {
    if (!tenant) return;
    setError("");
    try {
      const result = await api<Detail>(`/super-admin/tenants/${id}/${tenant.status === "active" ? "deactivate" : "activate"}`, { method: "POST" });
      setTenant({ ...tenant, status: result.status });
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Unable to change status.");
    }
  }

  async function saveFeatures() {
    if (!featureData) return;
    setSaving(true);
    setError("");
    try {
      const result = await api<FeatureResponse>(`/super-admin/tenants/${id}/features`, {
        method: "PUT",
        body: JSON.stringify({
          features: Object.fromEntries(featureData.available.map((feature) => [feature.key, enabled.includes(feature.key)])),
        }),
      });
      setEnabled(result.enabled);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Unable to update features.");
    } finally {
      setSaving(false);
    }
  }

  async function uploadLogo(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setLogoSaving(true);
    setError("");
    const form = event.currentTarget;
    const formData = new FormData(form);
    formData.set("contact_phones", JSON.stringify(contactPhones.filter((p) => p.number.trim())));
    if (contactPhones.find((p) => p.number.trim())) {
      formData.set("contact_phone", contactPhones.find((p) => p.number.trim())!.number);
    }
    try {
      const updated = await api<Detail>(`/super-admin/tenants/${id}`, { method: "POST", body: formData });
      setTenant((current) => current ? { ...current, ...updated } : updated);
      form.reset();
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Unable to upload logo.");
    } finally {
      setLogoSaving(false);
    }
  }

  const logo = mediaUrl(tenant?.logo_url || tenant?.logo);
  const profile = profileFor(tenant?.business_type);

  return (
    <PlatformShell
      title={tenant?.business_name ?? "Tenant details"}
      eyebrow="Business control"
      action={tenant && (
        <button
          onClick={changeStatus}
          className={`flex h-10 items-center gap-2 px-4 text-sm font-semibold text-white ${tenant.status === "active" ? "bg-[#b84837]" : "bg-[#167c73]"}`}
        >
          <Power size={17} />{tenant.status === "active" ? "Deactivate" : "Activate"}
        </button>
      )}
    >
      {error && <div className="mb-5"><ErrorMessage message={error} /></div>}
      {!tenant || !featureData ? (
        <PageState message="Loading tenant controls..." />
      ) : (
        <div className="grid gap-5 xl:grid-cols-[0.75fr_1.25fr]">
          <div className="space-y-5">
            <Panel className="p-5">
              <div className="flex items-start justify-between gap-3">
                <div className="flex min-w-0 items-start gap-3">
                  {logo ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={logo} alt="" className="h-14 w-14 object-contain border border-[#d7d3c8] bg-white p-1" />
                  ) : null}
                  <div>
                    <p className="text-xs font-bold uppercase text-[#167c73]">{profile.label}</p>
                    <h2 className="mt-1 font-display text-3xl font-semibold uppercase">{tenant.business_name}</h2>
                  </div>
                </div>
                <span className={`px-2 py-1 text-[10px] font-bold uppercase ${tenant.status === "active" ? "bg-[#167c73]/10 text-[#167c73]" : "bg-[#b84837]/10 text-[#b84837]"}`}>
                  {tenant.status}
                </span>
              </div>
              <dl className="mt-7 space-y-3 text-sm">
                <div className="flex justify-between border-b border-[#e2ded4] pb-3"><dt className="text-[#6f746e]">Owner</dt><dd className="font-semibold">{tenant.owner_name}</dd></div>
                <div className="flex justify-between border-b border-[#e2ded4] pb-3"><dt className="text-[#6f746e]">Email</dt><dd>{tenant.owner_email}</dd></div>
                <div className="flex justify-between border-b border-[#e2ded4] pb-3"><dt className="text-[#6f746e]">Plan</dt><dd>{tenant.plan ?? "Custom"}</dd></div>
                <div className="flex justify-between border-b border-[#e2ded4] pb-3"><dt className="text-[#6f746e]">Payment plan</dt><dd className="capitalize">{tenant.payment_plan ?? "monthly"}</dd></div>
                <div className="flex justify-between border-b border-[#e2ded4] pb-3"><dt className="text-[#6f746e]">Amount</dt><dd>{tenant.plan_amount != null ? `LKR ${Number(tenant.plan_amount).toLocaleString("en-LK", { minimumFractionDigits: 2 })}` : "—"}</dd></div>
                <div className="flex justify-between"><dt className="text-[#6f746e]">Users</dt><dd>{tenant.users_count}</dd></div>
              </dl>
              <Link href={`/super-admin/tenants/${id}/users`} className={`${buttonClass} mt-6 w-full`}>
                <Users size={18} />Manage tenant users
              </Link>
            </Panel>

            <Panel className="p-5">
              <h2 className="font-display text-2xl font-semibold uppercase">Bill branding</h2>
              <p className="mt-2 text-sm text-[#6f746e]">Logo and contact details appear at the top of every printed bill.</p>
              <form onSubmit={uploadLogo} className="mt-4 space-y-4">
                <div>
                  <div className="mb-2 flex items-center justify-between">
                    <p className="text-xs font-bold uppercase">Business phones</p>
                    <button
                      type="button"
                      disabled={contactPhones.length >= 5}
                      onClick={() => setContactPhones((rows) => [...rows, { label: `Phone ${rows.length + 1}`, number: "" }])}
                      className="flex items-center gap-1 text-xs font-bold uppercase text-[#167c73]"
                    >
                      <Plus size={14} /> Add
                    </button>
                  </div>
                  <div className="space-y-2">
                    {contactPhones.map((row, index) => (
                      <div key={index} className="flex gap-2">
                        <input
                          value={row.label ?? ""}
                          onChange={(event) => setContactPhones((rows) => rows.map((item, i) => i === index ? { ...item, label: event.target.value } : item))}
                          placeholder="Label"
                          className={`${inputClass} max-w-[120px]`}
                        />
                        <input
                          value={row.number}
                          onChange={(event) => setContactPhones((rows) => rows.map((item, i) => i === index ? { ...item, number: event.target.value } : item))}
                          placeholder="Phone"
                          className={inputClass}
                        />
                        {contactPhones.length > 1 && (
                          <button type="button" onClick={() => setContactPhones((rows) => rows.filter((_, i) => i !== index))} className="grid size-11 place-items-center border border-[#d7d3c8] text-[#b84837]" aria-label="Remove">
                            <Trash2 size={16} />
                          </button>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
                <label className="block text-xs font-bold uppercase">
                  Business email
                  <input name="contact_email" type="email" defaultValue={tenant.contact_email || tenant.owner_email || ""} className={`${inputClass} mt-2`} />
                </label>
                <label className="block text-xs font-bold uppercase">
                  Logo image
                  <input name="logo" type="file" accept="image/*" className="mt-2 block w-full border border-[#c9c5b9] bg-white p-3 text-sm" />
                </label>
                <button disabled={logoSaving} className={buttonClass}>{logoSaving ? "Saving..." : "Save branding"}</button>
              </form>
            </Panel>
          </div>

          <Panel className="p-5">
            <p className="text-xs font-bold uppercase text-[#167c73]">{profile.label} feature plan</p>
            <h2 className="mt-1 font-display text-3xl font-semibold uppercase">Available modules</h2>
            <p className="mt-2 text-sm text-[#6f746e]">Only modules that fit this business type are shown. Disabling one removes it from that business sidebar immediately.</p>
            <div className="mt-6 space-y-6">
              {groupModules(featureData.available).map(({ group, features }) => (
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
                          className={`flex min-h-14 items-center justify-between border px-4 py-2 text-left text-sm font-semibold ${active ? "border-[#167c73] bg-[#167c73]/7" : "border-[#d7d3c8] text-[#6f746e]"}`}
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
            <button onClick={saveFeatures} disabled={saving} className={`${buttonClass} mt-6`}>
              {saving ? "Saving..." : "Save feature plan"}
            </button>
          </Panel>
        </div>
      )}
    </PlatformShell>
  );
}
