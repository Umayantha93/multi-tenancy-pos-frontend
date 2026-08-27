"use client";

import { FormEvent, useState } from "react";
import { useRouter } from "next/navigation";
import { ClipboardCheck, Save } from "lucide-react";
import { AppShell } from "@/components/app-shell";
import { AddressField } from "@/components/address-field";
import { buttonClass, ErrorMessage, inputClass, Panel } from "@/components/ui";
import { api } from "@/lib/api";

export default function InstantBillPage() {
  const router = useRouter();
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSaving(true);
    setError("");
    const data = Object.fromEntries(new FormData(event.currentTarget));
    try {
      const bill = await api<{ id: number }>("/bills/instant", {
        method: "POST",
        body: JSON.stringify(data),
      });
      router.push(`/bills/${bill.id}`);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Could not open instant bill.");
      setSaving(false);
    }
  }

  return (
    <AppShell title="Instant bill" eyebrow="Quick billing">
      <div className="mx-auto max-w-3xl space-y-5">
        <div className="flex items-start gap-4 border-l-4 border-[#f5c842] bg-[#fbfaf6] p-4">
          <ClipboardCheck className="shrink-0 text-[#167c73]" />
          <div>
            <p className="font-semibold">Bill without a vehicle</p>
            <p className="text-sm text-[#6f746e]">
              For walk-in customers who need parts or services quickly. Opens the same billing screen as a job card — add labor, services, inventory, discounts, and payments.
            </p>
          </div>
        </div>

        <Panel className="p-5">
          <h2 className="font-display text-2xl font-semibold uppercase">Customer</h2>
          <form onSubmit={submit} className="mt-4 grid gap-4 sm:grid-cols-2">
            <label className="block sm:col-span-2">
              <span className="mb-1 block text-[10px] font-bold uppercase text-[#6f746e]">Customer name</span>
              <input name="customer_name" required className={inputClass} placeholder="Customer name" />
            </label>
            <label className="block">
              <span className="mb-1 block text-[10px] font-bold uppercase text-[#6f746e]">Phone number</span>
              <input name="customer_phone" type="tel" required className={inputClass} placeholder="07X XXX XXXX" />
            </label>
            <label className="block">
              <span className="mb-1 block text-[10px] font-bold uppercase text-[#6f746e]">Date</span>
              <input
                name="admission_date"
                type="date"
                defaultValue={new Date().toISOString().slice(0, 10)}
                className={inputClass}
              />
            </label>
            <div className="sm:col-span-2">
              <AddressField name="customer_address" label="Address (optional)" />
            </div>
            <label className="block sm:col-span-2">
              <span className="mb-1 block text-[10px] font-bold uppercase text-[#6f746e]">Notes (optional)</span>
              <textarea name="notes" rows={3} className={inputClass} placeholder="e.g. oil change only, filter request…" />
            </label>
            {error && (
              <div className="sm:col-span-2">
                <ErrorMessage message={error} />
              </div>
            )}
            <div className="sm:col-span-2">
              <button type="submit" disabled={saving} className={buttonClass}>
                <Save size={16} />
                {saving ? "Opening…" : "Open billing"}
              </button>
            </div>
          </form>
        </Panel>
      </div>
    </AppShell>
  );
}
