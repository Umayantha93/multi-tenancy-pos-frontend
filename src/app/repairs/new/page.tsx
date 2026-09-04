"use client";

import { FormEvent, useState } from "react";
import { useRouter } from "next/navigation";
import { AppShell } from "@/components/app-shell";
import { buttonClass, ErrorMessage, inputClass, Panel } from "@/components/ui";
import { api } from "@/lib/api";

export default function NewRepairBillPage() {
  const router = useRouter();
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSaving(true);
    setError("");
    const form = Object.fromEntries(new FormData(event.currentTarget).entries());
    const notes = [form.device, form.fault].filter((value) => String(value || "").trim()).join(" · ");
    try {
      const bill = await api<{ id: number }>("/bills", {
        method: "POST",
        body: JSON.stringify({
          customer_name: form.customer_name || null,
          customer_phone: form.customer_phone || null,
          notes: notes || null,
          job_kind: "repair",
        }),
      });
      router.push(`/bills/${bill.id}`);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Could not open repair bill.");
      setSaving(false);
    }
  }

  return (
    <AppShell title="New repair" eyebrow="Repair bills">
      <Panel className="mx-auto max-w-2xl p-5">
        <p className="text-sm text-[#6f746e]">
          Open a repair job, then add the labour charge and any stock used. Super-admin turns Repair on for this shop.
        </p>
        <form onSubmit={submit} className="mt-5 grid gap-4 sm:grid-cols-2">
          <label className="text-sm font-semibold">
            Customer name
            <input name="customer_name" className={`${inputClass} mt-2`} placeholder="Optional" />
          </label>
          <label className="text-sm font-semibold">
            Phone
            <input name="customer_phone" type="tel" className={`${inputClass} mt-2`} placeholder="Optional" />
          </label>
          <label className="text-sm font-semibold sm:col-span-2">
            Phone / vehicle / serial
            <input name="device" className={`${inputClass} mt-2`} placeholder="e.g. Samsung A15 · IMEI or CAB-1234" />
          </label>
          <label className="text-sm font-semibold sm:col-span-2">
            Fault / requested work
            <input name="fault" className={`${inputClass} mt-2`} placeholder="e.g. Screen crack · won’t charge" />
          </label>
          {error && <div className="sm:col-span-2"><ErrorMessage message={error} /></div>}
          <div className="sm:col-span-2 flex justify-end">
            <button disabled={saving} className={buttonClass}>{saving ? "Opening..." : "Open repair bill"}</button>
          </div>
        </form>
      </Panel>
    </AppShell>
  );
}
