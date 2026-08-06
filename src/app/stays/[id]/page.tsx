"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { FormEvent, useEffect, useState } from "react";
import { AppShell } from "@/components/app-shell";
import { ErrorMessage, PageState, Panel, buttonClass, inputClass } from "@/components/ui";
import { api, money } from "@/lib/api";

type Stay = {
  id: number;
  check_in: string;
  check_out: string;
  guests: number;
  status: string;
  notes: string | null;
  customer: { name: string; phone: string };
  room: { name: string; nightly_rate: string };
  bill?: { id: number; bill_number: string; balance_due: string; status: string } | null;
};

export default function StayDetailPage() {
  const { id } = useParams<{ id: string }>();
  const [stay, setStay] = useState<Stay | null>(null);
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);

  function load() {
    api<Stay>(`/cottage-stays/${id}`).then(setStay).catch((caught) => setError(caught.message));
  }

  useEffect(load, [id]);

  async function save(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSaving(true);
    setError("");
    const form = new FormData(event.currentTarget);
    try {
      const updated = await api<Stay>(`/cottage-stays/${id}`, {
        method: "PUT",
        body: JSON.stringify({
          status: form.get("status"),
          guests: Number(form.get("guests") || 1),
          notes: form.get("notes") || null,
        }),
      });
      setStay(updated);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Unable to update.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <AppShell title={stay?.customer.name ?? "Stay"} eyebrow="Stay detail">
      {error && <div className="mb-4"><ErrorMessage message={error} /></div>}
      {!stay ? <PageState message="Loading stay..." /> : (
        <div className="grid gap-5 lg:grid-cols-[1fr_0.7fr]">
          <Panel className="p-5">
            <form onSubmit={save} className="space-y-4">
              <label className="block text-sm font-semibold">Status
                <select name="status" defaultValue={stay.status} className={`mt-2 ${inputClass}`}>
                  {["reserved", "checked_in", "checked_out", "cancelled"].map((status) => (
                    <option key={status} value={status}>{status.replace("_", " ")}</option>
                  ))}
                </select>
              </label>
              <label className="block text-sm font-semibold">Guests
                <input name="guests" type="number" min="1" defaultValue={stay.guests} className={`mt-2 ${inputClass}`} />
              </label>
              <label className="block text-sm font-semibold">Notes
                <textarea name="notes" rows={4} defaultValue={stay.notes ?? ""} className={`mt-2 ${inputClass}`} />
              </label>
              <button disabled={saving} className={buttonClass}>{saving ? "Saving..." : "Save stay"}</button>
            </form>
          </Panel>
          <div className="space-y-5">
            <Panel className="p-5">
              <p className="text-xs font-bold uppercase text-[#6f746e]">Guest</p>
              <p className="mt-2 font-display text-2xl font-semibold uppercase">{stay.customer.name}</p>
              <p className="text-sm text-[#6f746e]">{stay.customer.phone}</p>
              <p className="mt-4 text-sm">{stay.room.name} · {money(stay.room.nightly_rate)}/night</p>
              <p className="text-sm text-[#6f746e]">{stay.check_in} → {stay.check_out}</p>
            </Panel>
            {stay.bill && (
              <Panel className="p-5">
                <p className="text-xs font-bold uppercase text-[#6f746e]">Linked bill</p>
                <p className="mt-2 font-semibold">{stay.bill.bill_number}</p>
                <p className="text-sm">Due {money(stay.bill.balance_due)} · {stay.bill.status}</p>
                <Link href={`/bills/${stay.bill.id}`} className={`${buttonClass} mt-4`}>Open bill</Link>
              </Panel>
            )}
          </div>
        </div>
      )}
    </AppShell>
  );
}
