"use client";

import { FormEvent, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { AppShell } from "@/components/app-shell";
import { ErrorMessage, Panel, buttonClass, inputClass } from "@/components/ui";
import { api, money } from "@/lib/api";

type Package = { id: number; name: string; price: string; duration_minutes?: number | null };

export default function NewBookingPage() {
  const router = useRouter();
  const [packages, setPackages] = useState<Package[]>([]);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    api<Package[]>("/photo-packages?active_only=1").then(setPackages).catch(() => setPackages([]));
  }, []);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setLoading(true);
    setError("");
    const form = new FormData(event.currentTarget);
    const payload = {
      customer_name: String(form.get("customer_name") || ""),
      customer_phone: String(form.get("customer_phone") || ""),
      customer_address: String(form.get("customer_address") || "") || null,
      photo_package_id: form.get("photo_package_id") ? Number(form.get("photo_package_id")) : null,
      scheduled_at: String(form.get("scheduled_at") || "") || null,
      location: String(form.get("location") || "") || null,
      notes: String(form.get("notes") || "") || null,
      status: "booked",
      create_bill: true,
    };
    try {
      const booking = await api<{ id: number }>("/photo-bookings", { method: "POST", body: JSON.stringify(payload) });
      router.push(`/bookings/${booking.id}`);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Unable to create booking.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <AppShell title="New booking" eyebrow="Photography">
      <form onSubmit={submit} className="mx-auto max-w-2xl space-y-5">
        <Panel className="grid gap-4 p-5 sm:grid-cols-2">
          <label className="text-sm font-semibold sm:col-span-2">Client name<input name="customer_name" required className={`mt-2 ${inputClass}`} /></label>
          <label className="text-sm font-semibold">Phone<input name="customer_phone" required className={`mt-2 ${inputClass}`} /></label>
          <label className="text-sm font-semibold">Session date & time<input name="scheduled_at" type="datetime-local" className={`mt-2 ${inputClass}`} /></label>
          <label className="text-sm font-semibold sm:col-span-2">Address<input name="customer_address" className={`mt-2 ${inputClass}`} /></label>
          <label className="text-sm font-semibold sm:col-span-2">Location / venue<input name="location" className={`mt-2 ${inputClass}`} /></label>
          <label className="text-sm font-semibold sm:col-span-2">
            Package
            <select name="photo_package_id" className={`mt-2 ${inputClass}`}>
              <option value="">Custom / none</option>
              {packages.map((pkg) => (
                <option key={pkg.id} value={pkg.id}>{pkg.name} — {money(pkg.price)}</option>
              ))}
            </select>
          </label>
          <label className="text-sm font-semibold sm:col-span-2">Notes<textarea name="notes" rows={3} className={`mt-2 ${inputClass}`} /></label>
        </Panel>
        {error && <ErrorMessage message={error} />}
        <button disabled={loading} className={buttonClass}>{loading ? "Saving..." : "Create booking & order"}</button>
      </form>
    </AppShell>
  );
}
