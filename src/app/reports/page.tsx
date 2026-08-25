"use client";

import { useCallback, useEffect, useState } from "react";
import { AppShell } from "@/components/app-shell";
import { ErrorMessage, PageState, Panel, inputClass } from "@/components/ui";
import { api, formatDate, money } from "@/lib/api";

type Report = {
  from: string;
  to: string;
  sales: {
    billed: number;
    paid: number;
    outstanding: number;
    count: number;
    by_day: Array<{ date: string; billed: number; paid: number }>;
  };
  stock: {
    on_hand_value: number;
    sku_count: number;
    low_stock: Array<{ id: number; name: string; stock_qty: number }>;
  };
  receivables: Array<{
    id: number;
    bill_number: string;
    status: string;
    balance_due: string;
    customer?: { name: string } | null;
  }>;
  staff: {
    payroll_net: number;
    payrolls: Array<{ id: number; net_salary: string; employee?: { name: string } | null }>;
    attendance: Array<{ employee_id: number; hours: number; overtime: number; days: number; employee?: { name: string } | null }>;
  };
};

function monthBounds(month: number, year: number) {
  const from = `${year}-${String(month).padStart(2, "0")}-01`;
  const last = new Date(year, month, 0).getDate();
  const to = `${year}-${String(month).padStart(2, "0")}-${String(last).padStart(2, "0")}`;
  return { from, to };
}

export default function ReportsPage() {
  const now = new Date();
  const [month, setMonth] = useState(now.getMonth() + 1);
  const [year, setYear] = useState(now.getFullYear());
  const [report, setReport] = useState<Report | null>(null);
  const [error, setError] = useState("");

  const load = useCallback(() => {
    const { from, to } = monthBounds(month, year);
    api<Report>(`/reports?from=${from}&to=${to}`).then(setReport).catch((caught) => setError(caught.message));
  }, [month, year]);

  useEffect(() => { load(); }, [load]);

  return (
    <AppShell title="Reports" eyebrow="Sales, stock, and staff for the selected month">
      <form className="mb-5 flex flex-wrap items-end gap-3" onSubmit={(event) => { event.preventDefault(); load(); }}>
        <label className="text-xs font-bold uppercase">
          Month
          <select value={month} onChange={(event) => setMonth(Number(event.target.value))} className={`${inputClass} mt-2 w-40`}>
            {Array.from({ length: 12 }, (_, index) => (
              <option key={index + 1} value={index + 1}>{new Date(2026, index).toLocaleString("en", { month: "long" })}</option>
            ))}
          </select>
        </label>
        <label className="text-xs font-bold uppercase">
          Year
          <input value={year} onChange={(event) => setYear(Number(event.target.value))} type="number" className={`${inputClass} mt-2 w-28`} />
        </label>
      </form>
      {error && <div className="mb-5"><ErrorMessage message={error} /></div>}
      {!report && !error ? <PageState message="Loading reports..." /> : report && (
        <div className="space-y-5">
          <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
            {[
              ["Billed", money(report.sales.billed)],
              ["Collected", money(report.sales.paid)],
              ["Outstanding", money(report.sales.outstanding)],
              ["Bills", String(report.sales.count)],
            ].map(([label, value]) => (
              <Panel key={label} className="p-5">
                <p className="text-xs font-bold uppercase text-[#6f746e]">{label}</p>
                <p className="mt-3 font-display text-3xl font-semibold">{value}</p>
              </Panel>
            ))}
          </div>
          <div className="grid gap-5 xl:grid-cols-2">
            <Panel>
              <div className="border-b border-[#d7d3c8] px-5 py-4">
                <h2 className="font-display text-2xl font-semibold uppercase">Owing customers</h2>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full min-w-[520px] text-left text-sm">
                  <thead className="bg-[#eeece5] text-[10px] uppercase text-[#6f746e]">
                    <tr><th className="px-5 py-3">Bill</th><th>Customer</th><th className="pr-5 text-right">Due</th></tr>
                  </thead>
                  <tbody>
                    {report.receivables.map((row) => (
                      <tr key={row.id} className="border-t border-[#e2ded4]">
                        <td className="px-5 py-3 font-semibold">{row.bill_number}</td>
                        <td>{row.customer?.name ?? "—"}</td>
                        <td className="pr-5 text-right font-semibold">{money(row.balance_due)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
                {report.receivables.length === 0 && <p className="p-8 text-center text-sm text-[#6f746e]">No outstanding bills.</p>}
              </div>
            </Panel>
            <Panel>
              <div className="border-b border-[#d7d3c8] px-5 py-4">
                <h2 className="font-display text-2xl font-semibold uppercase">Low stock</h2>
                <p className="text-xs text-[#6f746e]">{money(report.stock.on_hand_value)} on hand · {report.stock.sku_count} SKUs</p>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full text-left text-sm">
                  <thead className="bg-[#eeece5] text-[10px] uppercase text-[#6f746e]">
                    <tr><th className="px-5 py-3">Item</th><th className="pr-5 text-right">Qty</th></tr>
                  </thead>
                  <tbody>
                    {report.stock.low_stock.map((item) => (
                      <tr key={`${item.id}-${item.name}`} className="border-t border-[#e2ded4]">
                        <td className="px-5 py-3 font-semibold">{item.name}</td>
                        <td className="pr-5 text-right">{item.stock_qty}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
                {report.stock.low_stock.length === 0 && <p className="p-8 text-center text-sm text-[#6f746e]">No low-stock items.</p>}
              </div>
            </Panel>
          </div>
          <Panel>
            <div className="border-b border-[#d7d3c8] px-5 py-4">
              <h2 className="font-display text-2xl font-semibold uppercase">Staff this period</h2>
              <p className="text-xs text-[#6f746e]">Payroll net {money(report.staff.payroll_net)} · {formatDate(report.from)} – {formatDate(report.to)}</p>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full min-w-[520px] text-left text-sm">
                <thead className="bg-[#eeece5] text-[10px] uppercase text-[#6f746e]">
                  <tr><th className="px-5 py-3">Employee</th><th>Days</th><th>Hours</th><th className="pr-5 text-right">OT</th></tr>
                </thead>
                <tbody>
                  {report.staff.attendance.map((row) => (
                    <tr key={row.employee_id} className="border-t border-[#e2ded4]">
                      <td className="px-5 py-3 font-semibold">{row.employee?.name ?? `#${row.employee_id}`}</td>
                      <td>{row.days}</td>
                      <td>{row.hours}</td>
                      <td className="pr-5 text-right">{row.overtime}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
              {report.staff.attendance.length === 0 && <p className="p-8 text-center text-sm text-[#6f746e]">No attendance in this period.</p>}
            </div>
          </Panel>
        </div>
      )}
    </AppShell>
  );
}
