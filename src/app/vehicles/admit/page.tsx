"use client";

import { FormEvent, useState } from "react";
import { useRouter } from "next/navigation";
import { ClipboardCheck, Save } from "lucide-react";
import { AppShell } from "@/components/app-shell";
import { buttonClass, ErrorMessage, inputClass, Panel } from "@/components/ui";
import { api } from "@/lib/api";

const fields = [["customer_name", "Customer name", "text", true], ["customer_phone", "Phone number", "tel", true], ["number_plate", "Number plate", "text", true], ["chassis_number", "Chassis number", "text", true], ["make", "Make", "text", false], ["model", "Model", "text", false], ["year", "Vehicle year", "number", false], ["odometer", "Odometer (km)", "number", false]] as const;

export default function AdmitVehiclePage() {
  const router = useRouter(); const [error, setError] = useState(""); const [saving, setSaving] = useState(false);
  async function submit(event: FormEvent<HTMLFormElement>) { event.preventDefault(); setSaving(true); setError(""); const data = Object.fromEntries(new FormData(event.currentTarget)); try { const bill = await api<{ id: number }>("/bills", { method: "POST", body: JSON.stringify(data) }); router.push(`/bills/${bill.id}`); } catch (caught) { setError(caught instanceof Error ? caught.message : "Admission failed."); setSaving(false); } }
  return <AppShell title="Admit a vehicle" eyebrow="New job card"><div className="mx-auto max-w-5xl"><div className="mb-5 flex items-start gap-4 border-l-4 border-[#f5c842] bg-[#fbfaf6] p-4"><ClipboardCheck className="shrink-0 text-[#167c73]" /><div><p className="font-semibold">Admission opens a live job card</p><p className="text-sm text-[#6f746e]">Charges, parts and customer payments can be added immediately after saving.</p></div></div>{error && <div className="mb-5"><ErrorMessage message={error} /></div>}<form onSubmit={submit}><Panel><div className="border-b border-[#d7d3c8] px-5 py-4"><h2 className="font-display text-2xl font-semibold uppercase">Customer & vehicle</h2></div><div className="grid gap-5 p-5 sm:grid-cols-2">{fields.map(([name, label, type, required]) => <label key={name} className="text-sm font-semibold">{label}{required && <span className="text-[#b84837]"> *</span>}<input name={name} type={type} required={required} className={`${inputClass} mt-2`} /></label>)}<label className="text-sm font-semibold sm:col-span-2">Admission notes<textarea name="notes" rows={4} className="mt-2 w-full border border-[#c9c5b9] bg-white p-3 text-sm outline-none focus:border-[#167c73]" placeholder="Customer concerns, visible damage, requested work..." /></label></div><div className="flex justify-end border-t border-[#d7d3c8] p-5"><button disabled={saving} className={buttonClass}><Save size={18} />{saving ? "Opening job card..." : "Open job card"}</button></div></Panel></form></div></AppShell>;
}