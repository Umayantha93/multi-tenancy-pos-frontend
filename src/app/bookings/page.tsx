"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { ArrowRight, Plus, Search } from "lucide-react";
import { AppShell } from "@/components/app-shell";
import { ErrorMessage, PageState, Panel, inputClass } from "@/components/ui";
import { api, money } from "@/lib/api";

type Booking = {
  id: number;
  scheduled_at: string | null;
  location: string | null;
  status: string;
  customer: { name: string; phone: string };
  package?: { name: string; price: string } | null;
  bill?: { id: number; bill_number: string; balance_due: string } | null;
};

export default function BookingsPage() {
  const [bookings, setBookings] = useState<Booking[]>([]);
  const [search, setSearch] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setLoading(true);
    const timer = setTimeout(() => {
      api<{ data: Booking[] }>(`/photo-bookings?search=${encodeURIComponent(search)}`)
        .then((result) => setBookings(result.data))
        .catch((caught) => setError(caught.message))
        .finally(() => setLoading(false));
    }, 250);
    return () => clearTimeout(timer);
  }, [search]);

  return (
    <AppShell
      title="Bookings"
      eyebrow="Photography sessions"
      action={
        <Link href="/bookings/new" className="flex h-10 items-center gap-2 bg-[#f5c842] px-3 text-sm font-semibold">
          <Plus size={18} /> New booking
        </Link>
      }
    >
      <div className="mb-5 max-w-md">
        <label className="relative block">
          <Search className="absolute left-3 top-3 text-[#6f746e]" size={18} />
          <input value={search} onChange={(e) => setSearch(e.target.value)} className={`${inputClass} pl-10`} placeholder="Search client name or phone" />
        </label>
      </div>
      {error ? <ErrorMessage message={error} /> : loading ? <PageState message="Loading bookings..." /> : (
        <Panel>
          <div className="overflow-x-auto">
            <table className="w-full min-w-[700px] text-left text-sm">
              <thead className="bg-[#eeece5] text-[10px] uppercase text-[#6f746e]">
                <tr><th className="px-5 py-3">Client</th><th>When</th><th>Package</th><th>Status</th><th className="pr-5 text-right">Due</th><th /></tr>
              </thead>
              <tbody>
                {bookings.map((booking) => (
                  <tr key={booking.id} className="border-t border-[#e2ded4]">
                    <td className="px-5 py-4 font-semibold">{booking.customer.name}<div className="text-xs font-normal text-[#6f746e]">{booking.customer.phone}</div></td>
                    <td>{booking.scheduled_at ? new Date(booking.scheduled_at).toLocaleString() : "TBD"}</td>
                    <td>{booking.package?.name ?? "Custom"}</td>
                    <td><span className="bg-[#f5c842]/25 px-2 py-1 text-[10px] font-bold uppercase text-[#735a00]">{booking.status.replace("_", " ")}</span></td>
                    <td className="pr-5 text-right font-semibold">{booking.bill ? money(booking.bill.balance_due) : "—"}</td>
                    <td className="pr-4"><Link href={`/bookings/${booking.id}`} className="text-[#167c73]"><ArrowRight size={18} /></Link></td>
                  </tr>
                ))}
              </tbody>
            </table>
            {bookings.length === 0 && <p className="p-8 text-center text-sm text-[#6f746e]">No bookings yet.</p>}
          </div>
        </Panel>
      )}
    </AppShell>
  );
}
