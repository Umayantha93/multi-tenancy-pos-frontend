"use client";

import Link from "next/link";
import { FormEvent, useEffect, useState } from "react";
import { ArrowRight, ClipboardPlus, Hammer, Search, Wrench, X, Zap } from "lucide-react";
import { AppShell } from "@/components/app-shell";
import { ErrorMessage, PageState, Panel, buttonClass, inputClass } from "@/components/ui";
import { api, currentUser, formatDate, money } from "@/lib/api";
import { usesLaborCatalog, usesServiceAddonWorkspace, usesStoreCounter } from "@/lib/business-profiles";
import { useBusinessProfile } from "@/lib/use-business-profile";
import { billStatusClass, billStatusLabel, isOweInUrgent } from "@/lib/bill-stamp";
import { BillingBranchBanner } from "@/components/branch-chip";
import { useRouter } from "next/navigation";

type Bill = {
  id: number;
  bill_number: string;
  admission_date: string;
  status: string;
  job_kind?: string | null;
  subtotal: string;
  balance_due: string;
  owe_in_due_date?: string | null;
  notes?: string | null;
  customer: { name: string; phone: string } | null;
  vehicle: { number_plate: string; make?: string; model?: string } | null;
};

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
  const router = useRouter();
  const isStore = usesStoreCounter(profile.type);
  const rangeInvalid = Boolean(dateFrom && dateTo && dateFrom > dateTo);

  useEffect(() => {
    setIsOwner(currentUser()?.role === "business_owner");
  }, []);

  useEffect(() => {
    if (rangeInvalid) {
      setError("From date must be on or before To date.");
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
      setError(caught instanceof Error ? caught.message : "Could not create quick bill.");
    } finally {
      setQuickSaving(false);
    }
  }

  return (
    <AppShell
      title={profile.billingLabel}
      eyebrow="Open bills & queue"
      action={
        <div className="flex items-center gap-2">
          {(usesLaborCatalog(profile.type) || usesServiceAddonWorkspace(profile.type)) && isOwner && (
            <>
              {usesLaborCatalog(profile.type) && (
              <Link
                href="/labor-catalog"
                className="flex h-9 items-center gap-2 border border-[#c9c5b9] bg-white px-3 text-[13px] font-semibold hover:border-[#167c73]"
              >
                <Hammer size={16} /><span className="hidden sm:inline">{profile.type === "paint" ? "Paint labor" : "Repair addons"}</span>
              </Link>
              )}
              {usesServiceAddonWorkspace(profile.type) && (
              <Link
                href="/service-addons"
                className="flex h-9 items-center gap-2 border border-[#c9c5b9] bg-white px-3 text-[13px] font-semibold hover:border-[#167c73]"
              >
                <Wrench size={16} /><span className="hidden sm:inline">{profile.type === "paint" ? "Paint packages" : "Service addons"}</span>
              </Link>
              )}
            </>
          )}
          {isStore && (
            <button
              type="button"
              onClick={() => { setQuickOpen(true); setError(""); }}
              className="flex h-10 items-center gap-2 border border-[#20221f] bg-white px-3 text-sm font-semibold"
            >
              <Zap size={16} /><span className="hidden sm:inline">Quick bill</span>
            </button>
          )}
          <Link href={profile.primaryCta.href} className="flex h-10 items-center gap-2 bg-[#f5c842] px-3 text-sm font-semibold">
            <ClipboardPlus size={18} /><span className="hidden sm:inline">{profile.primaryCta.label}</span>
          </Link>
        </div>
      }
    >
      <BillingBranchBanner />
      <div className="mb-5 flex flex-wrap items-end gap-3">
        <label className="relative block min-w-56 max-w-md flex-1">
          <span className="mb-1 block text-[10px] font-bold uppercase text-[#6f746e]">Search</span>
          <span className="relative block">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-[#6f746e]" size={16} />
            <input
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              className={`${inputClass} pl-10`}
              placeholder={isStore ? "Search sale, customer, phone or job" : `Search ${profile.billingSingular.toLowerCase()} or customer`}
            />
          </span>
        </label>
        <label className="block">
          <span className="mb-1 block text-[10px] font-bold uppercase text-[#6f746e]">From</span>
          <input
            type="date"
            value={dateFrom}
            max={dateTo || undefined}
            onChange={(event) => setDateFrom(event.target.value)}
            className={`${inputClass} w-auto min-w-40`}
          />
        </label>
        <label className="block">
          <span className="mb-1 block text-[10px] font-bold uppercase text-[#6f746e]">To</span>
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
            className="inline-flex h-9 items-center gap-2 border border-[#c9c5b9] bg-white px-3 text-[13px] font-semibold text-[#6f746e] hover:border-[#167c73] hover:text-[#167c73]"
          >
            <X size={16} />
            Clear dates
          </button>
        )}
      </div>
      {error ? <ErrorMessage message={error} /> : loading ? (
        <PageState message={`Loading ${profile.billingLabel.toLowerCase()}...`} />
      ) : (
        <Panel>
          <div className="overflow-x-auto">
            <table className="w-full min-w-[720px] text-left text-sm">
              <thead className="bg-[#eeece5] text-[10px] uppercase text-[#6f746e]">
                <tr>
                  <th className="px-5 py-3">Ref</th>
                  <th>Date</th>
                  <th>Type</th>
                  <th>Customer</th>
                  <th>Detail</th>
                  <th>Status</th>
                  <th className="pr-5 text-right">Due</th>
                  <th />
                </tr>
              </thead>
              <tbody>
                {bills.map((bill) => {
                  const urgent = bill.status === "owe_in" && isOweInUrgent(bill.owe_in_due_date);
                  return (
                  <tr key={bill.id} className={`border-t border-[#e2ded4] ${urgent ? "bg-[#b84837]/8" : ""}`}>
                    <td className="px-5 py-4 font-semibold">{bill.bill_number}</td>
                    <td>{formatDate(bill.admission_date)}</td>
                    <td>
                      {profile.type === "garage" || profile.type === "paint" || usesStoreCounter(profile.type) ? (
                        <span className="px-2 py-1 text-[10px] font-bold uppercase bg-[#eeece5] text-[#6f746e]">
                          {usesStoreCounter(profile.type)
                            ? (bill.bill_number.startsWith("QCK-") ? "Quick" : "Sale")
                            : bill.job_kind === "service"
                              ? (profile.type === "paint" ? "Package" : "Service")
                              : bill.job_kind === "parts_sale"
                                ? (profile.type === "paint" ? "Counter" : "Instant")
                                : bill.job_kind === "repair" || !bill.job_kind
                                  ? (profile.type === "paint" ? "Panel" : "Repair")
                                  : bill.job_kind}
                        </span>
                      ) : "—"}
                    </td>
                    <td>{bill.customer?.name ?? "Walk-in"}</td>
                    <td>{usesStoreCounter(profile.type) ? (bill.notes || "—") : (bill.vehicle?.number_plate ?? "—")}</td>
                    <td>
                      <span className={`px-2 py-1 text-[10px] font-bold uppercase ${billStatusClass(bill.status, bill.owe_in_due_date)}`}>
                        {billStatusLabel(bill.status)}
                      </span>
                      {bill.status === "owe_in" && bill.owe_in_due_date && (
                        <p className={`mt-1 text-[10px] font-semibold ${urgent ? "text-[#b84837]" : "text-[#6f746e]"}`}>
                          Due {formatDate(bill.owe_in_due_date)}
                        </p>
                      )}
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
                  ? `No ${profile.billingLabel.toLowerCase()} in this date range.`
                  : `No ${profile.billingLabel.toLowerCase()} yet.`}
              </p>
            )}
          </div>
        </Panel>
      )}
      {quickOpen && (
        <div className="fixed inset-0 z-50 grid place-items-center bg-black/55 p-4" onClick={() => !quickSaving && setQuickOpen(false)}>
          <form onSubmit={createQuickBill} onClick={(event) => event.stopPropagation()} className="w-full max-w-md bg-[#f3f0e8]">
            <div className="border-b border-[#d7d3c8] px-5 py-4">
              <h2 className="font-display text-2xl font-semibold uppercase">Quick bill</h2>
              <p className="mt-1 text-xs text-[#6f746e]">CD write, photocopy, or any small job. Customer details are optional.</p>
            </div>
            <div className="space-y-3 p-5">
              {error && <ErrorMessage message={error} />}
              <label className="block text-xs font-bold uppercase">
                Job
                <input required name="description" placeholder="DVD write, CD copy, screen guard…" className={`${inputClass} mt-2`} />
              </label>
              <div className="grid grid-cols-2 gap-3">
                <label className="block text-xs font-bold uppercase">
                  Amount
                  <input required name="amount" type="number" min="0" step="0.01" className={`${inputClass} mt-2`} />
                </label>
                <label className="block text-xs font-bold uppercase">
                  Qty
                  <input name="quantity" type="number" min="1" step="1" defaultValue="1" className={`${inputClass} mt-2`} />
                </label>
              </div>
              <label className="block text-xs font-bold uppercase">
                Customer name <span className="font-normal text-[#6f746e]">optional</span>
                <input name="customer_name" className={`${inputClass} mt-2`} />
              </label>
              <label className="block text-xs font-bold uppercase">
                Phone <span className="font-normal text-[#6f746e]">optional</span>
                <input name="customer_phone" className={`${inputClass} mt-2`} />
              </label>
              <label className="block text-xs font-bold uppercase">
                Payment
                <select name="payment_method" className={`${inputClass} mt-2`}>
                  <option value="cash">Cash</option>
                  <option value="card">Card</option>
                  <option value="bank_transfer">Bank transfer</option>
                </select>
              </label>
              <label className="flex items-center gap-2 text-sm">
                <input type="checkbox" checked={payNow} onChange={(event) => setPayNow(event.target.checked)} className="size-4 accent-[#167c73]" />
                Take payment now
              </label>
              <div className="flex gap-2">
                <button disabled={quickSaving} className={`${buttonClass} flex-1`}>{quickSaving ? "Saving..." : "Create bill"}</button>
                <button type="button" onClick={() => setQuickOpen(false)} className="h-9 border border-[#cbc7bc] px-3 text-xs">Cancel</button>
              </div>
            </div>
          </form>
        </div>
      )}
    </AppShell>
  );
}
