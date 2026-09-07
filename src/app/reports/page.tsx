"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { AppShell } from "@/components/app-shell";
import { ErrorMessage, PageState, Panel, inputClass } from "@/components/ui";
import { api, currentFeatures, formatDate, money } from "@/lib/api";
import { billStatusClass, billStatusLabel } from "@/lib/bill-stamp";
import { useBusinessProfile } from "@/lib/use-business-profile";
import { ShopFilter } from "@/components/branch-chip";

type EmployeeOption = { id: number; name: string; position?: string | null };
type EmployeeJob = {
  id: number;
  bill_number: string;
  admission_date: string;
  status: string;
  job_kind?: string | null;
  subtotal: string;
  balance_due: string;
  customer?: { name: string } | null;
  vehicle?: { number_plate: string } | null;
};

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
  employees?: EmployeeOption[];
  employee_jobs?: {
    employee: EmployeeOption | null;
    count: number;
    billed: number;
    jobs: EmployeeJob[];
  } | null;
};

function monthBounds(month: number, year: number) {
  const from = `${year}-${String(month).padStart(2, "0")}-01`;
  const last = new Date(year, month, 0).getDate();
  const to = `${year}-${String(month).padStart(2, "0")}-${String(last).padStart(2, "0")}`;
  return { from, to };
}

function yearBounds(year: number) {
  return { from: `${year}-01-01`, to: `${year}-12-31` };
}

type ServiceOps = {
  from: string;
  to: string;
  jobs: number;
  addon_revenue: number;
  addon_profit: number;
  average_addons_per_job: number;
  rows: Array<{
    service_addon_id: number;
    name: string;
    is_full_service: boolean;
    sold_qty: number;
    inside_full_service: number | null;
    revenue: number;
    profit: number;
  }>;
};

