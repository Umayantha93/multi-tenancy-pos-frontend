"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { ArrowRight, Banknote, Boxes, CircleGauge, ClipboardPlus, ReceiptText, TrendingUp } from "lucide-react";
import { AppShell } from "@/components/app-shell";
import { ErrorMessage, PageState, Panel } from "@/components/ui";
import { api, currentFeatures, money } from "@/lib/api";

type Dashboard = { features: string[]; today_income: number | null; open_bills: number | null; low_stock_parts: number | null; monthly_income: number | null; monthly_expenses: number | null; monthly_profit: number | null; recent_bills: Array<{ id: number; bill_number: string; status: string; balance_due: string; customer: { name: string }; vehicle: { number_plate: string } }> };

export default function DashboardPage() {
  const [data, setData] = useState<Dashboard | null>(null);
  const [error, setError] = useState("");
  useEffect(() => { api<Dashboard>("/dashboard").then(setData).catch((caught) => setError(caught.message)); }, []);
  const features = data?.features ?? currentFeatures();
  const can = (feature: string) => features.includes(feature);
  const metrics = data ? [
    can("billing") && ["Today's receipts", money(data.today_income ?? 0), Banknote, "#167c73"],
    can("billing") && ["Open job cards", String(data.open_bills ?? 0), ReceiptText, "#20221f"],
    can("parts_inventory") && ["Low stock items", String(data.low_stock_parts ?? 0), Boxes, "#b84837"],
    can("balance_sheet") && ["Monthly profit", money(data.monthly_profit ?? 0), TrendingUp, (data.monthly_profit ?? 0) >= 0 ? "#167c73" : "#b84837"],
  ].filter(Boolean) as Array<[string, string, typeof Banknote, string]> : [];
  return <AppShell title="Business overview" eyebrow={new Intl.DateTimeFormat("en-LK", { dateStyle: "full" }).format(new Date())} action={can("admit_vehicle") ? <Link href="/vehicles/admit" className="flex h-10 items-center gap-2 bg-[#f5c842] px-3 text-sm font-semibold sm:px-4"><ClipboardPlus size={18} /><span className="hidden sm:inline">Admit vehicle</span></Link> : undefined}>
    {error && <ErrorMessage message={error} />}
    {!data && !error ? <PageState message="Loading your business dashboard..." /> : data && <>
      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        {metrics.map(([label, value, Icon, color]) => <Panel key={label} className="relative overflow-hidden p-5"><div className="mb-8 flex items-start justify-between"><p className="text-xs font-bold uppercase text-[#6f746e]">{label}</p><Icon size={20} style={{ color }} /></div><p className="font-display text-3xl font-semibold sm:text-4xl">{value}</p><span className="absolute bottom-0 left-0 h-1 w-16" style={{ background: color }} /></Panel>)}
      </div>
      <div className="mt-5 grid gap-5 xl:grid-cols-[1.5fr_0.75fr]">
        {can("billing") && <Panel><div className="flex items-center justify-between border-b border-[#d7d3c8] px-5 py-4"><div><h2 className="font-display text-2xl font-semibold uppercase">Latest job cards</h2><p className="text-xs text-[#6f746e]">Open bills and active work across the counter</p></div><Link href="/bills" className="text-[#167c73]" aria-label="View all job cards"><ArrowRight size={20} /></Link></div><div className="overflow-x-auto"><table className="w-full min-w-[620px] text-left text-sm"><thead className="bg-[#eeece5] text-[10px] uppercase text-[#6f746e]"><tr><th className="px-5 py-3">Job</th><th>Vehicle</th><th>Customer</th><th>Status</th><th className="pr-5 text-right">Due</th></tr></thead><tbody>{data.recent_bills.map((bill) => <tr key={bill.id} className="border-t border-[#e2ded4]"><td className="px-5 py-4 font-semibold">{bill.bill_number}</td><td>{bill.vehicle.number_plate}</td><td>{bill.customer.name}</td><td><span className={`px-2 py-1 text-[10px] font-bold uppercase ${bill.status === "paid" ? "bg-[#167c73]/10 text-[#167c73]" : "bg-[#f5c842]/25 text-[#735a00]"}`}>{bill.status.replace("_", " ")}</span></td><td className="pr-5 text-right font-semibold">{money(bill.balance_due)}</td></tr>)}</tbody></table>{data.recent_bills.length === 0 && <p className="p-8 text-center text-sm text-[#6f746e]">No job cards yet.</p>}</div></Panel>}
        <div className="space-y-5">{can("balance_sheet") && <Panel className="bg-[#242723] p-5 text-white"><div className="flex items-center gap-2 text-[#f5c842]"><CircleGauge size={20} /><p className="text-xs font-bold uppercase">This month</p></div><div className="mt-6 space-y-4 text-sm"><div className="flex justify-between border-b border-white/10 pb-3"><span className="text-white/55">Income</span><strong>{money(data.monthly_income ?? 0)}</strong></div><div className="flex justify-between border-b border-white/10 pb-3"><span className="text-white/55">Expenses</span><strong>{money(data.monthly_expenses ?? 0)}</strong></div><div className="flex justify-between text-lg"><span className="font-display uppercase">Net</span><strong className={(data.monthly_profit ?? 0) >= 0 ? "text-[#63c8b9]" : "text-[#ef8c7d]"}>{money(data.monthly_profit ?? 0)}</strong></div></div></Panel>}<Panel className="p-5"><p className="text-xs font-bold uppercase text-[#6f746e]">Quick actions</p><div className="mt-4 grid grid-cols-2 gap-2">{can("admit_vehicle") && <Link href="/vehicles/admit" className="border border-[#d7d3c8] p-3 text-sm font-semibold hover:border-[#167c73]">New admission</Link>}{can("parts_inventory") && <Link href="/parts" className="border border-[#d7d3c8] p-3 text-sm font-semibold hover:border-[#167c73]">Find a part</Link>}{can("billing") && <Link href="/bills" className="border border-[#d7d3c8] p-3 text-sm font-semibold hover:border-[#167c73]">Take payment</Link>}{can("balance_sheet") && <Link href="/balance-sheet" className="border border-[#d7d3c8] p-3 text-sm font-semibold hover:border-[#167c73]">View finance</Link>}</div></Panel></div>
      </div>
    </>}
  </AppShell>;
}