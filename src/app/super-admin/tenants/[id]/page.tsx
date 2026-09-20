"use client";

import Link from "next/link";
import { useParams, useRouter, useSearchParams } from "next/navigation";
import { FormEvent, useEffect, useState } from "react";
import { Banknote, Plus, Power, Trash2, Users } from "lucide-react";
import { PlatformShell } from "@/components/platform-shell";
import { AddressField } from "@/components/address-field";
import { ConfirmModal, ErrorMessage, PageState, Panel, SuccessMessage, buttonClass, inputClass } from "@/components/ui";
import { api, Branch, mediaUrl, PhoneEntry, Tenant } from "@/lib/api";
import { BUSINESS_TYPE_OPTIONS, PAYMENT_PLAN_OPTIONS, PLAN_OPTIONS, optionalFeaturesFor, profileFor } from "@/lib/business-profiles";
import { FeaturePlanToggles } from "@/components/feature-plan-toggles";

type Feature = { id: number; key: string; name: string; group?: string | null; parent?: string | null };
type FeatureResponse = { available: Feature[]; enabled: string[]; optional?: string[]; nested?: Record<string, string>; business_type?: string };
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
type SetupFeePayment = {
  id: number;
  amount: number | string;
  paid_at: string;
  notes?: string | null;
  marked_by?: { id: number; name: string; email: string } | null;
};
type SetupFeeResponse = {
  setup_fee_amount: number | string | null;
  setup_fee_paid: number;
  setup_fee_balance: number;
  setup_fee_settled: boolean;
  payments: SetupFeePayment[];
};

