"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { ArrowRight, ClipboardPlus, Search } from "lucide-react";
import { AppShell } from "@/components/app-shell";
import { ErrorMessage, PageState, Panel, inputClass } from "@/components/ui";
import { api, formatDate, money } from "@/lib/api";
import { billStatusClass, billStatusLabel, isOweInUrgent } from "@/lib/bill-stamp";

type Bill = {
  id: number;
  bill_number: string;
  admission_date: string;
  status: string;
  subtotal: string;
  balance_due: string;
  owe_in_due_date?: string | null;
  customer: { name: string; phone: string } | null;
  notes?: string | null;
};

export default function RepairBillsPage() {
  const [bills, setBills] = useState<Bill[]>([]);
  const [search, setSearch] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setLoading(true);
    const timer = setTimeout(() => {
      const params = new URLSearchParams({ search, per_page: "50", job_kind: "repair" });
      api<{ data: Bill[] }>(`/bills?${params}`)
        .then((result) => setBills(result.data))
        .catch((caught) => setError(caught.message))
        .finally(() => setLoading(false));
    }, 250);
    return () => clearTimeout(timer);
  }, [search]);

  return (
    <AppShell
      title="Repair bills"
      eyebrow="Jobs opened from the counter"
      action={
        <Link href="/repairs/new" className="flex h-10 items-center gap-2 bg-[#f5c842] px-3 text-sm font-semibold">
          <ClipboardPlus size={18} /><span className="hidden sm:inline">New repair</span>
        </Link>
      }
    >
      <label className="relative mb-5 block max-w-md">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-[#6f746e]" size={16} />
        <input value={search} onChange={(event) => setSearch(event.target.value)} className={`${inputClass} pl-10`} placeholder="Search repair bill or customer" />
      </label>
      {error ? <ErrorMessage message={error} /> : loading ? (
        <PageState message="Loading repair bills..." />
      ) : (
        <Panel>
          <div className="overflow-x-auto">
            <table className="w-full min-w-[720px] text-left text-sm">
              <thead className="bg-[#eeece5] text-[10px] uppercase text-[#6f746e]">
                <tr>
                  <th className="px-5 py-3">Ref</th>
                  <th>Date</th>
                  <th>Customer</th>
                  <th>Note</th>
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
                      <td>{bill.customer?.name ?? "Walk-in"}</td>
                      <td className="max-w-xs truncate text-[#6f746e]">{bill.notes || "—"}</td>
                      <td>
                        <span className={`px-2 py-1 text-[10px] font-bold uppercase ${billStatusClass(bill.status, bill.owe_in_due_date)}`}>
                          {billStatusLabel(bill.status)}
                        </span>
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
              <p className="p-8 text-center text-sm text-[#6f746e]">No repair bills yet.</p>
            )}
          </div>
        </Panel>
      )}
    </AppShell>
  );
}
