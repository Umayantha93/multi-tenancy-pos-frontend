"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { ArrowRight, ClipboardPlus, Search } from "lucide-react";
import { AppShell } from "@/components/app-shell";
import { ErrorMessage, PageState, Panel, inputClass } from "@/components/ui";
import { api, money } from "@/lib/api";

type Bill = {
  id: number;
  bill_number: string;
  admission_date: string;
  status: string;
  subtotal: string;
  balance_due: string;
  customer: { name: string; phone: string };
  vehicle: { number_plate: string; make?: string; model?: string };
};

export default function BillsPage() {
  const [bills, setBills] = useState<Bill[]>([]);
  const [search, setSearch] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setLoading(true);
    const timer = setTimeout(() => {
      api<{ data: Bill[] }>(`/bills?search=${encodeURIComponent(search)}`)
        .then((result) => setBills(result.data))
        .catch((caught) => setError(caught.message))
        .finally(() => setLoading(false));
    }, 250);
    return () => clearTimeout(timer);
  }, [search]);

  return (
    <AppShell
      title="Job cards"
      eyebrow="Open bills & queue"
      action={
        <Link href="/vehicles/admit" className="flex h-10 items-center gap-2 bg-[#f5c842] px-3 text-sm font-semibold">
          <ClipboardPlus size={18} /><span className="hidden sm:inline">New admission</span>
        </Link>
      }
    >
      <div className="mb-5 max-w-md">
        <label className="relative block">
          <Search className="absolute left-3 top-3 text-[#6f746e]" size={18} />
          <input
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            className={`${inputClass} pl-10`}
            placeholder="Search job, plate or customer"
          />
        </label>
      </div>
      {error ? <ErrorMessage message={error} /> : loading ? (
        <PageState message="Loading job cards..." />
      ) : (
        <Panel className="overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full min-w-[760px] text-left text-sm">
              <thead className="bg-[#242723] text-[10px] uppercase text-white/60">
                <tr>
                  <th className="px-5 py-3">Job card</th>
                  <th>Vehicle</th>
                  <th>Customer</th>
                  <th>Status</th>
                  <th>Subtotal</th>
                  <th>Balance</th>
                  <th />
                </tr>
              </thead>
              <tbody>
                {bills.map((bill) => (
                  <tr key={bill.id} className="border-t border-[#e2ded4] hover:bg-[#f5c842]/8">
                    <td className="px-5 py-4">
                      <p className="font-semibold">{bill.bill_number}</p>
                      <p className="text-xs text-[#6f746e]">{bill.admission_date}</p>
                    </td>
                    <td>
                      <strong>{bill.vehicle.number_plate}</strong>
                      <p className="text-xs text-[#6f746e]">{bill.vehicle.make} {bill.vehicle.model}</p>
                    </td>
                    <td>
                      {bill.customer.name}
                      <p className="text-xs text-[#6f746e]">{bill.customer.phone}</p>
                    </td>
                    <td>
                      <span className="bg-[#f5c842]/25 px-2 py-1 text-[10px] font-bold uppercase">
                        {bill.status.replace("_", " ")}
                      </span>
                    </td>
                    <td>{money(bill.subtotal)}</td>
                    <td className="font-semibold">{money(bill.balance_due)}</td>
                    <td>
                      <Link href={`/bills/${bill.id}`} aria-label={`Open ${bill.bill_number}`} className="text-[#167c73]">
                        <ArrowRight size={19} />
                      </Link>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            {bills.length === 0 && <p className="p-10 text-center text-sm text-[#6f746e]">No matching job cards.</p>}
          </div>
        </Panel>
      )}
    </AppShell>
  );
}
