"use client";

import Link from "next/link";
import { FormEvent, useEffect, useState } from "react";
import { ArrowRight, ClipboardPlus, Hammer, Percent, Search, Wrench, X, Zap } from "lucide-react";
import { AppShell } from "@/components/app-shell";
import { ErrorMessage, PageState, Panel, buttonClass, inputClass } from "@/components/ui";
import { api, currentFeatures, currentUser, formatDate, money } from "@/lib/api";
import { allowsServiceJobs, usesLaborCatalog, usesServiceAddonWorkspace, usesStoreCounter } from "@/lib/business-profiles";
import { useBusinessProfile } from "@/lib/use-business-profile";
import { billListStatus, billStatusClass, billStatusLabel, isOweInUrgent } from "@/lib/bill-stamp";
import { BillingBranchBanner } from "@/components/branch-chip";
import { useRouter } from "next/navigation";
import { useT } from "@/lib/locale";

type Bill = {
  id: number;
  bill_number: string;
  admission_date: string;
  status: string;
  job_kind?: string | null;
  subtotal: string;
  balance_due: string;
  amount_refunded?: string | number;
  has_pending_cheque?: boolean;
  pending_cheque_date?: string | null;
  refund_status?: string;
  owe_in_due_date?: string | null;
  notes?: string | null;
  customer: { name: string; phone: string } | null;
  vehicle: { number_plate: string; make?: string; model?: string } | null;
};

function billJobKindClass(bill: Bill, type: string): string {
  if (usesStoreCounter(type)) return "bg-[#eeece5] text-[#6f746e]";
  if (bill.job_kind === "service") return "bg-[#4c51bf] text-white";
  if (bill.job_kind === "parts_sale") return "bg-[#2f855a] text-white";
  return "bg-[#c2581c] text-white";
}

function billJobKindLabel(bill: Bill, type: string, t: ReturnType<typeof useT>): string | null {
  if (!(type === "garage" || type === "paint" || usesStoreCounter(type))) return null;
  if (usesStoreCounter(type)) {
    return bill.bill_number.startsWith("QCK-") ? t("bills.quick") : t("bills.sale");
  }
  if (bill.job_kind === "service") return type === "paint" ? t("bills.package") : t("bills.service");
  if (bill.job_kind === "parts_sale") return type === "paint" ? t("bills.counter") : t("bills.instant");
  if (bill.job_kind === "repair" || !bill.job_kind) return type === "paint" ? t("bills.panel") : t("bills.repair");
  return bill.job_kind;
}