type ConfirmState = {
  title: string;
  message: string;
  confirmLabel: string;
  tone: "default" | "danger" | "teal";
  action: "status" | "dual-enable" | "dual-disable" | "fee-paid" | "fee-unpaid" | "delete" | "setup-remove";
  paymentId?: number;
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

function localToday() {
  const date = new Date();
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
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
  const [setupPayments, setSetupPayments] = useState<SetupFeePayment[]>([]);
  const [setupPaid, setSetupPaid] = useState(0);
  const [setupBalance, setSetupBalance] = useState(0);
  const [setupSettled, setSetupSettled] = useState(false);
  const [setupAmount, setSetupAmount] = useState("");
  const [setupNotes, setSetupNotes] = useState("");
  const [setupPaidOn, setSetupPaidOn] = useState("");
  const [setupSettleOpen, setSetupSettleOpen] = useState(false);
  const [setupSaving, setSetupSaving] = useState(false);
  const [confirm, setConfirm] = useState<ConfirmState | null>(null);
  const [branches, setBranches] = useState<Branch[]>([]);
  const [branchSaving, setBranchSaving] = useState(false);

  function load() {
    Promise.all([
      api<Detail>(`/super-admin/tenants/${id}`),
      api<FeatureResponse>(`/super-admin/tenants/${id}/features`),
      api<FeePaymentsResponse>(`/super-admin/tenants/${id}/fee-payments`),
      api<SetupFeeResponse>(`/super-admin/tenants/${id}/setup-fee-payments`),
      api<Branch[]>(`/super-admin/tenants/${id}/branches`),
    ])
      .then(([detail, features, fees, setup, shopList]) => {
        setTenant(detail);
        setFeatureData(features);
        setEnabled(features.enabled);
        setFeePayments(fees.payments);
        setCurrentMonthPaid(fees.current_month_paid);
        setSetupPayments(setup.payments);
        setSetupPaid(Number(setup.setup_fee_paid || 0));
        setSetupBalance(Number(setup.setup_fee_balance || 0));
        setSetupSettled(Boolean(setup.setup_fee_settled));
        setBranches(shopList);
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

  async function grantDemo() {
    if (!tenant) return;
    setStatusSaving(true);
    setError("");
    try {
      const updated = await api<Detail>(`/super-admin/tenants/${id}/demo`, { method: "POST", body: JSON.stringify({ days: 21 }) });
      setTenant((current) => (current ? { ...current, ...updated } : updated));
      setNotice(`${tenant.business_name} has 21-day demo access. It will deactivate automatically when the days end. Activate to convert to a live shop.`);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Unable to grant demo access.");
    } finally {
      setStatusSaving(false);
    }
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

  function applySetup(result: SetupFeeResponse) {
    setSetupPayments(result.payments);
    setSetupPaid(Number(result.setup_fee_paid || 0));
    setSetupBalance(Number(result.setup_fee_balance || 0));
    setSetupSettled(Boolean(result.setup_fee_settled));
    setTenant((current) =>
      current
        ? {
            ...current,
            setup_fee_amount: result.setup_fee_amount,
            setup_fee_paid: result.setup_fee_paid,
            setup_fee_balance: result.setup_fee_balance,
            setup_fee_settled: result.setup_fee_settled,
          }
        : current,
    );
  }

  function openSetupSettle() {
    setSetupAmount(setupBalance > 0 ? String(setupBalance) : "");
    setSetupNotes("");
    setSetupPaidOn(localToday());
    setSetupSettleOpen(true);
    setError("");
  }

  async function saveSetupFeeAmount(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const value = Number(new FormData(event.currentTarget).get("setup_fee_amount"));
    if (!Number.isFinite(value) || value < 0) return;
    setSetupSaving(true);
    setError("");
    setNotice("");
    try {
      const updated = await api<Detail>(`/super-admin/tenants/${id}`, {
        method: "POST",
        body: JSON.stringify({ setup_fee_amount: value }),
      });
      setTenant((current) => (current ? { ...current, ...updated } : updated));
      setSetupPaid(Number(updated.setup_fee_paid || 0));
      setSetupBalance(Number(updated.setup_fee_balance ?? value));
      setSetupSettled(Boolean(updated.setup_fee_settled));
      setNotice("One-time amount saved. Use Settle payment to record what the tenant paid.");
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Unable to save the one-time amount.");
    } finally {
      setSetupSaving(false);
    }
  }

  async function recordSetupPayment(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!tenant) return;
    setSetupSaving(true);
    setError("");
    setNotice("");
    try {
      const result = await api<SetupFeeResponse>(`/super-admin/tenants/${id}/setup-fee-payments`, {
        method: "POST",
        body: JSON.stringify({
          amount: setupAmount ? Number(setupAmount) : undefined,
          notes: setupNotes.trim() || null,
          paid_at: setupPaidOn || undefined,
        }),
      });
      applySetup(result);
      setSetupAmount("");
      setSetupNotes("");
      setSetupSettleOpen(false);
      setNotice(result.setup_fee_settled ? "One-time payment is fully settled." : "Settlement recorded. It is included in Income.");
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Unable to record this settlement.");
    } finally {
      setSetupSaving(false);
    }
  }

  function requestRemoveSetupPayment(payment: SetupFeePayment) {
    if (!tenant) return;
    setConfirm({
      title: "Remove settlement",
      message: `Remove the ${money(payment.amount)} settlement from ${tenant.business_name}'s one-time payment?`,
      confirmLabel: "Remove",
      tone: "danger",
      action: "setup-remove",
      paymentId: payment.id,
    });
  }

  async function removeSetupPayment(paymentId: number) {
    setSetupSaving(true);
    setError("");
    setNotice("");
    try {
      const result = await api<SetupFeeResponse>(`/super-admin/tenants/${id}/setup-fee-payments/${paymentId}`, {
        method: "DELETE",
      });
      applySetup(result);
      setNotice("Settlement removed.");
      setConfirm(null);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Unable to remove the installment.");
    } finally {
      setSetupSaving(false);
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
    if (confirm.action === "setup-remove" && confirm.paymentId) await removeSetupPayment(confirm.paymentId);
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
    formData.set("vat_registered", formData.get("vat_registered") ? "1" : "0");
    formData.set("sscl_registered", formData.get("sscl_registered") ? "1" : "0");
    formData.set("contact_phones", JSON.stringify(contactPhones.filter((p) => p.number.trim())));
    if (contactPhones.find((p) => p.number.trim())) {
      formData.set("contact_phone", contactPhones.find((p) => p.number.trim())!.number);
    }
    try {
      const updated = await api<Detail>(`/super-admin/tenants/${id}`, { method: "POST", body: formData });
      setTenant((current) => (current ? { ...current, ...updated } : updated));
      if (updated.setup_fee_paid != null) setSetupPaid(Number(updated.setup_fee_paid));
      if (updated.setup_fee_balance != null) setSetupBalance(Number(updated.setup_fee_balance));
      if (updated.setup_fee_settled != null) setSetupSettled(Boolean(updated.setup_fee_settled));
      setAddress(updated.address || "");
      setNotice("Tenant details saved.");
      const logoInput = form.querySelector<HTMLInputElement>('input[name="logo"]');
      if (logoInput) logoInput.value = "";
      const features = await api<FeatureResponse>(`/super-admin/tenants/${id}/features`);
      setFeatureData(features);
      setEnabled(features.enabled);
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
            className={`flex h-8 items-center gap-2 px-2.5 text-[11px] font-semibold text-white ${tenant.status === "active" ? "bg-[#b84837]" : "bg-[#167c73]"}`}
          >
            <Power size={17} />{tenant.status === "active" ? "Deactivate" : "Activate"}
          </button>
          <button
            onClick={grantDemo}
            className="flex h-8 items-center gap-2 border border-[#167c73] bg-white px-2.5 text-[11px] font-semibold text-[#167c73]"
          >
            Grant 21-day demo
          </button>
          {Number(tenant.setup_fee_amount || 0) > 0 && !setupSettled && (
            <button
              onClick={openSetupSettle}
              className="flex h-8 items-center gap-2 bg-[#f5c842] px-2.5 text-[11px] font-semibold"
            >
              <Banknote size={17} /> Settle payment
            </button>
          )}
          <button
            onClick={requestDelete}
            className="flex h-8 items-center gap-2 border border-[#b84837] bg-white px-2.5 text-[11px] font-semibold text-[#b84837]"
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
        busy={dualSaving || statusSaving || feeSaving || deleting || setupSaving}
        onCancel={() => { if (!dualSaving && !statusSaving && !feeSaving && !deleting && !setupSaving) setConfirm(null); }}
        onConfirm={handleConfirm}
      />
      {setupSettleOpen && tenant && (
        <div className="fixed inset-0 z-[80] flex items-center justify-center p-4">
          <button type="button" aria-label="Close dialog" className="absolute inset-0 bg-[#181b19]/55" onClick={() => !setupSaving && setSetupSettleOpen(false)} />
          <form onSubmit={recordSetupPayment} className="relative z-10 w-full max-w-md border border-[#d7d3c8] bg-[#fbfaf6] p-5">
            <p className="text-[10px] font-bold uppercase tracking-wide text-[#167c73]">Settle one-time payment</p>
            <h2 className="mt-1 font-display text-2xl font-semibold uppercase">Pay this bill in steps</h2>
            <p className="mt-2 text-sm font-semibold">{tenant.business_name}</p>
            <p className="mt-1 text-sm text-[#6f746e]">Enter any amount the tenant is paying now. It is added to Income.</p>
            <dl className="mt-4 space-y-2 text-sm">
              <div className="flex justify-between"><dt className="text-[#6f746e]">Original</dt><dd className="font-semibold">{money(tenant.setup_fee_amount)}</dd></div>
              <div className="flex justify-between"><dt className="text-[#6f746e]">Paid so far</dt><dd className="font-semibold">{money(setupPaid)}</dd></div>
              <div className="flex justify-between"><dt className="text-[#6f746e]">Balance</dt><dd className="font-semibold text-[#b84837]">{money(setupBalance)}</dd></div>
            </dl>
            {(setupPayments.length ?? 0) > 0 && (
              <div className="mt-4 border-t border-[#e2ded4] pt-3">
                <p className="text-[10px] font-bold uppercase text-[#6f746e]">Earlier payments</p>
                <ul className="mt-2 space-y-1 text-xs">
                  {setupPayments.map((row) => (
                    <li key={row.id} className="flex justify-between">
                      <span>{row.paid_at ? new Date(row.paid_at).toLocaleDateString("en-LK") : "—"}</span>
                      <span>{money(row.amount)}</span>
                    </li>
                  ))}
                </ul>
              </div>
            )}
            <label className="mt-4 block text-xs font-bold uppercase">
              Amount to pay now
              <input
                value={setupAmount}
                onChange={(event) => setSetupAmount(event.target.value)}
                type="number"
                min="0.01"
                step="0.01"
                required
                className={`${inputClass} mt-2`}
              />
            </label>
            <label className="mt-3 block text-xs font-bold uppercase">
              Paid on
              <input
                value={setupPaidOn}
                onChange={(event) => setSetupPaidOn(event.target.value)}
                type="date"
                className={`${inputClass} mt-2`}
              />
            </label>
            <label className="mt-3 block text-xs font-bold uppercase">
              Note
              <input
                value={setupNotes}
                onChange={(event) => setSetupNotes(event.target.value)}
                placeholder="Optional"
                className={`${inputClass} mt-2`}
              />
            </label>
            <div className="mt-5 flex justify-end gap-2">
              <button type="button" onClick={() => setSetupSettleOpen(false)} className="h-8 border border-[#d7d3c8] px-2.5 text-[11px]">Cancel</button>
              <button disabled={setupSaving} className={buttonClass}>
                {setupSaving ? "Saving..." : "Record payment"}
              </button>
            </div>
          </form>
        </div>
      )}
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
                  {tenant.status}{tenant.is_demo ? " · demo" : ""}
                </span>
              </div>
              <dl className="mt-7 space-y-3 text-sm">
                <div className="flex justify-between border-b border-[#e2ded4] pb-3"><dt className="text-[#6f746e]">Owner</dt><dd className="font-semibold">{tenant.owner_name}</dd></div>
                <div className="flex justify-between border-b border-[#e2ded4] pb-3"><dt className="text-[#6f746e]">Email</dt><dd>{tenant.owner_email}</dd></div>
                <div className="flex justify-between gap-4 border-b border-[#e2ded4] pb-3">
                  <dt className="shrink-0 text-[#6f746e]">Address</dt>
                  <dd className="text-right">{tenant.address || "—"}</dd>
                </div>
                <div className="flex justify-between border-b border-[#e2ded4] pb-3"><dt className="text-[#6f746e]">Demo ends</dt><dd className="text-right">{tenant.demo_ends_at ? new Date(tenant.demo_ends_at).toLocaleString("en-LK") : "Live access"}{tenant.demo_days_left != null ? ` · ${tenant.demo_days_left} days left` : ""}</dd></div>
                <div className="flex justify-between border-b border-[#e2ded4] pb-3"><dt className="text-[#6f746e]">Plan</dt><dd>{tenant.plan ?? "Custom"}</dd></div>
                <div className="flex justify-between border-b border-[#e2ded4] pb-3"><dt className="text-[#6f746e]">Payment plan</dt><dd className="capitalize">{tenant.payment_plan ?? "monthly"}</dd></div>
                <div className="flex justify-between border-b border-[#e2ded4] pb-3"><dt className="text-[#6f746e]">Amount</dt><dd>{tenant.plan_amount != null ? `LKR ${Number(tenant.plan_amount).toLocaleString("en-LK", { minimumFractionDigits: 2 })}` : "—"}</dd></div>
                <div className="flex justify-between border-b border-[#e2ded4] pb-3">
                  <dt className="text-[#6f746e]">One-time payment</dt>
                  <dd className="text-right">
                    {Number(tenant.setup_fee_amount || 0) > 0 ? (
                      <>
                        <span className="block">{money(tenant.setup_fee_amount)}</span>
                        <span className={`text-[10px] font-bold uppercase ${setupSettled ? "text-[#167c73]" : "text-[#b84837]"}`}>
                          {setupSettled ? "Settled" : `Due ${money(setupBalance)}`}
                        </span>
                      </>
                    ) : "—"}
                  </dd>
                </div>
                <div className="flex justify-between"><dt className="text-[#6f746e]">Users</dt><dd>{tenant.users_count}</dd></div>
              </dl>
              <Link href={`/super-admin/tenants/${id}/users`} className={`${buttonClass} mt-6 w-full`}>
                <Users size={18} />Manage tenant users
              </Link>
              <Link href={`/super-admin/invoices?tenant=${id}`} className="mt-2 inline-flex h-8 w-full items-center justify-center border border-[#20221f] bg-white px-2.5 text-[11px] font-semibold hover:bg-[#20221f] hover:text-white">
                Tenants invoices
              </Link>
              <Link href={`/super-admin/inventory?tenant=${id}`} className="mt-2 inline-flex h-8 w-full items-center justify-center border border-[#20221f] bg-white px-2.5 text-[11px] font-semibold hover:bg-[#20221f] hover:text-white">
                Tenant inventory
              </Link>
            </Panel>

            <Panel className="p-5">
              <h2 className="font-display text-2xl font-semibold uppercase">One-time payment</h2>
              <p className="mt-2 text-sm text-[#6f746e]">
                Pay this in steps, same as Finance settle. Enter any amount toward the balance. Each payment is added to Income.
              </p>
              {Number(tenant.setup_fee_amount || 0) > 0 ? (
                <>
                  <dl className="mt-4 space-y-2 border border-[#d7d3c8] px-4 py-3 text-sm">
                    <div className="flex justify-between"><dt className="text-[#6f746e]">Original</dt><dd className="font-semibold">{money(tenant.setup_fee_amount)}</dd></div>
                    <div className="flex justify-between"><dt className="text-[#6f746e]">Paid so far</dt><dd className="font-semibold">{money(setupPaid)}</dd></div>
                    <div className="flex justify-between">
                      <dt className="text-[#6f746e]">Balance</dt>
                      <dd className={`font-semibold ${setupSettled ? "text-[#167c73]" : "text-[#b84837]"}`}>
                        {setupSettled ? "Settled" : money(setupBalance)}
                      </dd>
                    </div>
                  </dl>
                  {!setupSettled && (
                    <button type="button" onClick={openSetupSettle} className={`${buttonClass} mt-4 w-full`}>
                      Settle payment
                    </button>
                  )}
                  {(setupPayments.length ?? 0) > 0 && (
                    <div className="mt-4 border-t border-[#e2ded4] pt-3">
                      <p className="text-[10px] font-bold uppercase text-[#6f746e]">Earlier payments</p>
                      <ul className="mt-2 space-y-1 text-xs">
                        {setupPayments.map((payment) => (
                          <li key={payment.id} className="flex items-center justify-between gap-3">
                            <span>{payment.paid_at ? new Date(payment.paid_at).toLocaleDateString("en-LK") : "—"}{payment.notes ? ` · ${payment.notes}` : ""}</span>
                            <span className="flex items-center gap-3">
                              <span className="font-semibold">{money(payment.amount)}</span>
                              <button
                                type="button"
                                disabled={setupSaving}
                                onClick={() => requestRemoveSetupPayment(payment)}
                                className="text-[10px] font-bold uppercase text-[#b84837]"
                              >
                                Remove
                              </button>
                            </span>
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}
                </>
              ) : (
                <form onSubmit={saveSetupFeeAmount} className="mt-4 space-y-3">
                  <label className="block text-xs font-bold uppercase">
                    One-time amount (LKR)
                    <input
                      name="setup_fee_amount"
                      type="number"
                      min="0"
                      step="0.01"
                      required
                      placeholder="e.g. 60000"
                      className={`${inputClass} mt-2`}
                    />
                  </label>
                  <button disabled={setupSaving} className={`${buttonClass} w-full`}>
                    {setupSaving ? "Saving..." : "Save amount"}
                  </button>
                </form>
              )}
            </Panel>

            <Panel className="p-5">
              <h2 className="font-display text-2xl font-semibold uppercase">Shops / branches</h2>
              <p className="mt-2 text-sm text-[#6f746e]">You create shops. The owner can rename them. Stock and bills stay separate per shop.</p>
              <div className="mt-4 divide-y divide-[#e2ded4] border border-[#d7d3c8]">
                {branches.map((branch) => (
                  <div key={branch.id} className="flex items-center justify-between gap-3 px-3 py-2 text-sm">
                    <div>
                      <strong>{branch.name}</strong>
                      <span className="ml-2 text-xs text-[#6f746e]">{branch.code}{branch.is_default ? " · default" : ""}{branch.status === "inactive" ? " · inactive" : ""}</span>
                    </div>
                    {!branch.is_default && (
                      <button
                        type="button"
                        className="text-xs font-semibold uppercase text-[#6b1e2a]"
                        onClick={async () => {
                          try {
                            const path = branch.status === "inactive" ? "activate" : "deactivate";
                            const updated = await api<Branch>(`/super-admin/tenants/${id}/branches/${branch.id}/${path}`, { method: "POST" });
                            setBranches((current) => current.map((item) => item.id === updated.id ? updated : item));
                          } catch (caught) {
                            setError(caught instanceof Error ? caught.message : "Unable to update shop.");
                          }
                        }}
                      >
                        {branch.status === "inactive" ? "Activate" : "Deactivate"}
                      </button>
                    )}
                  </div>
                ))}
              </div>
              <form
                className="mt-4 space-y-2"
                onSubmit={async (event) => {
                  event.preventDefault();
                  const form = event.currentTarget;
                  const data = Object.fromEntries(new FormData(form));
                  setBranchSaving(true);
                  setError("");
                  try {
                    const created = await api<Branch>(`/super-admin/tenants/${id}/branches`, {
                      method: "POST",
                      body: JSON.stringify({ name: data.name, address: data.address || null }),
                    });
                    setBranches((current) => [...current, created]);
                    form.reset();
                    setNotice(`Shop ${created.name} created. Stock starts at zero — transfer from Main.`);
                  } catch (caught) {
                    setError(caught instanceof Error ? caught.message : "Unable to add shop.");
                  } finally {
                    setBranchSaving(false);
                  }
                }}
              >
                <input required name="name" placeholder="Shop name" className={inputClass} />
                <input name="address" placeholder="Address (optional)" className={inputClass} />
                <button disabled={branchSaving} className={`${buttonClass} w-full`}><Plus size={16} />{branchSaving ? "Adding..." : "Add branch"}</button>
              </form>
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
                  Business type
                  <select name="business_type" defaultValue={tenant.business_type} className={`${inputClass} mt-2`}>
                    {BUSINESS_TYPE_OPTIONS.map((option) => (
                      <option key={option.value} value={option.value}>{option.label}</option>
                    ))}
                  </select>
                </label>
                <p className="text-sm text-[#6f746e]">
                  Plan (Store Pro / Mobile Pro) is only the billing label. Business type is what changes the screens, sidebar, and modules. After a type change, the owner should refresh or sign in again.
                </p>
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
                <label className="block text-xs font-bold uppercase">
                  TIN
                  <input name="tin" defaultValue={tenant.tin || ""} className={`${inputClass} mt-2`} />
                </label>
                <label className="flex items-center gap-2 text-xs font-bold uppercase">
                  <input name="vat_registered" type="checkbox" value="1" defaultChecked={Boolean(tenant.vat_registered)} />
                  VAT registered (default 18%)
                </label>
                <label className="flex items-center gap-2 text-xs font-bold uppercase">
                  <input name="sscl_registered" type="checkbox" value="1" defaultChecked={Boolean(tenant.sscl_registered)} />
                  SSCL registered (default 2.5%)
                </label>
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
                          <button type="button" onClick={() => setContactPhones((rows) => rows.filter((_, i) => i !== index))} className="grid size-9 place-items-center border border-[#d7d3c8] text-[#b84837]" aria-label="Remove">
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
                    <span className="mt-1 block font-normal normal-case text-[#6f746e]">Does not switch Store vs Mobile shop.</span>
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
                  <label className="block text-xs font-bold uppercase sm:col-span-2">
                    One-time payment (LKR)
                    <input
                      name="setup_fee_amount"
                      type="number"
                      min="0"
                      step="0.01"
                      defaultValue={tenant.setup_fee_amount ?? ""}
                      className={`${inputClass} mt-2`}
                    />
                    <span className="mt-1 block text-[10px] font-normal normal-case text-[#6f746e]">
                      Cannot be lower than {money(setupPaid)} already received.
                    </span>
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
            <p className="mt-2 text-sm text-[#6f746e]">
              Only modules that fit this business type are shown. Disabling one removes it from that business sidebar immediately.
              {tenant.business_type === "store" ? " Repair and Warranties are optional modules." : ""}
              {tenant.business_type === "mobile_shop" ? " Sales, repairs, and warranties are on by default." : ""}
              {tenant.business_type === "garage" ? " Admit vehicle can be repair, service, or both. Nested ticks sit under that module." : ""}
            </p>
            <div className="mt-6">
              <FeaturePlanToggles
                features={featureData.available}
                enabled={enabled}
                optional={featureData.optional ?? optionalFeaturesFor(tenant.business_type)}
                garageAdmit={tenant.business_type === "garage"}
                onChange={setEnabled}
              />
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
