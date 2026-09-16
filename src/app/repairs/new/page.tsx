"use client";

import { FormEvent, useState } from "react";
import { useRouter } from "next/navigation";
import { AppShell } from "@/components/app-shell";
import { buttonClass, ErrorMessage, inputClass, Panel } from "@/components/ui";
import { api } from "@/lib/api";
import { useT } from "@/lib/locale";

export default function NewRepairBillPage() {
  const router = useRouter();
  const t = useT();
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
      setError(caught instanceof Error ? caught.message : t("repairs.failed"));
      setSaving(false);
    }
  }

  return (
    <AppShell title={t("repairs.new_title")} eyebrow={t("repairs.title")}>
      <Panel className="mx-auto max-w-2xl p-5">
        <p className="text-sm text-[#6f746e]">
          {t("repairs.new_hint")}
        </p>
        <form onSubmit={submit} className="mt-5 grid gap-4 sm:grid-cols-2">
          <label className="text-sm font-semibold">
            {t("common.customer")}
            <input name="customer_name" className={`${inputClass} mt-2`} placeholder={t("instant.optional")} />
          </label>
          <label className="text-sm font-semibold">
            {t("common.phone")}
            <input name="customer_phone" type="tel" className={`${inputClass} mt-2`} placeholder={t("instant.optional")} />
          </label>
          <label className="text-sm font-semibold sm:col-span-2">
            {t("repairs.device")}
            <input name="device" className={`${inputClass} mt-2`} placeholder={t("repairs.device_placeholder")} />
          </label>
          <label className="text-sm font-semibold sm:col-span-2">
            {t("repairs.fault")}
            <input name="fault" className={`${inputClass} mt-2`} placeholder={t("repairs.fault_placeholder")} />
          </label>
          {error && <div className="sm:col-span-2"><ErrorMessage message={error} /></div>}
          <div className="sm:col-span-2 flex justify-end">
            <button disabled={saving} className={buttonClass}>{saving ? t("common.opening") : t("repairs.open")}</button>
          </div>
        </form>
      </Panel>
    </AppShell>
  );
}
