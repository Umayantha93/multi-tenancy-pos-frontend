"use client";

import { useEffect, useMemo, useState } from "react";
import { PlatformShell } from "@/components/platform-shell";
import { ErrorMessage, PageState, Panel, inputClass } from "@/components/ui";
import { api, formatDate, money } from "@/lib/api";

const MONTHS = [
  [1, "Jan"], [2, "Feb"], [3, "Mar"], [4, "Apr"], [5, "May"], [6, "Jun"],
  [7, "Jul"], [8, "Aug"], [9, "Sep"], [10, "Oct"], [11, "Nov"], [12, "Dec"],
] as const;

type IncomeReport = {
  year: number;
  month: number | null;
  collected: number;
  payment_count: number;
  expected_monthly: number;
  outstanding_month: number | null;
  outstanding_total: number;
  outstanding: Array<{ tenant_id: number; business_name: string; plan_amount: number }>;
  months: Array<{ month: number; period: string; label: string; collected: number; count: number }>;
  tenants: Array<{ tenant_id: number; business_name: string; collected: number; count: number }>;
  payments: Array<{
    id: number;
    tenant_id: number;
    business_name: string;
    period: string;
    amount: number;
    paid_at: string | null;
    notes: string | null;
  }>;
};

export default function SuperAdminIncomePage() {
  const [year, setYear] = useState(String(new Date().getFullYear()));
  const [month, setMonth] = useState("");
  const [data, setData] = useState<IncomeReport | null>(null);
  const [error, setError] = useState("");

  function load(nextYear = year, nextMonth = month) {
    const params = new URLSearchParams({ year: nextYear });
    if (nextMonth) params.set("month", nextMonth);
    api<IncomeReport>(`/super-admin/income?${params}`)
      .then(setData)
      .catch((caught) => setError(caught.message));
  }

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const peak = Math.max(1, ...(data?.months.map((row) => row.collected) ?? [1]));
  const years = useMemo(() => {
    const current = new Date().getFullYear();
    return Array.from({ length: 6 }, (_, index) => String(current - index));
  }, []);

  return (
    <PlatformShell title="Income" eyebrow="Tenant subscription fees">
      <div className="mb-5 flex flex-wrap items-end gap-3">
        <label className="text-xs font-bold uppercase">
          Year
          <select
            value={year}
            onChange={(event) => {
              setYear(event.target.value);
              load(event.target.value, month);
            }}
            className={`${inputClass} mt-2 w-28`}
          >
            {years.map((value) => (
              <option key={value} value={value}>{value}</option>
            ))}
          </select>
        </label>
        <label className="text-xs font-bold uppercase">
          Month
          <select
            value={month}
            onChange={(event) => {
              setMonth(event.target.value);
              load(year, event.target.value);
            }}
            className={`${inputClass} mt-2 w-40`}
          >
            <option value="">Full year</option>
            {MONTHS.map(([value, label]) => (
              <option key={value} value={value}>{label}</option>
            ))}
          </select>
        </label>
      </div>

      {error && <div className="mb-5"><ErrorMessage message={error} /></div>}
      {!data && !error ? <PageState message="Loading income..." /> : data && (
        <>
          <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
            <Panel className="p-5">
              <p className="text-xs font-bold uppercase text-[#6f746e]">Collected</p>
              <p className="mt-3 font-display text-3xl font-semibold">{money(data.collected)}</p>
              <p className="mt-2 text-xs text-[#6f746e]">{data.payment_count} fee payment{data.payment_count === 1 ? "" : "s"}</p>
            </Panel>
            <Panel className="p-5">
              <p className="text-xs font-bold uppercase text-[#6f746e]">Expected / month</p>
              <p className="mt-3 font-display text-3xl font-semibold">{money(data.expected_monthly)}</p>
              <p className="mt-2 text-xs text-[#6f746e]">Active monthly plans</p>
            </Panel>
            <Panel className="p-5">
              <p className="text-xs font-bold uppercase text-[#6f746e]">Still unpaid</p>
              <p className="mt-3 font-display text-3xl font-semibold">{money(data.outstanding_total)}</p>
              <p className="mt-2 text-xs text-[#6f746e]">
                {data.outstanding_month ? `${data.outstanding.length} shops this month` : "Select a month"}
              </p>
            </Panel>
            <Panel className="p-5">
              <p className="text-xs font-bold uppercase text-[#6f746e]">Paying shops</p>
              <p className="mt-3 font-display text-3xl font-semibold">{data.tenants.length}</p>
              <p className="mt-2 text-xs text-[#6f746e]">With a recorded fee in this period</p>
            </Panel>
          </div>

          {!month && (
            <Panel className="mt-5 p-5">
              <h2 className="font-display text-2xl font-semibold uppercase">By month</h2>
              <div className="mt-6 flex h-48 items-end gap-2 overflow-x-auto border-b border-[#cbc7bc]">
                {data.months.map((row) => (
                  <div key={row.month} className="flex min-w-10 flex-1 flex-col items-center justify-end gap-2">
                    <span className="text-[10px] font-bold">{row.count ? money(row.collected).replace("LKR", "").trim() : ""}</span>
                    <div className="w-full max-w-12 bg-[#167c73]" style={{ height: `${row.collected > 0 ? Math.max(12, (row.collected / peak) * 140) : 4}px` }} />
                    <span className="pb-2 text-[10px] text-[#6f746e]">{row.label}</span>
                  </div>
                ))}
              </div>
            </Panel>
          )}

          {data.outstanding.length > 0 && (
            <Panel className="mt-5">
              <div className="border-b border-[#d7d3c8] px-5 py-4">
                <h2 className="font-display text-2xl font-semibold uppercase">Unpaid this month</h2>
              </div>
              <div className="divide-y divide-[#e2ded4]">
                {data.outstanding.map((row) => (
                  <div key={row.tenant_id} className="flex items-center justify-between gap-3 px-5 py-3 text-sm">
                    <span className="font-semibold">{row.business_name}</span>
                    <span className="tabular-nums">{money(row.plan_amount)}</span>
                  </div>
                ))}
              </div>
            </Panel>
          )}

          <Panel className="mt-5">
            <div className="border-b border-[#d7d3c8] px-5 py-4">
              <h2 className="font-display text-2xl font-semibold uppercase">Collected fees</h2>
            </div>
            {data.payments.length === 0 ? (
              <p className="p-8 text-center text-sm text-[#6f746e]">No fee payments in this period.</p>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full min-w-[640px] text-left text-sm">
                  <thead className="bg-[#eeece5] text-[10px] uppercase text-[#6f746e]">
                    <tr>
                      <th className="px-5 py-3">Business</th>
                      <th>Period</th>
                      <th>Paid on</th>
                      <th className="pr-5 text-right">Amount</th>
                    </tr>
                  </thead>
                  <tbody>
                    {data.payments.map((row) => (
                      <tr key={row.id} className="border-t border-[#e2ded4]">
                        <td className="px-5 py-3 font-semibold">{row.business_name}</td>
                        <td>{row.period}</td>
                        <td>{formatDate(row.paid_at)}</td>
                        <td className="pr-5 text-right tabular-nums">{money(row.amount)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </Panel>
        </>
      )}
    </PlatformShell>
  );
}
