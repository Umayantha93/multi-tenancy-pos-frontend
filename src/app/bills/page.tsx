"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { ArrowRight, ClipboardPlus, Search, X } from "lucide-react";
import { AppShell } from "@/components/app-shell";
import { ErrorMessage, PageState, Panel, inputClass } from "@/components/ui";
import { api, currentUser, formatDate, money } from "@/lib/api";
import { profileFor } from "@/lib/business-profiles";

type Bill = {
  id: number;
  bill_number: string;
  admission_date: string;
  status: string;
  subtotal: string;
  balance_due: string;
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
  const profile = useMemo(() => profileFor(currentUser()?.tenant?.business_type), []);
  const rangeInvalid = Boolean(dateFrom && dateTo && dateFrom > dateTo);

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
      if (dateFrom) params.set("date_from", dateFrom);
      if (dateTo) params.set("date_to", dateTo);

      api<{ data: Bill[] }>(`/bills?${params}`)
        .then((result) => setBills(result.data))
        .catch((caught) => setError(caught.message))
        .finally(() => setLoading(false));
    }, 250);
    return () => clearTimeout(timer);
  }, [search, dateFrom, dateTo, rangeInvalid]);

  function clearDates() {
    setDateFrom("");
    setDateTo("");
  }

  return (
    <AppShell
      title={profile.billingLabel}
      eyebrow="Open bills & queue"
      action={
        <Link href={profile.primaryCta.href} className="flex h-10 items-center gap-2 bg-[#f5c842] px-3 text-sm font-semibold">
          <ClipboardPlus size={18} /><span className="hidden sm:inline">{profile.primaryCta.label}</span>
        </Link>
      }
    >
      <div className="mb-5 flex flex-wrap items-end gap-3">
        <label className="relative block min-w-56 max-w-md flex-1">
          <span className="mb-1 block text-[10px] font-bold uppercase text-[#6f746e]">Search</span>
          <span className="relative block">
            <Search className="absolute left-3 top-3 text-[#6f746e]" size={18} />
            <input
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              className={`${inputClass} pl-10`}
              placeholder={`Search ${profile.billingSingular.toLowerCase()} or customer`}
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
            className="inline-flex h-11 items-center gap-2 border border-[#c9c5b9] bg-white px-3 text-sm font-semibold text-[#6f746e] hover:border-[#167c73] hover:text-[#167c73]"
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
                  <th>Customer</th>
                  <th>Detail</th>
                  <th>Status</th>
                  <th className="pr-5 text-right">Due</th>
                  <th />
                </tr>
              </thead>
              <tbody>
                {bills.map((bill) => (
                  <tr key={bill.id} className="border-t border-[#e2ded4]">
                    <td className="px-5 py-4 font-semibold">{bill.bill_number}</td>
                    <td>{formatDate(bill.admission_date)}</td>
                    <td>{bill.customer?.name ?? "Walk-in"}</td>
                    <td>{bill.vehicle?.number_plate ?? "—"}</td>
                    <td>
                      <span className={`px-2 py-1 text-[10px] font-bold uppercase ${
                        bill.status === "paid"
                          ? "bg-[#167c73]/10 text-[#167c73]"
                          : bill.status === "closed"
                            ? "bg-[#20221f] text-white"
                            : "bg-[#f5c842]/25 text-[#735a00]"
                      }`}>
                        {bill.status.replace("_", " ")}
                      </span>
                    </td>
                    <td className="pr-5 text-right font-semibold">{money(bill.balance_due)}</td>
                    <td className="pr-4">
                      <Link href={`/bills/${bill.id}`} className="text-[#167c73]"><ArrowRight size={18} /></Link>
                    </td>
                  </tr>
                ))}
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
    </AppShell>
  );
}
