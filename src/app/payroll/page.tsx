"use client";

import Link from "next/link";
import { FormEvent, useCallback, useEffect, useState } from "react";
import { Calculator } from "lucide-react";
import { AppShell } from "@/components/app-shell";
import { buttonClass, ErrorMessage, inputClass, Panel } from "@/components/ui";
import { api, money } from "@/lib/api";

type Payroll = {
  id: number;
  month: number;
  year: number;
  days_present: number;
  days_absent: number;
  overtime_hours: string;
  overtime_pay?: string;
  allowances_total?: string;
  epf_employee?: string;
  epf_employer?: string;
  etf_employer?: string;
  net_salary: string;
  employee: { name: string; position: string };
};

export default function PayrollPage() {
  const now = new Date();
  const [month, setMonth] = useState(now.getMonth() + 1);
  const [year, setYear] = useState(now.getFullYear());
  const [rows, setRows] = useState<Payroll[]>([]);
  const [error, setError] = useState("");
  const [working, setWorking] = useState(false);
  const load = useCallback(() => {
    api<{ data: Payroll[] }>(`/payroll?month=${month}&year=${year}`)
      .then((result) => setRows(result.data))
      .catch((caught) => setError(caught.message));
  }, [month, year]);
  useEffect(() => { load(); }, [load]);
  async function generate(event: FormEvent) {
    event.preventDefault();
    setWorking(true);
    try {
      await api("/payroll/generate", { method: "POST", body: JSON.stringify({ month, year }) });
      load();
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Generation failed.");
    } finally {
      setWorking(false);
    }
  }
  const epfPayable = rows.reduce((sum, row) => sum + Number(row.epf_employee || 0) + Number(row.epf_employer || 0), 0);
  const etfPayable = rows.reduce((sum, row) => sum + Number(row.etf_employer || 0), 0);

  return (
    <AppShell title="Monthly payroll" eyebrow="Attendance-based salary. EPF stays off unless the employee is ticked.">
      <form onSubmit={generate} className="mb-5 flex flex-wrap items-end gap-3">
        <label className="text-xs font-bold uppercase">
          Month
          <select value={month} onChange={(event) => setMonth(Number(event.target.value))} className={`${inputClass} mt-2 w-40`}>
            {Array.from({ length: 12 }, (_, index) => <option key={index + 1} value={index + 1}>{new Date(2026, index).toLocaleString("en", { month: "long" })}</option>)}
          </select>
        </label>
        <label className="text-xs font-bold uppercase">
          Year
          <input value={year} onChange={(event) => setYear(Number(event.target.value))} type="number" className={`${inputClass} mt-2 w-28`} />
        </label>
        <button disabled={working} className={buttonClass}><Calculator size={18} />{working ? "Calculating..." : "Generate payroll"}</button>
      </form>
      {error && <div className="mb-5"><ErrorMessage message={error} /></div>}
      {(epfPayable > 0 || etfPayable > 0) && (
        <div className="mb-5 grid gap-3 sm:grid-cols-2">
          <Panel className="p-4"><p className="text-xs font-bold uppercase text-[#6f746e]">EPF payable</p><p className="mt-1 font-display text-2xl font-semibold">{money(epfPayable)}</p></Panel>
          <Panel className="p-4"><p className="text-xs font-bold uppercase text-[#6f746e]">ETF payable</p><p className="mt-1 font-display text-2xl font-semibold">{money(etfPayable)}</p></Panel>
        </div>
      )}
      <Panel className="overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full min-w-[920px] text-left text-sm">
            <thead className="bg-[#242723] text-[10px] uppercase text-white/60">
              <tr>
                <th className="px-5 py-3">Employee</th>
                <th>Present</th>
                <th>Absent</th>
                <th>OT hrs</th>
                <th>OT pay</th>
                <th>Allowances</th>
                <th>EPF emp.</th>
                <th className="pr-5 text-right">Net salary</th>
                <th />
              </tr>
            </thead>
            <tbody>
              {rows.map((row) => (
                <tr key={row.id} className="border-t border-[#e2ded4]">
                  <td className="px-5 py-4 font-semibold">{row.employee.name}<p className="text-xs font-normal text-[#6f746e]">{row.employee.position}</p></td>
                  <td>{row.days_present} days</td>
                  <td>{row.days_absent} days</td>
                  <td>{row.overtime_hours} hrs</td>
                  <td>{money(row.overtime_pay || 0)}</td>
                  <td>{money(row.allowances_total || 0)}</td>
                  <td>{money(row.epf_employee || 0)}</td>
                  <td className="pr-5 text-right font-semibold">{money(row.net_salary)}</td>
                  <td className="pr-4 text-right">
                    <Link href={`/payroll/${row.id}/payslip`} className="text-xs font-bold uppercase text-[#167c73]">Payslip</Link>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          {rows.length === 0 && <p className="p-10 text-center text-sm text-[#6f746e]">Payroll has not been generated for this period.</p>}
        </div>
      </Panel>
    </AppShell>
  );
}
