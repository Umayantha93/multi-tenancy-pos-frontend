"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { ArrowRight, Plus } from "lucide-react";
import { AppShell } from "@/components/app-shell";
import { ErrorMessage, PageState, Panel, inputClass } from "@/components/ui";
import { api, money } from "@/lib/api";

type Stay = {
  id: number;
  check_in: string;
  check_out: string;
  guests: number;
  status: string;
  customer: { name: string; phone: string };
  room: { name: string };
  bill?: { balance_due: string } | null;
};

type Calendar = {
  month: number;
  year: number;
  rooms: Array<{ id: number; name: string; status: string }>;
  stays: Array<{
    id: number;
    check_in: string;
    check_out: string;
    status: string;
    customer?: { name: string } | null;
    room?: { id: number; name: string } | null;
  }>;
};

export default function StaysPage() {
  const now = new Date();
  const [stays, setStays] = useState<Stay[]>([]);
  const [calendar, setCalendar] = useState<Calendar | null>(null);
  const [month, setMonth] = useState(now.getMonth() + 1);
  const [year, setYear] = useState(now.getFullYear());
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api<{ data: Stay[] }>("/cottage-stays")
      .then((result) => setStays(result.data))
      .catch((caught) => setError(caught.message))
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    api<Calendar>(`/cottage-stays/calendar?month=${month}&year=${year}`)
      .then(setCalendar)
      .catch(() => setCalendar(null));
  }, [month, year]);

  return (
    <AppShell
      title="Stays"
      eyebrow="Bookings & check-in"
      action={
        <Link href="/stays/new" className="flex h-10 items-center gap-2 bg-[#f5c842] px-3 text-sm font-semibold">
          <Plus size={18} /> New stay
        </Link>
      }
    >
      {error ? <ErrorMessage message={error} /> : loading ? <PageState message="Loading stays..." /> : (
        <div className="space-y-5">
          <Panel className="p-5">
            <div className="mb-4 flex flex-wrap items-end gap-3">
              <h2 className="mr-auto font-display text-2xl font-semibold uppercase">Occupancy calendar</h2>
              <select value={month} onChange={(event) => setMonth(Number(event.target.value))} className={`${inputClass} w-40`}>
                {Array.from({ length: 12 }, (_, index) => (
                  <option key={index + 1} value={index + 1}>{new Date(2026, index).toLocaleString("en", { month: "long" })}</option>
                ))}
              </select>
              <input value={year} onChange={(event) => setYear(Number(event.target.value))} type="number" className={`${inputClass} w-28`} />
            </div>
            {!calendar || calendar.stays.length === 0 ? (
              <p className="text-sm text-[#6f746e]">No stays overlap this month.</p>
            ) : (
              <div className="space-y-2">
                {calendar.stays.map((stay) => (
                  <Link key={stay.id} href={`/stays/${stay.id}`} className="flex flex-wrap justify-between gap-2 border border-[#d7d3c8] bg-white px-3 py-2 text-sm hover:border-[#20221f]">
                    <span className="font-semibold">{stay.room?.name ?? "Room"} · {stay.customer?.name ?? "Guest"}</span>
                    <span className="text-[#6f746e]">{stay.check_in} → {stay.check_out}</span>
                  </Link>
                ))}
              </div>
            )}
          </Panel>
          <Panel>
            <div className="overflow-x-auto">
              <table className="w-full min-w-[700px] text-left text-sm">
                <thead className="bg-[#eeece5] text-[10px] uppercase text-[#6f746e]">
                  <tr><th className="px-5 py-3">Guest</th><th>Room</th><th>Dates</th><th>Status</th><th className="pr-5 text-right">Due</th><th /></tr>
                </thead>
                <tbody>
                  {stays.map((stay) => (
                    <tr key={stay.id} className="border-t border-[#e2ded4]">
                      <td className="px-5 py-4 font-semibold">{stay.customer.name}<div className="text-xs font-normal text-[#6f746e]">{stay.customer.phone}</div></td>
                      <td>{stay.room.name}</td>
                      <td>{stay.check_in} → {stay.check_out}</td>
                      <td><span className="bg-[#f5c842]/25 px-2 py-1 text-[10px] font-bold uppercase text-[#735a00]">{stay.status.replace("_", " ")}</span></td>
                      <td className="pr-5 text-right font-semibold">{stay.bill ? money(stay.bill.balance_due) : "—"}</td>
                      <td className="pr-4"><Link href={`/stays/${stay.id}`} className="text-[#167c73]"><ArrowRight size={18} /></Link></td>
                    </tr>
                  ))}
                </tbody>
              </table>
              {stays.length === 0 && <p className="p-8 text-center text-sm text-[#6f746e]">No stays yet.</p>}
            </div>
          </Panel>
        </div>
      )}
    </AppShell>
  );
}
