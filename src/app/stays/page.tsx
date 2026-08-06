"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { ArrowRight, Plus } from "lucide-react";
import { AppShell } from "@/components/app-shell";
import { ErrorMessage, PageState, Panel } from "@/components/ui";
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

export default function StaysPage() {
  const [stays, setStays] = useState<Stay[]>([]);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api<{ data: Stay[] }>("/cottage-stays")
      .then((result) => setStays(result.data))
      .catch((caught) => setError(caught.message))
      .finally(() => setLoading(false));
  }, []);

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
      )}
    </AppShell>
  );
}
