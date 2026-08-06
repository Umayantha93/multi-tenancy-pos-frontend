"use client";

import { FormEvent, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { AppShell } from "@/components/app-shell";
import { ErrorMessage, Panel, buttonClass, inputClass } from "@/components/ui";
import { api, money } from "@/lib/api";

type Room = { id: number; name: string; nightly_rate: string; capacity: number; status: string };

export default function NewStayPage() {
  const router = useRouter();
  const [rooms, setRooms] = useState<Room[]>([]);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    api<Room[]>("/cottage-rooms?active_only=1").then(setRooms).catch(() => setRooms([]));
  }, []);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setLoading(true);
    setError("");
    const form = new FormData(event.currentTarget);
    try {
      const stay = await api<{ id: number }>("/cottage-stays", {
        method: "POST",
        body: JSON.stringify({
          customer_name: form.get("customer_name"),
          customer_phone: form.get("customer_phone"),
          customer_address: form.get("customer_address") || null,
          cottage_room_id: Number(form.get("cottage_room_id")),
          check_in: form.get("check_in"),
          check_out: form.get("check_out"),
          guests: Number(form.get("guests") || 1),
          notes: form.get("notes") || null,
          status: form.get("status") || "reserved",
          create_bill: true,
        }),
      });
      router.push(`/stays/${stay.id}`);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Unable to create stay.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <AppShell title="New stay" eyebrow="Check-in / booking">
      <form onSubmit={submit} className="mx-auto max-w-2xl space-y-5">
        <Panel className="grid gap-4 p-5 sm:grid-cols-2">
          <label className="text-sm font-semibold sm:col-span-2">Guest name<input name="customer_name" required className={`mt-2 ${inputClass}`} /></label>
          <label className="text-sm font-semibold">Phone<input name="customer_phone" required className={`mt-2 ${inputClass}`} /></label>
          <label className="text-sm font-semibold">Guests<input name="guests" type="number" min="1" defaultValue={1} className={`mt-2 ${inputClass}`} /></label>
          <label className="text-sm font-semibold">Check-in<input name="check_in" type="date" required className={`mt-2 ${inputClass}`} /></label>
          <label className="text-sm font-semibold">Check-out<input name="check_out" type="date" required className={`mt-2 ${inputClass}`} /></label>
          <label className="text-sm font-semibold sm:col-span-2">
            Room
            <select name="cottage_room_id" required className={`mt-2 ${inputClass}`}>
              <option value="">Select room</option>
              {rooms.map((room) => (
                <option key={room.id} value={room.id}>{room.name} — {money(room.nightly_rate)}/night · {room.status}</option>
              ))}
            </select>
          </label>
          <label className="text-sm font-semibold">
            Status
            <select name="status" defaultValue="reserved" className={`mt-2 ${inputClass}`}>
              <option value="reserved">Reserved</option>
              <option value="checked_in">Checked in</option>
            </select>
          </label>
          <label className="text-sm font-semibold sm:col-span-2">Address<input name="customer_address" className={`mt-2 ${inputClass}`} /></label>
          <label className="text-sm font-semibold sm:col-span-2">Notes<textarea name="notes" rows={3} className={`mt-2 ${inputClass}`} /></label>
        </Panel>
        {error && <ErrorMessage message={error} />}
        <button disabled={loading} className={buttonClass}>{loading ? "Saving..." : "Create stay & bill"}</button>
      </form>
    </AppShell>
  );
}
