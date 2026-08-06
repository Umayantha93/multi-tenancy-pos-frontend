"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { FormEvent, useEffect, useState } from "react";
import { AppShell } from "@/components/app-shell";
import { ErrorMessage, PageState, Panel, buttonClass, inputClass } from "@/components/ui";
import { api, money } from "@/lib/api";

type Booking = {
  id: number;
  scheduled_at: string | null;
  location: string | null;
  notes: string | null;
  status: string;
  customer: { name: string; phone: string };
  package?: { name: string; price: string } | null;
  bill?: { id: number; bill_number: string; balance_due: string; status: string } | null;
};

export default function BookingDetailPage() {
  const { id } = useParams<{ id: string }>();
  const [booking, setBooking] = useState<Booking | null>(null);
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);

  function load() {
    api<Booking>(`/photo-bookings/${id}`).then(setBooking).catch((caught) => setError(caught.message));
  }

  useEffect(load, [id]);

  async function save(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSaving(true);
    setError("");
    const form = new FormData(event.currentTarget);
    try {
      const updated = await api<Booking>(`/photo-bookings/${id}`, {
        method: "PUT",
        body: JSON.stringify({
          status: form.get("status"),
          location: form.get("location") || null,
          notes: form.get("notes") || null,
          scheduled_at: form.get("scheduled_at") || null,
        }),
      });
      setBooking(updated);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Unable to update.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <AppShell title={booking?.customer.name ?? "Booking"} eyebrow="Session detail">
      {error && <div className="mb-4"><ErrorMessage message={error} /></div>}
      {!booking ? <PageState message="Loading booking..." /> : (
        <div className="grid gap-5 lg:grid-cols-[1fr_0.7fr]">
          <Panel className="p-5">
            <form onSubmit={save} className="space-y-4">
              <label className="block text-sm font-semibold">Status
                <select name="status" defaultValue={booking.status} className={`mt-2 ${inputClass}`}>
                  {["inquiry", "booked", "in_progress", "delivered", "cancelled"].map((status) => (
                    <option key={status} value={status}>{status.replace("_", " ")}</option>
                  ))}
                </select>
              </label>
              <label className="block text-sm font-semibold">Scheduled
                <input name="scheduled_at" type="datetime-local" defaultValue={booking.scheduled_at?.slice(0, 16) ?? ""} className={`mt-2 ${inputClass}`} />
              </label>
              <label className="block text-sm font-semibold">Location
                <input name="location" defaultValue={booking.location ?? ""} className={`mt-2 ${inputClass}`} />
              </label>
              <label className="block text-sm font-semibold">Notes
                <textarea name="notes" rows={4} defaultValue={booking.notes ?? ""} className={`mt-2 ${inputClass}`} />
              </label>
              <button disabled={saving} className={buttonClass}>{saving ? "Saving..." : "Save booking"}</button>
            </form>
          </Panel>
          <div className="space-y-5">
            <Panel className="p-5">
              <p className="text-xs font-bold uppercase text-[#6f746e]">Client</p>
              <p className="mt-2 font-display text-2xl font-semibold uppercase">{booking.customer.name}</p>
              <p className="text-sm text-[#6f746e]">{booking.customer.phone}</p>
              <p className="mt-4 text-sm"><span className="text-[#6f746e]">Package:</span> {booking.package?.name ?? "Custom"} {booking.package ? `· ${money(booking.package.price)}` : ""}</p>
            </Panel>
            {booking.bill && (
              <Panel className="p-5">
                <p className="text-xs font-bold uppercase text-[#6f746e]">Linked order</p>
                <p className="mt-2 font-semibold">{booking.bill.bill_number}</p>
                <p className="text-sm">Due {money(booking.bill.balance_due)} · {booking.bill.status}</p>
                <Link href={`/bills/${booking.bill.id}`} className={`${buttonClass} mt-4`}>Open order</Link>
              </Panel>
            )}
          </div>
        </div>
      )}
    </AppShell>
  );
}
