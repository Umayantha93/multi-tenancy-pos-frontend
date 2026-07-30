"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { ArrowRight, Building2, CircleOff, Plus, Users } from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { PlatformShell } from "@/components/platform-shell";
import { ErrorMessage, PageState, Panel } from "@/components/ui";
import { api } from "@/lib/api";

type PlatformDashboard = { total_tenants: number; active_tenants: number; inactive_tenants: number; total_users: number; signups: Array<{ period: string; total: number }> };

export default function PlatformDashboardPage() {
  const [data, setData] = useState<PlatformDashboard | null>(null);
  const [error, setError] = useState("");
  useEffect(() => { api<PlatformDashboard>("/super-admin/dashboard").then(setData).catch((caught) => setError(caught.message)); }, []);
  const peak = Math.max(1, ...(data?.signups.map((item) => item.total) ?? [1]));
  const metrics: Array<[string, number, LucideIcon, string]> = data ? [
    ["All businesses", data.total_tenants, Building2, "#20221f"], ["Active tenants", data.active_tenants, Building2, "#167c73"], ["Inactive tenants", data.inactive_tenants, CircleOff, "#b84837"], ["Tenant users", data.total_users, Users, "#735a00"],
  ] : [];
  return <PlatformShell title="Platform pulse" action={<Link href="/super-admin/tenants/new" className="flex h-10 items-center gap-2 bg-[#f5c842] px-4 text-sm font-semibold"><Plus size={18} />New tenant</Link>}>
    {error && <ErrorMessage message={error} />}{!data && !error ? <PageState message="Reading platform activity..." /> : data && <>
      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">{metrics.map(([label, value, Icon, color]) => <Panel key={label} className="relative overflow-hidden p-5"><div className="mb-8 flex justify-between"><p className="text-xs font-bold uppercase text-[#6f746e]">{label}</p><Icon size={20} style={{ color }} /></div><p className="font-display text-5xl font-semibold">{value}</p><span className="absolute bottom-0 left-0 h-1 w-20" style={{ background: color }} /></Panel>)}</div>
      <div className="mt-5 grid gap-5 xl:grid-cols-[1.5fr_0.7fr]"><Panel className="p-5"><div className="mb-8"><h2 className="font-display text-2xl font-semibold uppercase">Signup cadence</h2><p className="text-xs text-[#6f746e]">Businesses added by month</p></div>{data.signups.length ? <div className="flex h-56 items-end gap-3 overflow-x-auto border-b border-[#cbc7bc] pb-0">{data.signups.map((item) => <div key={item.period} className="flex min-w-14 flex-1 flex-col items-center justify-end gap-2"><span className="text-xs font-bold">{item.total}</span><div className="w-full max-w-20 bg-[#167c73]" style={{ height: `${Math.max(12, item.total / peak * 160)}px` }} /><span className="pb-2 text-[10px] text-[#6f746e]">{item.period}</span></div>)}</div> : <PageState message="No tenant signups yet." />}</Panel><Panel className="bg-[#181b19] p-5 text-white"><p className="text-xs font-bold uppercase text-[#f5c842]">Operations</p><h2 className="mt-5 font-display text-4xl font-semibold uppercase leading-none">Keep every tenant accountable.</h2><p className="mt-4 text-sm leading-6 text-white/50">Review active plans, user access, and lifecycle status from one registry.</p><Link href="/super-admin/tenants" className="mt-8 flex items-center justify-between border-t border-white/15 pt-4 text-sm font-semibold">Open registry<ArrowRight size={18} /></Link></Panel></div>
    </>}
  </PlatformShell>;
}