export default function BillsPage() {
  const [bills, setBills] = useState<Bill[]>([]);
  const [search, setSearch] = useState("");
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);
  const [isOwner, setIsOwner] = useState(false);
  const [quickOpen, setQuickOpen] = useState(false);
  const [quickSaving, setQuickSaving] = useState(false);
  const [payNow, setPayNow] = useState(true);
  const profile = useBusinessProfile();
  const t = useT();
  const router = useRouter();
  const isStore = usesStoreCounter(profile.type);
  const rangeInvalid = Boolean(dateFrom && dateTo && dateFrom > dateTo);

  useEffect(() => {
    setIsOwner(currentUser()?.role === "business_owner");
  }, []);

  useEffect(() => {
    if (rangeInvalid) {
      setError(t("bills.range_invalid"));
      setLoading(false);
      return;
    }

    setLoading(true);
    setError("");
    const timer = setTimeout(() => {
      const params = new URLSearchParams({
        search,
        per_page: "50",
      });
      if (usesStoreCounter(profile.type)) params.set("job_kind", "parts_sale");
      if (dateFrom) params.set("date_from", dateFrom);
      if (dateTo) params.set("date_to", dateTo);

      api<{ data: Bill[] }>(`/bills?${params}`)
        .then((result) => setBills(result.data))
        .catch((caught) => setError(caught.message))
        .finally(() => setLoading(false));
    }, 250);
    return () => clearTimeout(timer);
  }, [search, dateFrom, dateTo, rangeInvalid, profile.type]);

  function clearDates() {
    setDateFrom("");
    setDateTo("");
  }

  async function createQuickBill(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setQuickSaving(true);
    setError("");
    const form = new FormData(event.currentTarget);
    const amount = Number(form.get("amount") || 0);
    try {
      const bill = await api<{ id: number }>("/bills/quick", {
        method: "POST",
        body: JSON.stringify({
          description: form.get("description"),
          amount,
          quantity: Number(form.get("quantity") || 1),
          customer_name: form.get("customer_name") || null,
          customer_phone: form.get("customer_phone") || null,
          payment_method: form.get("payment_method") || "cash",
          payment_amount: payNow ? amount * Number(form.get("quantity") || 1) : 0,
        }),
      });
      setQuickOpen(false);
      router.push(`/bills/${bill.id}`);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : t("bills.quick_failed"));
    } finally {
      setQuickSaving(false);
    }
  }

  return (
    <AppShell
      title={t(`terms.${profile.billingLabel}`)}
      eyebrow={t("bills.eyebrow")}
      action={
        <div className="flex items-center gap-2">
          {(usesLaborCatalog(profile.type) || usesServiceAddonWorkspace(profile.type)) && isOwner && (
            <>
              {usesLaborCatalog(profile.type) && (
              <Link
                href="/labor-catalog"
                className="flex h-8 items-center gap-2 border border-[#c9c5b9] bg-white px-3 text-[11px] font-semibold hover:border-[#167c73]"
              >
                <Hammer size={14} /><span className="hidden sm:inline">{profile.type === "paint" ? t("bills.paint_labor") : t("bills.repair_addons")}</span>
              </Link>
              )}
              {usesServiceAddonWorkspace(profile.type) && allowsServiceJobs(profile.type, currentFeatures()) && (
              <Link
                href="/service-addons"
                className="flex h-8 items-center gap-2 border border-[#c9c5b9] bg-white px-3 text-[11px] font-semibold hover:border-[#167c73]"
              >
                <Wrench size={14} /><span className="hidden sm:inline">{profile.type === "paint" ? t("bills.paint_packages") : t("bills.service_addons")}</span>
              </Link>
              )}
              {(profile.type === "garage" || profile.type === "paint") && (
              <Link
                href="/discount-types"
                className="flex h-8 items-center gap-2 border border-[#c9c5b9] bg-white px-3 text-[11px] font-semibold hover:border-[#167c73]"
              >
                <Percent size={14} /><span className="hidden sm:inline">{t("bills.discount_types")}</span>
              </Link>
              )}
            </>
          )}
          {isStore && (
            <button
              type="button"
              onClick={() => { setQuickOpen(true); setError(""); }}
              className="flex h-8 items-center gap-2 border border-[#20221f] bg-white px-2.5 text-[11px] font-semibold"
            >
              <Zap size={14} /><span className="hidden sm:inline">{t("bills.quick_bill")}</span>
            </button>
          )}
          <Link href={profile.primaryCta.href} className="flex h-8 items-center gap-2 bg-[#f5c842] px-2.5 text-[11px] font-semibold">
            <ClipboardPlus size={14} /><span className="hidden sm:inline">{t(`nav.${profile.primaryCta.label}`)}</span>
          </Link>
        </div>
      }
    >
      <BillingBranchBanner />
      <div className="mb-5 flex flex-wrap items-end gap-3">
        <label className="relative block min-w-56 max-w-md flex-1">
          <span className="mb-1 block text-[10px] font-bold uppercase text-[#6f746e]">{t("common.search")}</span>
          <span className="relative block">
            <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 text-[#6f746e]" size={14} />
            <input
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              className={`${inputClass} pl-8`}
              placeholder={isStore ? t("bills.search_store") : t("bills.search_other", { kind: t(`terms.${profile.billingSingular}`).toLowerCase() })}
            />
          </span>
        </label>
        <label className="block">
          <span className="mb-1 block text-[10px] font-bold uppercase text-[#6f746e]">{t("common.from")}</span>
          <input
            type="date"
            value={dateFrom}
            max={dateTo || undefined}
            onChange={(event) => setDateFrom(event.target.value)}
            className={`${inputClass} w-auto min-w-40`}
          />
        </label>
        <label className="block">
          <span className="mb-1 block text-[10px] font-bold uppercase text-[#6f746e]">{t("common.to")}</span>
          <input
            type="date"
            value={dateTo}
            min={dateFrom || undefined}
            onChange={(event) => setDateTo(event.target.value)}
            className={`${inputClass} w-auto min-w-40`}
          />
        </label>
        {(dateFrom || dateTo) && (
          <button
            type="button"
            onClick={clearDates}
            className="inline-flex h-8 items-center gap-2 border border-[#c9c5b9] bg-white px-3 text-[11px] font-semibold text-[#6f746e] hover:border-[#167c73] hover:text-[#167c73]"
          >
            <X size={16} />
            {t("bills.clear_dates")}
          </button>
        )}
      </div>
      {error ? <ErrorMessage message={error} /> : loading ? (
        <PageState message={t("bills.loading", { kind: t(`terms.${profile.billingLabel}`).toLowerCase() })} />
      ) : (
        <>
        <div className="space-y-3 md:hidden">
          {bills.map((bill) => {
            const urgent = bill.status === "owe_in" && isOweInUrgent(bill.owe_in_due_date);
            const kind = billJobKindLabel(bill, profile.type, t);
            return (
              <Link key={bill.id} href={`/bills/${bill.id}`}>
                <Panel className={`p-4 ${urgent ? "border-[#b84837]" : ""}`}>
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <p className="font-semibold">{bill.bill_number}</p>
                      <p className="text-sm text-[#6f746e]">{bill.customer?.name ?? t("common.walk_in")}</p>
                      <p className="mt-1 text-xs text-[#6f746e]">{usesStoreCounter(profile.type) ? (bill.notes || "—") : (bill.vehicle?.number_plate ?? "—")} · {formatDate(bill.admission_date)}</p>
                    </div>
                    <span className={`px-2 py-1 text-[10px] font-bold uppercase ${billStatusClass(billListStatus(bill), bill.owe_in_due_date)}`}>{billStatusLabel(billListStatus(bill), t)}</span>
                  </div>
                  <div className="mt-3 flex items-end justify-between gap-3">
                    {kind ? (
                      <span className={`px-2 py-1 text-[10px] font-bold uppercase ${billJobKindClass(bill, profile.type)}`}>{kind}</span>
                    ) : <span />}
                    <p className={`text-right text-lg font-semibold ${urgent ? "text-[#b84837]" : ""}`}>{money(bill.balance_due)}</p>
                  </div>
                </Panel>
              </Link>
            );
          })}
          {bills.length === 0 && <PageState message={t("bills.empty", { kind: t(`terms.${profile.billingLabel}`).toLowerCase() })} />}
        </div>
        <Panel className="hidden md:block">
          <div className="overflow-x-auto">
            <table className="w-full min-w-[720px] text-left text-sm">
              <thead className="bg-[#eeece5] text-[10px] uppercase text-[#6f746e]">
                <tr>
                  <th className="px-5 py-3">{t("common.ref")}</th>
                  <th>{t("common.date")}</th>
                  <th>{t("common.type")}</th>
                  <th>{t("common.customer")}</th>
                  <th>{t("common.detail")}</th>
                  <th>{t("common.status")}</th>
                  <th className="pr-5 text-right">{t("common.due")}</th>
                  <th />
                </tr>
              </thead>
              <tbody>
                {bills.map((bill) => {
                  const urgent = bill.status === "owe_in" && isOweInUrgent(bill.owe_in_due_date);
                  const kind = billJobKindLabel(bill, profile.type, t);
                  return (
                  <tr key={bill.id} className={`border-t border-[#e2ded4] ${urgent ? "bg-[#b84837]/8" : ""}`}>
                    <td className="px-5 py-4 font-semibold">{bill.bill_number}</td>
                    <td>{formatDate(bill.admission_date)}</td>
                    <td>
                      {kind ? (
                        <span className={`px-2 py-1 text-[10px] font-bold uppercase ${billJobKindClass(bill, profile.type)}`}>
                          {kind}
                        </span>
                      ) : "—"}
                    </td>
                    <td>{bill.customer?.name ?? t("common.walk_in")}</td>
                    <td>{usesStoreCounter(profile.type) ? (bill.notes || "—") : (bill.vehicle?.number_plate ?? "—")}</td>
                    <td>
                      {(() => {
                        const listStatus = billListStatus(bill);
                        return (
                          <>
                            <span className={`px-2 py-1 text-[10px] font-bold uppercase ${billStatusClass(listStatus, bill.owe_in_due_date)}`}>
                              {billStatusLabel(listStatus, t)}
                            </span>
                            {listStatus === "cheque" && bill.pending_cheque_date && (
                              <p className="mt-1 text-[10px] font-semibold text-[#735a00]">
                                {formatDate(bill.pending_cheque_date)}
                              </p>
                            )}
                            {bill.status === "owe_in" && bill.owe_in_due_date && listStatus !== "cheque" && (
                              <p className={`mt-1 text-[10px] font-semibold ${urgent ? "text-[#b84837]" : "text-[#6f746e]"}`}>
                                {t("common.due_on", { date: formatDate(bill.owe_in_due_date) })}
                              </p>
                            )}
                            {bill.status === "closed" && bill.refund_status && bill.refund_status !== "none" && (
                              <p className="mt-1 text-[10px] font-semibold uppercase text-[#b84837]">
                                {billStatusLabel(bill.refund_status, t)}
                              </p>
                            )}
                          </>
                        );
                      })()}
                    </td>
                    <td className={`pr-5 text-right font-semibold ${urgent ? "text-[#b84837]" : ""}`}>{money(bill.balance_due)}</td>
                    <td className="pr-4">
                      <Link href={`/bills/${bill.id}`} className="text-[#167c73]"><ArrowRight size={18} /></Link>
                    </td>
                  </tr>
                  );
                })}
              </tbody>
            </table>
            {bills.length === 0 && (
              <p className="p-8 text-center text-sm text-[#6f746e]">
                {dateFrom || dateTo
                  ? t("bills.empty_range", { kind: t(`terms.${profile.billingLabel}`).toLowerCase() })
                  : t("bills.empty", { kind: t(`terms.${profile.billingLabel}`).toLowerCase() })}
              </p>
            )}
          </div>
        </Panel>
        </>
      )}
      {quickOpen && (
        <div className="fixed inset-0 z-50 grid place-items-center bg-black/55 p-4" onClick={() => !quickSaving && setQuickOpen(false)}>
          <form onSubmit={createQuickBill} onClick={(event) => event.stopPropagation()} className="w-full max-w-md bg-[#f3f0e8]">
            <div className="border-b border-[#d7d3c8] px-5 py-4">
              <h2 className="font-display text-2xl font-semibold uppercase">{t("bills.quick_bill")}</h2>
              <p className="mt-1 text-xs text-[#6f746e]">{t("bills.quick_hint")}</p>
            </div>
            <div className="space-y-3 p-5">
              {error && <ErrorMessage message={error} />}
              <label className="block text-xs font-bold uppercase">
                {t("bills.job")}
                <input required name="description" placeholder={t("bills.job_placeholder")} className={`${inputClass} mt-2`} />
              </label>
              <div className="grid grid-cols-2 gap-3">
                <label className="block text-xs font-bold uppercase">
                  {t("common.amount")}
                  <input required name="amount" type="number" min="0" step="0.01" className={`${inputClass} mt-2`} />
                </label>
                <label className="block text-xs font-bold uppercase">
                  {t("common.qty")}
                  <input name="quantity" type="number" min="1" step="1" defaultValue="1" className={`${inputClass} mt-2`} />
                </label>
              </div>
              <label className="block text-xs font-bold uppercase">
                {t("bills.customer_optional")} <span className="font-normal text-[#6f746e]">{t("common.optional")}</span>
                <input name="customer_name" className={`${inputClass} mt-2`} />
              </label>
              <label className="block text-xs font-bold uppercase">
                {t("bills.phone_optional")} <span className="font-normal text-[#6f746e]">{t("common.optional")}</span>
                <input name="customer_phone" className={`${inputClass} mt-2`} />
              </label>
              <label className="block text-xs font-bold uppercase">
                {t("bills.payment")}
                <select name="payment_method" className={`${inputClass} mt-2`}>
                  <option value="cash">{t("method.cash")}</option>
                  <option value="card">{t("method.card")}</option>
                  <option value="bank_transfer">{t("method.bank_transfer")}</option>
                </select>
              </label>
              <label className="flex items-center gap-2 text-sm">
                <input type="checkbox" checked={payNow} onChange={(event) => setPayNow(event.target.checked)} className="size-4 accent-[#167c73]" />
                {t("bills.take_payment_now")}
              </label>
              <div className="flex gap-2">
                <button disabled={quickSaving} className={`${buttonClass} flex-1`}>{quickSaving ? t("common.saving") : t("bills.create_bill")}</button>
                <button type="button" onClick={() => setQuickOpen(false)} className="h-8 border border-[#cbc7bc] px-3 text-xs">{t("common.cancel")}</button>
              </div>
            </div>
          </form>
        </div>
      )}
    </AppShell>
  );
}
