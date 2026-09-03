"use client";

import { FormEvent, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { ClipboardCheck, Save } from "lucide-react";
import { AppShell } from "@/components/app-shell";
import { AddressField } from "@/components/address-field";
import { EmployeePicker } from "@/components/employee-picker";
import { buttonClass, ErrorMessage, inputClass, Panel } from "@/components/ui";
import { api, currentFeatures } from "@/lib/api";
import { useBusinessProfile } from "@/lib/use-business-profile";

type EmployeeOption = { id: number; name: string; position?: string | null };

export default function InstantBillPage() {
  const router = useRouter();
  const profile = useBusinessProfile();
  const isPaint = profile.type === "paint";
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);
  const [employees, setEmployees] = useState<EmployeeOption[]>([]);
  const [employeeIds, setEmployeeIds] = useState<number[]>([]);
  const [canAssignEmployees, setCanAssignEmployees] = useState(false);

  useEffect(() => {
    const features = currentFeatures();
    setCanAssignEmployees(features.includes("employees_management") || features.includes("attendance"));
  }, []);

  useEffect(() => {
    if (!canAssignEmployees) return;
    api<{ data: EmployeeOption[] }>("/employees?active_only=1&per_page=100")
      .then((result) => setEmployees(result.data))
      .catch(() => setEmployees([]));
  }, [canAssignEmployees]);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSaving(true);
    setError("");
    const form = Object.fromEntries(new FormData(event.currentTarget));
    try {
      const bill = await api<{ id: number }>("/bills/instant", {
        method: "POST",
        body: JSON.stringify({ ...form, employee_ids: employeeIds }),
      });
      router.push(`/bills/${bill.id}`);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Could not open instant bill.");
      setSaving(false);
    }
  }

  return (
    <AppShell title={isPaint ? "Counter sale" : "Instant bill"} eyebrow="Quick billing">
      <div className="mx-auto max-w-3xl space-y-5">
        <div className="flex items-start gap-4 border-l-4 border-[#f5c842] bg-[#fbfaf6] p-4">
          <ClipboardCheck className="shrink-0 text-[#167c73]" />
          <div>
            <p className="font-semibold">{isPaint ? "Sell without a vehicle" : "Bill without a vehicle"}</p>
            <p className="text-sm text-[#6f746e]">
              {isPaint
                ? "For walk-in cans, touch-up, or materials. Opens the same billing screen as a paint job."
                : "For walk-in customers who need parts or services quickly. Opens the same billing screen as a job card — add labor, services, inventory, discounts, and payments."}
            </p>
          </div>
        </div>

        <Panel className="p-5">
          <h2 className="font-display text-2xl font-semibold uppercase">Customer</h2>
          <form onSubmit={submit} className="mt-4 grid gap-4 sm:grid-cols-2">
            <label className="block sm:col-span-2">
              <span className="mb-1 block text-[10px] font-bold uppercase text-[#6f746e]">Customer name</span>
              <input name="customer_name" className={inputClass} placeholder="Optional" />
            </label>
            <label className="block">
              <span className="mb-1 block text-[10px] font-bold uppercase text-[#6f746e]">Phone number</span>
              <input name="customer_phone" type="tel" className={inputClass} placeholder="Optional" />
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
            {canAssignEmployees && (
              <div className="sm:col-span-2">
                <p className="mb-2 text-[10px] font-bold uppercase text-[#6f746e]">Assign employees (optional)</p>
                <EmployeePicker employees={employees} selectedIds={employeeIds} onChange={setEmployeeIds} />
              </div>
            )}
            <label className="block sm:col-span-2">
              <span className="mb-1 block text-[10px] font-bold uppercase text-[#6f746e]">Internal note (staff only)</span>
              <textarea name="internal_notes" rows={3} className={inputClass} placeholder="Workshop notes the customer should not see" />
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
