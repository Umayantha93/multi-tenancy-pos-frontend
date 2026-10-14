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
  const [payDate, setPayDate] = useState(now.toISOString().slice(0, 10));
  const [dayStaff, setDayStaff] = useState<Array<{ id: number; name: string; daily_rate?: string | null; paid: boolean; amount?: string | null }>>([]);
  const [dayAmounts, setDayAmounts] = useState<Record<number, string>>({});
  const [payingId, setPayingId] = useState<number | null>(null);
  const load = useCallback(() => {
    api<{ data: Payroll[] }>(`/payroll?month=${month}&year=${year}`)
      .then((result) => setRows(result.data))
      .catch((caught) => setError(caught.message));
  }, [month, year]);
  const loadDayWages = useCallback(() => {
    api<{ employees: Array<{ id: number; name: string; daily_rate?: string | null; paid: boolean; amount?: string | null }> }>(`/payroll/day-wages?date=${payDate}`)
      .then((result) => {
        setDayStaff(result.employees);
        setDayAmounts(Object.fromEntries(result.employees.map((employee) => [employee.id, String(employee.paid ? employee.amount ?? "" : employee.daily_rate ?? "")])));
      })
      .catch((caught) => setError(caught instanceof Error ? caught.message : "Could not load day wages."));
  }, [payDate]);
  useEffect(() => { load(); }, [load]);
  useEffect(() => { loadDayWages(); }, [loadDayWages]);
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
  async function payDay(employeeId: number) {
    const amount = Number(dayAmounts[employeeId]);
    if (!Number.isFinite(amount) || amount <= 0) {
      setError("Enter the daily amount before paying.");
      return;
    }
    setPayingId(employeeId);
    setError("");
    try {
      await api("/payroll/day-wages", { method: "POST", body: JSON.stringify({ employee_id: employeeId, paid_on: payDate, amount }) });
      loadDayWages();
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Could not record the day payment.");
    } finally {
      setPayingId(null);
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
      <Panel className="mb-5 overflow-hidden">
        <div className="flex flex-wrap items-end justify-between gap-3 border-b border-[#d7d3c8] px-5 py-4">
          <div>
            <h2 className="font-display text-2xl font-semibold uppercase">End of day</h2>
            <p className="text-sm text-[#6f746e]">Daily employees stay out of monthly payroll. Paying them posts a named line on the finance report.</p>
          </div>
          <label className="text-xs font-bold uppercase">
            Date
            <input type="date" value={payDate} onChange={(event) => setPayDate(event.target.value)} className={`${inputClass} mt-2 w-40`} />
          </label>
        </div>
        {dayStaff.length === 0 ? (
          <p className="p-5 text-sm text-[#6f746e]">No end-of-day employees.</p>
        ) : (
          <ul className="divide-y divide-[#e2ded4]">
            {dayStaff.map((employee) => (
              <li key={employee.id} className="flex flex-wrap items-center gap-3 px-5 py-3 text-sm">
                <strong className="min-w-40 flex-1">{employee.name}</strong>
                <input
                  type="number"
                  min="0"
                  step="0.01"
                  disabled={employee.paid}
                  value={dayAmounts[employee.id] ?? ""}
                  onChange={(event) => setDayAmounts((current) => ({ ...current, [employee.id]: event.target.value }))}
                  className={`${inputClass} w-32`}
                />
                {employee.paid ? (
                  <span className="text-xs font-bold uppercase text-[#167c73]">Paid {money(employee.amount || 0)}</span>
                ) : (
                  <button type="button" disabled={payingId === employee.id} onClick={() => void payDay(employee.id)} className={buttonClass}>
                    {payingId === employee.id ? "Paying..." : "Pay"}
                  </button>
                )}
              </li>
            ))}
          </ul>
        )}
      </Panel>
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
