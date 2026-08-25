"use client";

import { FormEvent, useEffect, useState } from "react";
import { AppShell } from "@/components/app-shell";
import { AddressField } from "@/components/address-field";
import { ErrorMessage, PageState, Panel, SuccessMessage, buttonClass, inputClass } from "@/components/ui";
import { api, currentFeatures, currentUser, mediaUrl, storeSession, User } from "@/lib/api";

export default function ProfilePage() {
  const [user, setUser] = useState<User | null>(null);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [saving, setSaving] = useState(false);
  const [logoPreview, setLogoPreview] = useState<string | null>(null);

  useEffect(() => {
    setUser(currentUser());
    api<{ user: User }>("/user").then((result) => setUser(result.user)).catch((caught) => setError(caught.message));
  }, []);

  const isOwner = user?.role === "business_owner";
  const tenant = user?.tenant;

  async function saveBusiness(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSaving(true);
    setError("");
    setNotice("");
    const formData = new FormData(event.currentTarget);
    try {
      const updated = await api<NonNullable<User["tenant"]>>("/tenant/profile", { method: "POST", body: formData });
      const next = { ...user!, tenant: { ...tenant!, ...updated } };
      setUser(next);
      const token = localStorage.getItem("garage_token");
      if (token) storeSession(token, next, currentFeatures());
      setNotice("Shop details saved.");
      setLogoPreview(null);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Could not save shop details.");
    } finally {
      setSaving(false);
    }
  }

  async function saveMe(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSaving(true);
    setError("");
    setNotice("");
    const data = Object.fromEntries(new FormData(event.currentTarget));
    try {
      const updated = await api<User>("/me", { method: "PUT", body: JSON.stringify({ name: data.name, phone: data.phone || null }) });
      setUser((current) => current ? { ...current, ...updated, tenant: current.tenant } : updated);
      setNotice("Your details were saved.");
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Could not save your details.");
    } finally {
      setSaving(false);
    }
  }

  if (!user) {
    return <AppShell title="Profile"><PageState message="Loading..." /></AppShell>;
  }

  const logo = logoPreview || mediaUrl(tenant?.logo_url || tenant?.logo);

  return (
    <AppShell title={isOwner ? "Shop details" : "My details"} eyebrow={isOwner ? "Your business identity" : "Your staff profile"}>
      {error && <div className="mb-5"><ErrorMessage message={error} /></div>}
      {notice && <div className="mb-5"><SuccessMessage message={notice} /></div>}

      {isOwner && tenant ? (
        <Panel className="max-w-2xl p-5">
          <form onSubmit={saveBusiness} className="grid gap-4">
            <label className="text-xs font-bold uppercase">
              Business name
              <input name="business_name" defaultValue={tenant.business_name} required className={`${inputClass} mt-2`} />
            </label>
            <label className="text-xs font-bold uppercase">
              Owner name
              <input name="owner_name" defaultValue={user.name} className={`${inputClass} mt-2`} />
            </label>
            <label className="text-xs font-bold uppercase">
              Owner phone
              <input name="owner_phone" defaultValue={tenant.owner_phone ?? ""} className={`${inputClass} mt-2`} />
            </label>
            <label className="text-xs font-bold uppercase">
              Contact email
              <input name="contact_email" type="email" defaultValue={tenant.contact_email ?? tenant.owner_email ?? ""} className={`${inputClass} mt-2`} />
            </label>
            <AddressField name="address" defaultValue={tenant.address ?? ""} />
            <label className="text-xs font-bold uppercase">
              Logo
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
            {logo ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={logo} alt="" className="h-20 w-20 object-contain border border-[#d7d3c8] bg-white p-1" />
            ) : null}
            <button disabled={saving} className={buttonClass}>{saving ? "Saving..." : "Save shop details"}</button>
          </form>
        </Panel>
      ) : (
        <Panel className="max-w-xl p-5">
          {!user.employee_id && (
            <p className="mb-4 text-sm text-[#9a5b12]">This login is not linked to a team member yet. Ask the owner to link your staff account on Staff access.</p>
          )}
          <form onSubmit={saveMe} className="grid gap-4">
            <label className="text-xs font-bold uppercase">
              Name
              <input name="name" defaultValue={user.name} required className={`${inputClass} mt-2`} />
            </label>
            <label className="text-xs font-bold uppercase">
              Email
              <input value={user.email} readOnly className={`${inputClass} mt-2 bg-[#eeece5]`} />
            </label>
            <label className="text-xs font-bold uppercase">
              Phone
              <input name="phone" defaultValue={user.employee?.phone ?? ""} className={`${inputClass} mt-2`} />
            </label>
            <button disabled={saving} className={buttonClass}>{saving ? "Saving..." : "Save my details"}</button>
          </form>
        </Panel>
      )}
    </AppShell>
  );
}
