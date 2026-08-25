"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { useEffect, useState } from "react";
import { ArrowLeft, Printer } from "lucide-react";
import { AppShell } from "@/components/app-shell";
import { ErrorMessage, PageState } from "@/components/ui";
import { api, formatDate, mediaUrl, money } from "@/lib/api";

type Payslip = {
  id: number;
  month: number;
  year: number;
  days_present: number;
  days_absent: number;
  hours_worked: string;
  overtime_hours: string;
  overtime_pay: string;
  base_salary: string;
  allowances_total?: string;
  target_incentive?: string;
  bonus: string;
  gross_pay?: string;
  epf_employee?: string;
  epf_employer?: string;
  etf_employer?: string;
  unpaid_leave_days?: number;
  deductions: string;
  net_salary: string;
  generated_at?: string;
  employee: { name: string; position: string; nic?: string; phone?: string };
  tenant?: {
    business_name: string;
    address?: string | null;
    contact_phone?: string | null;
    owner_phone?: string | null;
    tin?: string | null;
    logo_url?: string | null;
    logo?: string | null;
  };
};

function monthName(month: number, year: number) {
  return new Date(year, month - 1, 1).toLocaleString("en-LK", { month: "long", year: "numeric" });
}

export default function PayslipPage() {
  const { id } = useParams<{ id: string }>();
  const [row, setRow] = useState<Payslip | null>(null);
  const [error, setError] = useState("");

  useEffect(() => {
    api<Payslip>(`/payroll/${id}`).then(setRow).catch((caught) => setError(caught.message));
  }, [id]);

  if (!row && !error) {
    return <AppShell title="Payslip"><PageState message="Opening payslip..." /></AppShell>;
  }
  if (error || !row) {
    return <AppShell title="Payslip"><ErrorMessage message={error || "Payslip not found."} /></AppShell>;
  }

  const logo = mediaUrl(row.tenant?.logo_url || row.tenant?.logo);
  const earnings = [
    ["Basic salary", row.base_salary],
    ["Overtime", row.overtime_pay],
    ["Allowances", row.allowances_total || "0"],
    ["Target incentive", row.target_incentive || "0"],
    ["Bonus", row.bonus],
  ].filter(([, value]) => Number(value) > 0);
  const deductions = [
    ["EPF employee (8%)", row.epf_employee || "0"],
    ["Unpaid leave / other", row.deductions],
  ].filter(([, value]) => Number(value) > 0);

  return (
    <AppShell
      title="Payslip"
      eyebrow={`${row.employee.name} · ${monthName(row.month, row.year)}`}
      action={
        <div className="no-print flex gap-2">
          <Link href="/payroll" className="grid size-10 place-items-center border border-[#c9c5b9]"><ArrowLeft size={18} /></Link>
          <button type="button" onClick={() => window.print()} className="grid size-10 place-items-center border border-[#c9c5b9]" title="Print payslip">
            <Printer size={18} />
          </button>
        </div>
      }
    >
      <div className="mx-auto max-w-[210mm] bg-white p-8 text-[#20221f] shadow-[0_0_0_1px_#d7d3c8]">
        <header className="bill-letterhead flex items-start justify-between gap-4 border-b-2 border-[#20221f] pb-4">
          <div className="flex items-start gap-3">
            {logo ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={logo} alt="" className="h-16 w-16 object-contain" />
            ) : null}
            <div>
              <p className="font-display text-3xl font-semibold uppercase leading-none">{row.tenant?.business_name ?? "Business"}</p>
              <p className="mt-2 text-xs text-[#6f746e]">{row.tenant?.address}</p>
              <p className="text-xs text-[#6f746e]">{row.tenant?.contact_phone || row.tenant?.owner_phone}{row.tenant?.tin ? ` · TIN ${row.tenant.tin}` : ""}</p>
            </div>
          </div>
          <div className="text-right">
            <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-[#167c73]">Payslip</p>
            <p className="mt-1 font-display text-2xl font-semibold uppercase">{monthName(row.month, row.year)}</p>
            <p className="text-xs text-[#6f746e]">No. PAY-{row.year}-{String(row.month).padStart(2, "0")}-{row.id}</p>
          </div>
        </header>

        <section className="mt-5 grid grid-cols-2 gap-3 border border-[#d7d3c8] p-4 text-sm">
          <div><p className="text-[10px] font-bold uppercase text-[#6f746e]">Employee</p><p className="font-semibold">{row.employee.name}</p></div>
          <div><p className="text-[10px] font-bold uppercase text-[#6f746e]">Position</p><p className="font-semibold">{row.employee.position}</p></div>
          <div><p className="text-[10px] font-bold uppercase text-[#6f746e]">NIC</p><p className="font-semibold">{row.employee.nic || "—"}</p></div>
          <div><p className="text-[10px] font-bold uppercase text-[#6f746e]">Days present / absent</p><p className="font-semibold">{row.days_present} / {row.days_absent}</p></div>
          <div><p className="text-[10px] font-bold uppercase text-[#6f746e]">Hours / OT</p><p className="font-semibold">{row.hours_worked} hrs · {row.overtime_hours} OT</p></div>
          <div><p className="text-[10px] font-bold uppercase text-[#6f746e]">Generated</p><p className="font-semibold">{row.generated_at ? formatDate(row.generated_at) : "—"}</p></div>
        </section>

        <div className="mt-5 grid gap-5 sm:grid-cols-2">
          <table className="w-full text-sm">
            <thead><tr className="bg-[#242723] text-left text-[10px] uppercase text-white"><th className="px-3 py-2">Earnings</th><th className="px-3 py-2 text-right">Amount</th></tr></thead>
            <tbody>
              {earnings.map(([label, value]) => (
                <tr key={label} className="border-b border-[#e2ded4]"><td className="px-3 py-2">{label}</td><td className="px-3 py-2 text-right tabular-nums">{money(value)}</td></tr>
              ))}
              <tr className="font-semibold"><td className="px-3 py-2">Gross</td><td className="px-3 py-2 text-right">{money(row.gross_pay || Number(row.base_salary) + Number(row.overtime_pay || 0))}</td></tr>
            </tbody>
          </table>
          <table className="w-full text-sm">
            <thead><tr className="bg-[#242723] text-left text-[10px] uppercase text-white"><th className="px-3 py-2">Deductions</th><th className="px-3 py-2 text-right">Amount</th></tr></thead>
            <tbody>
              {deductions.length === 0 ? (
                <tr><td className="px-3 py-2 text-[#6f746e]" colSpan={2}>No deductions</td></tr>
              ) : deductions.map(([label, value]) => (
                <tr key={label} className="border-b border-[#e2ded4]"><td className="px-3 py-2">{label}</td><td className="px-3 py-2 text-right tabular-nums">{money(value)}</td></tr>
              ))}
            </tbody>
          </table>
        </div>

        <div className="mt-5 flex items-center justify-between bg-[#242723] px-4 py-4 text-white">
          <p className="text-[10px] font-bold uppercase tracking-wide">Net salary payable</p>
          <p className="font-display text-3xl font-semibold">{money(row.net_salary)}</p>
        </div>

        {(Number(row.epf_employer || 0) > 0 || Number(row.etf_employer || 0) > 0) && (
          <p className="mt-3 text-xs text-[#6f746e]">
            Employer contributions (not deducted from net): EPF 12% {money(row.epf_employer || 0)} · ETF 3% {money(row.etf_employer || 0)}.
          </p>
        )}

        <div className="mt-10 grid grid-cols-2 gap-10 text-xs">
          <div>
            <div className="h-12 border-b border-[#20221f]" />
            <p className="mt-2 uppercase tracking-wide">Employee signature</p>
          </div>
          <div>
            <div className="h-12 border-b border-[#20221f]" />
            <p className="mt-2 uppercase tracking-wide">Employer / authorised</p>
          </div>
        </div>
        <p className="mt-6 text-[10px] text-[#6f746e]">This is a computer-generated payslip from Bay 06 Cloud. Keep it with your wage records.</p>
      </div>
    </AppShell>
  );
}
