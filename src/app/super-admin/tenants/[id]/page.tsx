"use client";

import Link from "next/link";
import { useParams, useRouter, useSearchParams } from "next/navigation";
import { FormEvent, useEffect, useState } from "react";
import { Check, Plus, Power, Trash2, Users } from "lucide-react";
import { PlatformShell } from "@/components/platform-shell";
import { AddressField } from "@/components/address-field";
import { ConfirmModal, ErrorMessage, PageState, Panel, SuccessMessage, buttonClass, inputClass } from "@/components/ui";
import { api, mediaUrl, PhoneEntry, Tenant } from "@/lib/api";
import { PAYMENT_PLAN_OPTIONS, PLAN_OPTIONS, profileFor } from "@/lib/business-profiles";
import { groupModules } from "@/lib/feature-modules";

type Feature = { id: number; key: string; name: string; group?: string | null };
type Detail = Tenant & {
  owner_name: string;
  owner_email: string;
  owner_phone: string;
  plan: string | null;
  dual_financial_view_enabled?: boolean;
  current_month_paid?: boolean;
  users_count: number;
  users: Array<{ id: number; name: string; email: string; role: string; status: string; is_secondary_view?: boolean }>;
  features: Feature[];
};
type FeatureResponse = { available: Feature[]; enabled: string[]; business_type?: string };
type FeePayment = {
  id: number;
  year: number;
  month: number;
  period: string;
  amount: number | string;
  paid_at: string;
  notes?: string | null;
  marked_by?: { id: number; name: string; email: string } | null;
};
type FeePaymentsResponse = { current_month_paid: boolean; payments: FeePayment[] };

type ConfirmState = {
  title: string;
  message: string;
  confirmLabel: string;
  tone: "default" | "danger" | "teal";
  action: "status" | "dual-enable" | "dual-disable" | "fee-paid" | "fee-unpaid" | "delete";
};

function money(value: number | string | null | undefined) {
  if (value == null) return "—";
  return `LKR ${Number(value).toLocaleString("en-LK", { minimumFractionDigits: 2 })}`;
}

function periodLabel(period: string) {
  const [year, month] = period.split("-").map(Number);
  if (!year || !month) return period;
  return new Date(year, month - 1, 1).toLocaleString("en-LK", { month: "long", year: "numeric" });
}