export default function ReportsPage() {
  const now = new Date();
  const [period, setPeriod] = useState<"month" | "year">("month");
  const [month, setMonth] = useState(now.getMonth() + 1);
  const [year, setYear] = useState(now.getFullYear());
  const [employeeId, setEmployeeId] = useState("");
  const [shopFilter, setShopFilter] = useState("");
  const [report, setReport] = useState<Report | null>(null);
  const [serviceOps, setServiceOps] = useState<ServiceOps | null>(null);
  const [tab, setTab] = useState<"overview" | "service">("overview");
  const [error, setError] = useState("");
  const profile = useBusinessProfile();
  const isPaint = profile.type === "paint";
  const isGarage = profile.type === "garage";
  const canServiceOps = isGarage && currentFeatures().includes("service_ops_report");

  const load = useCallback(() => {
    const range = period === "year" ? yearBounds(year) : monthBounds(month, year);
    const params = new URLSearchParams({ from: range.from, to: range.to });
    if (employeeId) params.set("employee_id", employeeId);
    if (shopFilter) params.set("branch_id", shopFilter);
    api<Report>(`/reports?${params}`).then(setReport).catch((caught) => setError(caught.message));
    if (canServiceOps) {
      api<ServiceOps>(`/reports/service-ops?from=${range.from}&to=${range.to}`)
        .then(setServiceOps)
        .catch(() => setServiceOps(null));
    }
  }, [period, month, year, employeeId, shopFilter, canServiceOps]);

  useEffect(() => { load(); }, [load]);

  return (
    <AppShell title="Reports" eyebrow="Sales, stock, staff, and past jobs for the selected period">
      {canServiceOps && (
        <div className="mb-5 flex gap-2">
          <button type="button" onClick={() => setTab("overview")} className={`h-10 px-4 text-xs font-bold uppercase ${tab === "overview" ? "bg-[#20221f] text-white" : "border border-[#c9c5b9]"}`}>Overview</button>
          <button type="button" onClick={() => setTab("service")} className={`h-10 px-4 text-xs font-bold uppercase ${tab === "service" ? "bg-[#20221f] text-white" : "border border-[#c9c5b9]"}`}>Service operations</button>
        </div>
      )}
      <form className="mb-5 flex flex-wrap items-end gap-3" onSubmit={(event) => { event.preventDefault(); load(); }}>
        <label className="text-[11px] font-bold uppercase">
          Period
          <select value={period} onChange={(event) => setPeriod(event.target.value as "month" | "year")} className={`${inputClass} mt-1.5 w-32`}>
            <option value="month">Month</option>
            <option value="year">Year</option>
          </select>
        </label>
        {period === "month" && (
          <label className="text-[11px] font-bold uppercase">
            Month
            <select value={month} onChange={(event) => setMonth(Number(event.target.value))} className={`${inputClass} mt-1.5 w-40`}>
              {Array.from({ length: 12 }, (_, index) => (
                <option key={index + 1} value={index + 1}>{new Date(2026, index).toLocaleString("en", { month: "long" })}</option>
              ))}
            </select>
          </label>
        )}
        <label className="text-[11px] font-bold uppercase">
          Year
          <input value={year} onChange={(event) => setYear(Number(event.target.value))} type="number" className={`${inputClass} mt-1.5 w-24`} />
        </label>
        <label className="text-[11px] font-bold uppercase">
          Employee
          <select value={employeeId} onChange={(event) => setEmployeeId(event.target.value)} className={`${inputClass} mt-1.5 w-52`}>
            <option value="">All employees</option>
            {(report?.employees ?? []).map((employee) => (
              <option key={employee.id} value={employee.id}>{employee.name}</option>
            ))}
          </select>
        </label>
        <ShopFilter value={shopFilter} onChange={setShopFilter} />
      </form>
      {error && <div className="mb-5"><ErrorMessage message={error} /></div>}
      {canServiceOps && tab === "service" ? (
        serviceOps ? (
          <div className="space-y-5">
            <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
              {[
                ["Jobs", String(serviceOps.jobs)],
                ["Addon revenue", money(serviceOps.addon_revenue)],
                ["Est. profit", money(serviceOps.addon_profit)],
                ["Avg addons / job", String(serviceOps.average_addons_per_job)],
              ].map(([label, value]) => (
                <Panel key={label} className="p-5">
                  <p className="text-xs font-bold uppercase text-[#6f746e]">{label}</p>
                  <p className="mt-3 font-display text-3xl font-semibold">{value}</p>
                </Panel>
              ))}
            </div>
            <Panel>
              <div className="border-b border-[#d7d3c8] px-5 py-4">
                <h2 className="font-display text-2xl font-semibold uppercase">Service addons</h2>
                <p className="text-xs text-[#6f746e]">Sold qty is billed lines only. Inside full service does not inflate sold qty. {formatDate(serviceOps.from)} – {formatDate(serviceOps.to)}</p>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full min-w-[640px] text-left text-sm">
                  <thead className="bg-[#eeece5] text-[10px] uppercase text-[#6f746e]">
                    <tr>
                      <th className="px-5 py-3">Service</th>
                      <th>Sold qty</th>
                      <th>Inside full svc</th>
                      <th className="text-right">Revenue</th>
                      <th className="pr-5 text-right">Est. profit</th>
                    </tr>
                  </thead>
                  <tbody>
                    {serviceOps.rows.map((row) => (
                      <tr key={row.service_addon_id} className="border-t border-[#e2ded4]">
                        <td className="px-5 py-3 font-semibold">{row.name}</td>
                        <td>{row.sold_qty}</td>
                        <td>{row.inside_full_service == null ? "—" : row.inside_full_service}</td>
                        <td className="text-right tabular-nums">{money(row.revenue)}</td>
                        <td className="pr-5 text-right tabular-nums">{money(row.profit)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
                {serviceOps.rows.length === 0 && <p className="p-8 text-center text-sm text-[#6f746e]">No billed service addons in this period.</p>}
              </div>
            </Panel>
          </div>
        ) : <PageState message="Loading service operations..." />
      ) : !report && !error ? <PageState message="Loading reports..." /> : report && (
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
          {employeeId && (
            <Panel>
              <div className="border-b border-[#d7d3c8] px-5 py-4">
                <h2 className="font-display text-2xl font-semibold uppercase">
                  Past jobs{report.employee_jobs?.employee ? ` · ${report.employee_jobs.employee.name}` : ""}
                </h2>
                <p className="text-xs text-[#6f746e]">
                  {report.employee_jobs?.count ?? 0} job{(report.employee_jobs?.count ?? 0) === 1 ? "" : "s"}
                  {" · "}
                  billed {money(report.employee_jobs?.billed ?? 0)}
                  {" · "}
                  {formatDate(report.from)} – {formatDate(report.to)}
                </p>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full min-w-[640px] text-left text-sm">
                  <thead className="bg-[#eeece5] text-[10px] uppercase text-[#6f746e]">
                    <tr>
                      <th className="px-5 py-3">Bill</th>
                      <th>Date</th>
                      <th>Customer</th>
                      <th>Vehicle</th>
                      <th>Status</th>
                      <th className="pr-5 text-right">Total</th>
                      <th />
                    </tr>
                  </thead>
                  <tbody>
                    {(report.employee_jobs?.jobs ?? []).map((job) => (
                      <tr key={job.id} className="border-t border-[#e2ded4]">
                        <td className="px-5 py-3 font-semibold">{job.bill_number}</td>
                        <td>{formatDate(job.admission_date)}</td>
                        <td>{job.customer?.name ?? "Walk-in"}</td>
                        <td>{job.vehicle?.number_plate ?? "—"}</td>
                        <td>
                          <span className={`px-2 py-1 text-[10px] font-bold uppercase ${billStatusClass(job.status)}`}>
                            {billStatusLabel(job.status)}
                          </span>
                        </td>
                        <td className="pr-5 text-right font-semibold">{money(job.subtotal)}</td>
                        <td className="pr-4">
                          <Link href={`/bills/${job.id}`} className="text-[#167c73]"><ArrowRight size={16} /></Link>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
                {(report.employee_jobs?.jobs ?? []).length === 0 && (
                  <p className="p-8 text-center text-sm text-[#6f746e]">No jobs assigned to this employee in this period.</p>
                )}
              </div>
            </Panel>
          )}
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
                        <td className="pr-5 text-right">{item.stock_qty}{isPaint ? " ml" : ""}</td>
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
