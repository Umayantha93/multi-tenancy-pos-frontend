"use client";

import { FormEvent, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { ClipboardCheck, Plus, Save, Search } from "lucide-react";
import { AppShell } from "@/components/app-shell";
import { AddressField } from "@/components/address-field";
import { EmployeePicker } from "@/components/employee-picker";
import { buttonClass, ErrorMessage, inputClass, Panel } from "@/components/ui";
import { api, currentFeatures, currentUser } from "@/lib/api";
import { profileFor } from "@/lib/business-profiles";

type VehicleMatch = {
  id: number;
  number_plate: string;
  chassis_number?: string | null;
  make?: string;
  model?: string;
  year?: number;
  bills_count: number;
  customer: { id: number; name: string; phone: string; address?: string | null };
};

type JobKind = "repair" | "service";
type EmployeeOption = { id: number; name: string; position?: string | null };

export default function AdmitVehiclePage() {
  const router = useRouter();
  const profile = useMemo(() => profileFor(currentUser()?.tenant?.business_type), []);
  const isDevice = profile.type === "device_repair";
  const isTyre = profile.type === "tyre";
  const fields: Array<[string, string, string, boolean]> = [
    ["customer_name", "Customer name", "text", false],
    ["customer_phone", "Phone number", "tel", false],
    ["number_plate", isDevice ? "Device ID / serial" : "Number plate", "text", true],
    [isDevice ? "imei" : "chassis_number", isDevice ? "IMEI" : "Chassis number", "text", false],
    ["make", isDevice ? "Brand" : "Make", "text", false],
    ["model", "Model", "text", false],
    ["year", isDevice ? "Year" : "Vehicle year", "number", false],
  ];
  if (!isDevice) fields.push(["odometer", "Odometer (km)", "number", false]);
  if (isTyre) {
    fields.push(["tyre_size", "Tyre size", "text", false], ["axle", "Axle", "text", false]);
  }
  if (isDevice) fields.push(["fault_description", "Fault", "text", false]);

  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);
  const [plateQuery, setPlateQuery] = useState("");
  const [vehicles, setVehicles] = useState<VehicleMatch[]>([]);
  const [lookingUp, setLookingUp] = useState(false);
  const [creatingId, setCreatingId] = useState<number | null>(null);
  const [formPlate, setFormPlate] = useState("");
  const [jobKind, setJobKind] = useState<JobKind>("repair");
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

  useEffect(() => {
    if (plateQuery.trim().length < 2) {
      setVehicles([]);
      return;
    }
    setLookingUp(true);
    const timer = setTimeout(() => {
      api<{ data: VehicleMatch[] }>(`/vehicles?search=${encodeURIComponent(plateQuery.trim())}&per_page=20`)
        .then((result) => setVehicles(result.data))
        .catch(() => setVehicles([]))
        .finally(() => setLookingUp(false));
    }, 300);
    return () => clearTimeout(timer);
  }, [plateQuery]);

  async function openNewCard(vehicleId: number) {
    setCreatingId(vehicleId);
    setError("");
    try {
      const bill = await api<{ id: number }>("/bills/from-vehicle", {
        method: "POST",
        body: JSON.stringify({ vehicle_id: vehicleId, job_kind: jobKind, employee_ids: employeeIds }),
      });
      router.push(`/bills/${bill.id}`);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Could not open job card.");
      setCreatingId(null);
    }
  }

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSaving(true);
    setError("");
    const form = Object.fromEntries(new FormData(event.currentTarget));
    const payload: Record<string, unknown> = { ...form, employee_ids: employeeIds };
    if (isDevice) payload.asset_kind = "device";
    try {
      const bill = await api<{ id: number }>("/bills", { method: "POST", body: JSON.stringify(payload) });
      router.push(`/bills/${bill.id}`);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Admission failed.");
      setSaving(false);
    }
  }

  return (
    <AppShell title={isDevice ? "Admit a device" : "Admit a vehicle"} eyebrow="New job card">
      <div className="mx-auto max-w-5xl space-y-5">
        <div className="flex items-start gap-4 border-l-4 border-[#f5c842] bg-[#fbfaf6] p-4">
          <ClipboardCheck className="shrink-0 text-[#167c73]" />
          <div>
            <p className="font-semibold">{isDevice ? "Search an existing device first" : "Search an existing plate first"}</p>
            <p className="text-sm text-[#6f746e]">
              If it already exists, open another job card. Otherwise fill the form below for a new admission.
            </p>
          </div>
        </div>

        <Panel className="p-5">
          <h2 className="font-display text-2xl font-semibold uppercase">{isDevice ? "Search by device ID" : "Search by number plate"}</h2>
          <label className="relative mt-4 block max-w-xl">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-[#6f746e]" size={16} />
            <input
              value={plateQuery}
              onChange={(event) => setPlateQuery(event.target.value.toUpperCase())}
              className={`${inputClass} pl-10`}
              placeholder={isDevice ? "e.g. IMEI or serial" : "e.g. CAB-1234"}
            />
          </label>
          {lookingUp && <p className="mt-3 text-sm text-[#6f746e]">Searching...</p>}
          {vehicles.length > 0 && (
            <div className="mt-4 divide-y divide-[#e2ded4] border border-[#d7d3c8] bg-white">
              {vehicles.map((vehicle) => (
                <div key={vehicle.id} className="flex flex-wrap items-center justify-between gap-3 px-4 py-3">
                  <div>
                    <p className="font-semibold">{vehicle.number_plate}</p>
                    <p className="text-sm text-[#6f746e]">
                      {vehicle.customer.name} · {vehicle.customer.phone}
                      {(vehicle.make || vehicle.model) ? ` · ${vehicle.make ?? ""} ${vehicle.model ?? ""}` : ""}
                    </p>
                    <p className="text-xs text-[#167c73]">
                      {vehicle.bills_count} previous job card{vehicle.bills_count === 1 ? "" : "s"}
                    </p>
                  </div>
                  <button
                    type="button"
                    disabled={creatingId === vehicle.id}
                    onClick={() => openNewCard(vehicle.id)}
                    className={buttonClass}
                  >
                    <Plus size={16} />{creatingId === vehicle.id ? "Opening..." : "New job card"}
                  </button>
                </div>
              ))}
            </div>
          )}
          {!lookingUp && plateQuery.trim().length >= 2 && vehicles.length === 0 && (
            <p className="mt-4 text-sm text-[#6f746e]">No match — use the new admission form below.</p>
          )}
        </Panel>

        <Panel className="p-5">
          <h2 className="font-display text-2xl font-semibold uppercase">Job type</h2>
          <p className="mt-1 text-sm text-[#6f746e]">Repair uses parts and labor. Service uses the priced addon buttons.</p>
          <div className="mt-4 grid max-w-md grid-cols-2 gap-2">
            {([
              ["repair", "Repair"],
              ["service", "Service"],
            ] as const).map(([value, label]) => {
              const selected = jobKind === value;
              return (
                <button
                  key={value}
                  type="button"
                  onClick={() => setJobKind(value)}
                  className={`h-9 border text-[13px] font-semibold ${
                    selected
                      ? "border-[#20221f] bg-[#20221f] text-white"
                      : "border-[#d7d3c8] bg-white hover:border-[#20221f]"
                  }`}
                >
                  {label}
                </button>
              );
            })}
          </div>
          {canAssignEmployees && (
            <div className="mt-5">
              <p className="mb-2 text-sm font-semibold">Assign employees <span className="font-normal text-[#6f746e]">(optional — applies to new and existing vehicles)</span></p>
              <EmployeePicker employees={employees} selectedIds={employeeIds} onChange={setEmployeeIds} />
            </div>
          )}
        </Panel>

        {error && <ErrorMessage message={error} />}

        <form onSubmit={submit}>
          <Panel>
            <div className="border-b border-[#d7d3c8] px-5 py-4">
              <h2 className="font-display text-2xl font-semibold uppercase">{isDevice ? "New customer & device" : "New customer & vehicle"}</h2>
            </div>
            <div className="grid gap-5 p-5 sm:grid-cols-2">
              {fields.map(([name, label, type, required]) => (
                <label key={name} className="text-sm font-semibold">
                  {label}{required && <span className="text-[#b84837]"> *</span>}
                  {name === "number_plate" ? (
                    <input
                      name={name}
                      type={type}
                      required={required}
                      value={formPlate}
                      onChange={(event) => setFormPlate(event.target.value.toUpperCase())}
                      className={`${inputClass} mt-2`}
                    />
                  ) : (
                    <input name={name} type={type} required={required} className={`${inputClass} mt-2`} />
                  )}
                </label>
              ))}
              <AddressField
                name="customer_address"
                label="Customer address"
                className="sm:col-span-2"
                placeholder="Home or business address"
              />
              <label className="text-sm font-semibold sm:col-span-2">
                Internal note
                <span className="ml-2 text-[11px] font-normal uppercase text-[#6f746e]">Staff only — not printed or sent to the customer</span>
                <textarea
                  name="internal_notes"
                  rows={3}
                  className={`${inputClass} mt-2`}
                  placeholder="Workshop notes, customer concerns, damage, requested work..."
                />
              </label>
              <input type="hidden" name="job_kind" value={jobKind} />
            </div>
            <div className="flex justify-end border-t border-[#d7d3c8] p-5">
              <button disabled={saving} className={buttonClass}>
                <Save size={16} />{saving ? "Opening job card..." : "Open job card"}
              </button>
            </div>
          </Panel>
        </form>
      </div>
    </AppShell>
  );
}