export default function TenantDetailPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const searchParams = useSearchParams();
  const [tenant, setTenant] = useState<Detail | null>(null);
  const [featureData, setFeatureData] = useState<FeatureResponse | null>(null);
  const [enabled, setEnabled] = useState<string[]>([]);
  const [contactPhones, setContactPhones] = useState<PhoneEntry[]>([{ label: "Business", number: "" }]);
  const [address, setAddress] = useState("");
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [saving, setSaving] = useState(false);
  const [logoSaving, setLogoSaving] = useState(false);
  const [dualSaving, setDualSaving] = useState(false);
  const [feeSaving, setFeeSaving] = useState(false);
  const [statusSaving, setStatusSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [secondaryName, setSecondaryName] = useState("");
  const [secondaryEmail, setSecondaryEmail] = useState("");
  const [secondaryPassword, setSecondaryPassword] = useState("");
  const [feePayments, setFeePayments] = useState<FeePayment[]>([]);
  const [currentMonthPaid, setCurrentMonthPaid] = useState(false);
  const [confirm, setConfirm] = useState<ConfirmState | null>(null);

  function load() {
    Promise.all([
      api<Detail>(`/super-admin/tenants/${id}`),
      api<FeatureResponse>(`/super-admin/tenants/${id}/features`),
      api<FeePaymentsResponse>(`/super-admin/tenants/${id}/fee-payments`),
    ])
      .then(([detail, features, fees]) => {
        setTenant(detail);
        setFeatureData(features);
        setEnabled(features.enabled);
        setFeePayments(fees.payments);
        setCurrentMonthPaid(fees.current_month_paid);
        const phones = detail.contact_phones?.length
          ? detail.contact_phones
          : [{ label: "Business", number: detail.contact_phone || detail.owner_phone || "" }];
        setContactPhones(phones);
        setAddress(detail.address || "");
      })
      .catch((caught) => setError(caught.message));
  }

  useEffect(load, [id]);

  useEffect(() => {
    const welcome = searchParams.get("welcome_email");
    if (welcome === "sent") {
      setNotice("Tenant created. Login link, email, and temporary password were emailed to the owner.");
    } else if (welcome === "failed") {
      setError("Tenant was created, but the welcome email could not be sent. Check Improvmx settings and resend manually.");
    }
  }, [searchParams]);

  const secondaryUser = tenant?.users?.find((user) => user.is_secondary_view);

  function requestStatusChange() {
    if (!tenant) return;
    const nextInactive = tenant.status === "active";
    setConfirm({
      title: nextInactive ? "Deactivate tenant" : "Activate tenant",
      message: nextInactive
        ? `Deactivate ${tenant.business_name}? All users for this business will be signed out and cannot log in until you activate it again.`
        : `Activate ${tenant.business_name}? Users will be able to sign in again.`,
      confirmLabel: nextInactive ? "Deactivate" : "Activate",
      tone: nextInactive ? "danger" : "teal",
      action: "status",
    });
  }

  function requestDualChange(enable: boolean) {
    if (!tenant) return;
    if (enable) {
      if (!secondaryUser && (!secondaryName.trim() || !secondaryEmail.trim() || secondaryPassword.length < 8)) {
        setError("Enter the secondary login name, email, and a password (at least 8 characters) before enabling.");
        return;
      }
      setConfirm({
        title: "Enable dual financial view",
        message: "Enable Dual Financial View for this tenant? Secondary sees full amounts except labor, which shows at 50%.",
        confirmLabel: "Enable",
        tone: "teal",
        action: "dual-enable",
      });
      return;
    }
    setConfirm({
      title: "Disable dual financial view",
      message: "Disable Dual Financial View? The secondary login will be deactivated and can no longer sign in.",
      confirmLabel: "Disable",
      tone: "danger",
      action: "dual-disable",
    });
  }

  async function changeStatus() {
    if (!tenant) return;
    const nextInactive = tenant.status === "active";
    setStatusSaving(true);
    setError("");
    setNotice("");
    try {
      const result = await api<Detail>(`/super-admin/tenants/${id}/${nextInactive ? "deactivate" : "activate"}`, { method: "POST" });
      setTenant({ ...tenant, status: result.status });
      setNotice(
        nextInactive
          ? `${tenant.business_name} has been deactivated. Tenant users can no longer sign in.`
          : `${tenant.business_name} has been activated. Tenant users can sign in again.`,
      );
      setConfirm(null);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Unable to change tenant status. Please try again.");
    } finally {
      setStatusSaving(false);
    }
  }

  function requestDelete() {
    if (!tenant) return;
    setConfirm({
      title: "Delete tenant permanently",
      message: `Delete ${tenant.business_name}? This removes the business from the active list and signs out all users. Existing data is kept (soft delete) and is not wiped.`,
      confirmLabel: "Delete tenant",
      tone: "danger",
      action: "delete",
    });
  }

  async function deleteTenant() {
    if (!tenant) return;
    setDeleting(true);
    setError("");
    setNotice("");
    try {
      await api(`/super-admin/tenants/${id}`, { method: "DELETE" });
      setConfirm(null);
      router.replace("/super-admin/tenants");
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Unable to delete tenant. Please try again.");
      setDeleting(false);
    }
  }

  async function saveDualFinancialView(enable: boolean) {
    if (!tenant) return;
    setDualSaving(true);
    setError("");
    setNotice("");
    try {
      const result = await api<{ tenant: Detail; secondary_user: Detail["users"][number] | null }>(
        `/super-admin/tenants/${id}/dual-financial-view`,
        {
          method: "PUT",
          body: JSON.stringify({
            enabled: enable,
            ...(enable && !secondaryUser
              ? {
                  secondary_name: secondaryName.trim(),
                  secondary_email: secondaryEmail.trim(),
                  secondary_password: secondaryPassword,
                }
              : {}),
          }),
        },
      );
      setTenant((current) =>
        current
          ? {
              ...current,
              ...result.tenant,
              dual_financial_view_enabled: result.tenant.dual_financial_view_enabled,
              users: result.tenant.users ?? current.users,
            }
          : current,
      );
      setSecondaryPassword("");
      setNotice(
        enable
          ? "Dual Financial View is enabled. The secondary login is active."
          : "Dual Financial View is disabled. The secondary login has been deactivated.",
      );
      setConfirm(null);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Unable to update Dual Financial View. Please try again.");
    } finally {
      setDualSaving(false);
    }
  }

  function requestFeeChange(paid: boolean) {
    if (!tenant) return;
    setConfirm({
      title: paid ? "Mark monthly fee paid" : "Mark monthly fee unpaid",
      message: paid
        ? `Mark ${tenant.business_name}'s fee as paid for the current month (${money(tenant.plan_amount)})?`
        : `Mark ${tenant.business_name}'s fee as unpaid for the current month?`,
      confirmLabel: paid ? "Mark paid" : "Mark unpaid",
      tone: paid ? "teal" : "danger",
      action: paid ? "fee-paid" : "fee-unpaid",
    });
  }

  async function saveFeePayment(paid: boolean) {
    if (!tenant) return;
    const now = new Date();
    const year = now.getFullYear();
    const month = now.getMonth() + 1;
    setFeeSaving(true);
    setError("");
    setNotice("");
    try {
      const result = await api<FeePaymentsResponse>(
        `/super-admin/tenants/${id}/fee-payments/${year}/${month}`,
        { method: "PUT", body: JSON.stringify({ paid }) },
      );
      setFeePayments(result.payments);
      setCurrentMonthPaid(result.current_month_paid);
      setTenant((current) => (current ? { ...current, current_month_paid: result.current_month_paid } : current));
      setNotice(paid ? "Current month marked as paid." : "Current month marked as unpaid.");
      setConfirm(null);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Unable to update fee payment.");
    } finally {
      setFeeSaving(false);
    }
  }

  async function handleConfirm() {
    if (!confirm) return;
    if (confirm.action === "status") await changeStatus();
    if (confirm.action === "delete") await deleteTenant();
    if (confirm.action === "dual-enable") await saveDualFinancialView(true);
    if (confirm.action === "dual-disable") await saveDualFinancialView(false);
    if (confirm.action === "fee-paid") await saveFeePayment(true);
    if (confirm.action === "fee-unpaid") await saveFeePayment(false);
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

  async function saveTenantDetails(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setLogoSaving(true);
    setError("");
    setNotice("");
    const form = event.currentTarget;
    const formData = new FormData(form);
    formData.set("address", address);
    formData.set("contact_phones", JSON.stringify(contactPhones.filter((p) => p.number.trim())));
    if (contactPhones.find((p) => p.number.trim())) {
      formData.set("contact_phone", contactPhones.find((p) => p.number.trim())!.number);
    }
    try {
      const updated = await api<Detail>(`/super-admin/tenants/${id}`, { method: "POST", body: formData });
      setTenant((current) => (current ? { ...current, ...updated } : updated));
      setAddress(updated.address || "");
      setNotice("Tenant details saved.");
      const logoInput = form.querySelector<HTMLInputElement>('input[name="logo"]');
      if (logoInput) logoInput.value = "";
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Unable to save tenant details.");
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
        <div className="flex flex-wrap items-center justify-end gap-2">
          <button
            onClick={requestStatusChange}
            className={`flex h-10 items-center gap-2 px-4 text-sm font-semibold text-white ${tenant.status === "active" ? "bg-[#b84837]" : "bg-[#167c73]"}`}
          >
            <Power size={17} />{tenant.status === "active" ? "Deactivate" : "Activate"}
          </button>
          <button
            onClick={requestDelete}
            className="flex h-10 items-center gap-2 border border-[#b84837] bg-white px-4 text-sm font-semibold text-[#b84837]"
          >
            <Trash2 size={17} /> Delete
          </button>
        </div>
      )}
    >
      <ConfirmModal
        open={Boolean(confirm)}
        title={confirm?.title ?? ""}
        message={confirm?.message ?? ""}
        confirmLabel={confirm?.confirmLabel}
        tone={confirm?.tone}
        busy={dualSaving || statusSaving || feeSaving || deleting}
        onCancel={() => { if (!dualSaving && !statusSaving && !feeSaving && !deleting) setConfirm(null); }}
        onConfirm={handleConfirm}
      />
      {error && <div className="mb-5"><ErrorMessage message={error} /></div>}
      {notice && <div className="mb-5"><SuccessMessage message={notice} /></div>}
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
                <div className="flex justify-between gap-4 border-b border-[#e2ded4] pb-3">
                  <dt className="shrink-0 text-[#6f746e]">Address</dt>
                  <dd className="text-right">{tenant.address || "—"}</dd>
                </div>
                <div className="flex justify-between border-b border-[#e2ded4] pb-3"><dt className="text-[#6f746e]">Plan</dt><dd>{tenant.plan ?? "Custom"}</dd></div>
                <div className="flex justify-between border-b border-[#e2ded4] pb-3"><dt className="text-[#6f746e]">Payment plan</dt><dd className="capitalize">{tenant.payment_plan ?? "monthly"}</dd></div>
                <div className="flex justify-between border-b border-[#e2ded4] pb-3"><dt className="text-[#6f746e]">Amount</dt><dd>{tenant.plan_amount != null ? `LKR ${Number(tenant.plan_amount).toLocaleString("en-LK", { minimumFractionDigits: 2 })}` : "—"}</dd></div>
                <div className="flex justify-between"><dt className="text-[#6f746e]">Users</dt><dd>{tenant.users_count}</dd></div>
              </dl>
              <Link href={`/super-admin/tenants/${id}/users`} className={`${buttonClass} mt-6 w-full`}>
                <Users size={18} />Manage tenant users
              </Link>
              <Link href={`/super-admin/invoices?tenant=${id}`} className="mt-2 inline-flex h-11 w-full items-center justify-center border border-[#20221f] bg-white px-4 text-sm font-semibold hover:bg-[#20221f] hover:text-white">
                Tenants invoices
              </Link>
            </Panel>

            <Panel className="p-5">
              <h2 className="font-display text-2xl font-semibold uppercase">Monthly fee payments</h2>
              <p className="mt-2 text-sm text-[#6f746e]">
                Track SaaS fee collection for this business. Mark the current month paid after payment is received.
              </p>
              {tenant.payment_plan === "monthly" ? (
                <>
                  <div className="mt-4 flex items-center justify-between border border-[#d7d3c8] px-4 py-3">
                    <div>
                      <p className="text-sm font-semibold">
                        Current month · {money(tenant.plan_amount)}
                      </p>
                      <p className="mt-1 text-xs text-[#6f746e]">
                        {periodLabel(`${new Date().getFullYear()}-${String(new Date().getMonth() + 1).padStart(2, "0")}`)}
                      </p>
                    </div>
                    <span
                      className={`px-2 py-1 text-[10px] font-bold uppercase ${
                        currentMonthPaid ? "bg-[#167c73]/10 text-[#167c73]" : "bg-[#b84837]/10 text-[#b84837]"
                      }`}
                    >
                      {currentMonthPaid ? "Paid" : "Unpaid"}
                    </span>
                  </div>
                  <button
                    disabled={feeSaving}
                    onClick={() => requestFeeChange(!currentMonthPaid)}
                    className={`${buttonClass} mt-4 w-full ${currentMonthPaid ? "!bg-[#b84837]" : ""}`}
                  >
                    {feeSaving ? "Saving..." : currentMonthPaid ? "Mark unpaid" : "Mark paid"}
                  </button>
                  <div className="mt-6 overflow-x-auto">
                    <table className="w-full min-w-[420px] text-left text-sm">
                      <thead className="bg-[#e7e4db] text-[10px] uppercase text-[#6f746e]">
                        <tr>
                          <th className="px-3 py-2">Period</th>
                          <th>Amount</th>
                          <th>Paid at</th>
                          <th>Marked by</th>
                        </tr>
                      </thead>
                      <tbody>
                        {feePayments.map((payment) => (
                          <tr key={payment.id} className="border-t border-[#dedad0]">
                            <td className="px-3 py-3 font-semibold">{periodLabel(payment.period)}</td>
                            <td>{money(payment.amount)}</td>
                            <td className="text-xs text-[#6f746e]">
                              {payment.paid_at
                                ? new Date(payment.paid_at).toLocaleString("en-LK", {
                                    dateStyle: "medium",
                                    timeStyle: "short",
                                  })
                                : "—"}
                            </td>
                            <td className="text-xs">{payment.marked_by?.name ?? "—"}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                    {feePayments.length === 0 && (
                      <p className="mt-3 text-sm text-[#6f746e]">No fee payments recorded yet.</p>
                    )}
                  </div>
                </>
              ) : (
                <p className="mt-4 text-sm text-[#6f746e]">
                  This tenant is on a yearly plan. Monthly fee tracking does not apply.
                </p>
              )}
            </Panel>

            <Panel className="p-5">
              <h2 className="font-display text-2xl font-semibold uppercase">Dual financial view</h2>
              <p className="mt-2 text-sm text-[#6f746e]">
                Enable Dual Financial View. Secondary login: amounts stay at 100%, except labor which shows at 50%. Platform-only — never shown to tenant users.
              </p>
              <div className="mt-4 flex items-center justify-between border border-[#d7d3c8] px-4 py-3">
                <div>
                  <p className="text-sm font-semibold">{tenant.dual_financial_view_enabled ? "Enabled" : "Disabled"}</p>
                  {secondaryUser && (
                    <p className="mt-1 text-xs text-[#6f746e]">{secondaryUser.email} · {secondaryUser.status}</p>
                  )}
                </div>
                <span className={`px-2 py-1 text-[10px] font-bold uppercase ${tenant.dual_financial_view_enabled ? "bg-[#167c73]/10 text-[#167c73]" : "bg-[#e7e4db] text-[#6f746e]"}`}>
                  {tenant.dual_financial_view_enabled ? "On" : "Off"}
                </span>
              </div>
              {!tenant.dual_financial_view_enabled && !secondaryUser && (
                <div className="mt-4 space-y-3">
                  <label className="block text-xs font-bold uppercase">
                    Secondary name
                    <input value={secondaryName} onChange={(e) => setSecondaryName(e.target.value)} className={`${inputClass} mt-2`} />
                  </label>
                  <label className="block text-xs font-bold uppercase">
                    Secondary email
                    <input type="email" value={secondaryEmail} onChange={(e) => setSecondaryEmail(e.target.value)} className={`${inputClass} mt-2`} />
                  </label>
                  <label className="block text-xs font-bold uppercase">
                    Secondary password
                    <input type="password" minLength={8} value={secondaryPassword} onChange={(e) => setSecondaryPassword(e.target.value)} className={`${inputClass} mt-2`} />
                  </label>
                </div>
              )}
              <button
                disabled={dualSaving || (!tenant.dual_financial_view_enabled && !secondaryUser && (!secondaryName || !secondaryEmail || secondaryPassword.length < 8))}
                onClick={() => requestDualChange(!tenant.dual_financial_view_enabled)}
                className={`${buttonClass} mt-4 w-full ${tenant.dual_financial_view_enabled ? "!bg-[#b84837]" : ""}`}
              >
                {dualSaving
                  ? "Saving..."
                  : tenant.dual_financial_view_enabled
                    ? "Disable dual financial view"
                    : "Enable dual financial view"}
              </button>
            </Panel>

            <Panel className="p-5">
              <h2 className="font-display text-2xl font-semibold uppercase">Edit tenant</h2>
              <p className="mt-2 text-sm text-[#6f746e]">Update business identity and bill branding details.</p>
              <form onSubmit={saveTenantDetails} className="mt-4 space-y-4">
                <label className="block text-xs font-bold uppercase">
                  Business name
                  <input name="business_name" required defaultValue={tenant.business_name} className={`${inputClass} mt-2`} />
                </label>
                <label className="block text-xs font-bold uppercase">
                  Owner name
                  <input name="owner_name" required defaultValue={tenant.owner_name} className={`${inputClass} mt-2`} />
                </label>
                <label className="block text-xs font-bold uppercase">
                  Owner email (login)
                  <input name="owner_email" type="email" required defaultValue={tenant.owner_email} className={`${inputClass} mt-2`} />
                </label>
                <label className="block text-xs font-bold uppercase">
                  Owner phone
                  <input name="owner_phone" defaultValue={tenant.owner_phone || ""} className={`${inputClass} mt-2`} />
                </label>
                <AddressField
                  name="address"
                  label="Business address"
                  value={address}
                  onChange={setAddress}
                  placeholder="Shown on printed bills"
                />
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
                <div className="grid gap-4 sm:grid-cols-2">
                  <label className="block text-xs font-bold uppercase">
                    Plan
                    <select name="plan" defaultValue={tenant.plan || ""} className={`${inputClass} mt-2`}>
                      {PLAN_OPTIONS.map((option) => (
                        <option key={option.value} value={option.value}>{option.label}</option>
                      ))}
                    </select>
                  </label>
                  <label className="block text-xs font-bold uppercase">
                    Payment plan
                    <select name="payment_plan" defaultValue={tenant.payment_plan || "monthly"} className={`${inputClass} mt-2`}>
                      {PAYMENT_PLAN_OPTIONS.map((option) => (
                        <option key={option.value} value={option.value}>{option.label}</option>
                      ))}
                    </select>
                  </label>
                  <label className="block text-xs font-bold uppercase sm:col-span-2">
                    Plan amount (LKR)
                    <input
                      name="plan_amount"
                      type="number"
                      min="0"
                      step="0.01"
                      defaultValue={tenant.plan_amount ?? ""}
                      className={`${inputClass} mt-2`}
                    />
                  </label>
                </div>
                <label className="block text-xs font-bold uppercase">
                  Logo image
                  <input name="logo" type="file" accept="image/*" className="mt-2 block w-full border border-[#c9c5b9] bg-white p-3 text-sm" />
                </label>
                <button disabled={logoSaving} className={buttonClass}>{logoSaving ? "Saving..." : "Save tenant details"}</button>
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
