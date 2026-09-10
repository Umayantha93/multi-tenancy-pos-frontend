"use client";

import { FormEvent, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { ClipboardCheck, Plus, Save, Search } from "lucide-react";
import { AppShell } from "@/components/app-shell";
import { AddressField } from "@/components/address-field";
import { EmployeePicker } from "@/components/employee-picker";
import { buttonClass, ErrorMessage, inputClass, Panel } from "@/components/ui";
import { api, currentFeatures } from "@/lib/api";
import { useBusinessProfile } from "@/lib/use-business-profile";

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

type CustomerMatch = {
  id: number;
  name: string;
  phone: string;
  address?: string | null;
  vehicles_count?: number;
};

type CustomerDetail = CustomerMatch & {
  vehicles: Array<{
    id: number;
    number_plate: string;
    make?: string | null;
    model?: string | null;
    year?: number | null;
    bills_count?: number;
  }>;
};

type JobKind = "repair" | "service";
type EmployeeOption = { id: number; name: string; position?: string | null };

export default function AdmitVehiclePage() {
  const router = useRouter();
  const profile = useBusinessProfile();
  const isDevice = profile.type === "device_repair";
  const isTyre = profile.type === "tyre";
  const isPaint = profile.type === "paint";
  const isGarage = profile.type === "garage";
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
  const [customerName, setCustomerName] = useState("");
  const [customerPhone, setCustomerPhone] = useState("");
  const [customerAddress, setCustomerAddress] = useState("");
  const [customerMatches, setCustomerMatches] = useState<CustomerMatch[]>([]);
  const [lookingUpCustomer, setLookingUpCustomer] = useState(false);
  const [showCustomerSuggestions, setShowCustomerSuggestions] = useState(false);
  const [customerVehicles, setCustomerVehicles] = useState<CustomerDetail["vehicles"]>([]);
  const [selectedCustomerId, setSelectedCustomerId] = useState<number | null>(null);
  const [jobKind, setJobKind] = useState<JobKind>("repair");
  const [employees, setEmployees] = useState<EmployeeOption[]>([]);
  const [employeeIds, setEmployeeIds] = useState<number[]>([]);
  const [canAssignEmployees, setCanAssignEmployees] = useState(false);
  const phoneBoxRef = useRef<HTMLLabelElement>(null);

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

  useEffect(() => {
    const digits = customerPhone.replace(/\D/g, "");
    if (digits.length < 3) {
      setCustomerMatches([]);
      setLookingUpCustomer(false);
      return;
    }
    setLookingUpCustomer(true);
    const timer = setTimeout(() => {
      api<{ data: CustomerMatch[] }>(`/customers?phone=${encodeURIComponent(customerPhone.trim())}&per_page=10`)
        .then((result) => {
          setCustomerMatches(result.data);
          setShowCustomerSuggestions(true);
        })
        .catch(() => setCustomerMatches([]))
        .finally(() => setLookingUpCustomer(false));
    }, 300);
    return () => clearTimeout(timer);
  }, [customerPhone]);

  useEffect(() => {
    function onPointer(event: MouseEvent) {
      if (!phoneBoxRef.current?.contains(event.target as Node)) {
        setShowCustomerSuggestions(false);
      }
    }
    window.addEventListener("mousedown", onPointer);
    return () => window.removeEventListener("mousedown", onPointer);
  }, []);

  async function pickCustomer(match: CustomerMatch) {
    setCustomerName(match.name || "");
    setCustomerPhone(match.phone || "");
    setCustomerAddress(match.address || "");
    setSelectedCustomerId(match.id);
    setShowCustomerSuggestions(false);
    setCustomerMatches([]);
    setError("");
    try {
      const detail = await api<CustomerDetail>(`/customers/${match.id}`);
      setCustomerVehicles(detail.vehicles ?? []);
    } catch {
      setCustomerVehicles([]);
    }
  }

  function onPhoneChange(value: string) {
    setCustomerPhone(value);
    setSelectedCustomerId(null);
    setCustomerVehicles([]);
  }

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
    const payload: Record<string, unknown> = {
      ...form,
      customer_name: customerName,
      customer_phone: customerPhone,
      customer_address: customerAddress,
      employee_ids: employeeIds,
    };
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
    <AppShell title={isDevice ? "Admit a device" : "Admit a vehicle"} eyebrow={isPaint ? "New paint job" : "New job card"}>
      <div className="mx-auto max-w-5xl space-y-5">
        <div className="flex items-start gap-4 border-l-4 border-[#f5c842] bg-[#fbfaf6] p-4">
          <ClipboardCheck className="shrink-0 text-[#167c73]" />
          <div>
            <p className="font-semibold">{isDevice ? "Search an existing device first" : "Search an existing plate first"}</p>
            <p className="text-sm text-[#6f746e]">
              {isPaint
                ? "If it already exists, open another paint job. Or type the customer phone below to reuse their details and pick another vehicle."
                : "If it already exists, open another job card. Or type the customer phone below to reuse their details and pick another vehicle."}
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
                      {vehicle.bills_count} previous {isPaint ? "paint job" : "job card"}{vehicle.bills_count === 1 ? "" : "s"}
                    </p>
                  </div>
                  <button
                    type="button"
                    disabled={creatingId === vehicle.id}
                    onClick={() => openNewCard(vehicle.id)}
                    className={buttonClass}
                  >
                    <Plus size={16} />{creatingId === vehicle.id ? "Opening..." : (isPaint ? "New paint job" : "New job card")}
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
          <p className="mt-1 text-sm text-[#6f746e]">
            {isPaint
              ? "Panel work is labor hours plus color stock. Paint package uses the priced buttons."
              : "Repair uses parts and labor. Service uses the priced addon buttons."}
          </p>
          <div className="mt-4 grid max-w-md grid-cols-2 gap-2">
            {([
              ["repair", isPaint ? "Panel work" : "Repair"],
              ["service", isPaint ? "Paint package" : "Service"],
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
              <p className="mt-1 text-sm text-[#6f746e]">
                Type a phone number to find an existing customer and fill their details. Then open a job on one of their vehicles, or enter a new plate below.
              </p>
            </div>
            <div className="grid gap-5 p-5 sm:grid-cols-2">
              {fields.map(([name, label, type, required]) => {
                if (name === "customer_phone") {
                  return (
                    <label key={name} ref={phoneBoxRef} className="relative text-sm font-semibold">
                      {label}
                      <input
                        name={name}
                        type={type}
                        value={customerPhone}
                        onChange={(event) => onPhoneChange(event.target.value)}
                        onFocus={() => {
                          if (customerMatches.length > 0) setShowCustomerSuggestions(true);
                        }}
                        autoComplete="off"
                        className={`${inputClass} mt-2`}
                        placeholder="e.g. 0771234567"
                      />
                      {lookingUpCustomer && (
                        <p className="mt-1 text-xs font-normal text-[#6f746e]">Looking up customers…</p>
                      )}
                      {showCustomerSuggestions && customerMatches.length > 0 && (
                        <div className="absolute left-0 right-0 top-full z-20 mt-1 max-h-56 overflow-y-auto border border-[#d7d3c8] bg-white shadow-lg">
                          {customerMatches.map((match) => (
                            <button
                              key={match.id}
                              type="button"
                              onClick={() => void pickCustomer(match)}
                              className="block w-full border-b border-[#e2ded4] px-3 py-2.5 text-left last:border-b-0 hover:bg-[#f7f5ef]"
                            >
                              <p className="font-semibold">{match.name}</p>
                              <p className="text-xs font-normal text-[#6f746e]">
                                {match.phone}
                                {match.vehicles_count != null ? ` · ${match.vehicles_count} vehicle${match.vehicles_count === 1 ? "" : "s"}` : ""}
                              </p>
                            </button>
                          ))}
                        </div>
                      )}
                    </label>
                  );
                }
                if (name === "customer_name") {
                  return (
                    <label key={name} className="text-sm font-semibold">
                      {label}
                      <input
                        name={name}
                        type={type}
                        value={customerName}
                        onChange={(event) => setCustomerName(event.target.value)}
                        className={`${inputClass} mt-2`}
                      />
                    </label>
                  );
                }
                if (name === "number_plate") {
                  return (
                    <label key={name} className="text-sm font-semibold">
                      {label}{required && <span className="text-[#b84837]"> *</span>}
                      <input
                        name={name}
                        type={type}
                        required={required}
                        value={formPlate}
                        onChange={(event) => setFormPlate(event.target.value.toUpperCase())}
                        className={`${inputClass} mt-2`}
                      />
                    </label>
                  );
                }
                return (
                  <label key={name} className="text-sm font-semibold">
                    {label}{required && <span className="text-[#b84837]"> *</span>}
                    <input name={name} type={type} required={required} className={`${inputClass} mt-2`} />
                  </label>
                );
              })}
              <AddressField
                name="customer_address"
                label="Customer address"
                value={customerAddress}
                onChange={setCustomerAddress}
                className="sm:col-span-2"
                placeholder="Home or business address"
              />
              {selectedCustomerId && (
                <div className="sm:col-span-2 border border-[#d7d3c8] bg-white">
                  <div className="border-b border-[#e2ded4] px-4 py-3">
                    <p className="text-[10px] font-bold uppercase tracking-wide text-[#167c73]">Existing vehicles for this customer</p>
                    <p className="mt-1 text-sm text-[#6f746e]">
                      Open a job on one of these, or fill a new {isDevice ? "device ID" : "number plate"} above.
                    </p>
                  </div>
                  {customerVehicles.length === 0 ? (
                    <p className="px-4 py-4 text-sm text-[#6f746e]">No vehicles on file yet — enter a new one in the form.</p>
                  ) : (
                    <div className="divide-y divide-[#e2ded4]">
                      {customerVehicles.map((vehicle) => (
                        <div key={vehicle.id} className="flex flex-wrap items-center justify-between gap-3 px-4 py-3">
                          <div>
                            <p className="font-semibold">{vehicle.number_plate}</p>
                            <p className="text-sm text-[#6f746e]">
                              {[vehicle.make, vehicle.model, vehicle.year].filter(Boolean).join(" · ") || (isDevice ? "Device" : "Vehicle")}
                            </p>
                          </div>
                          <button
                            type="button"
                            disabled={creatingId === vehicle.id}
                            onClick={() => openNewCard(vehicle.id)}
                            className={buttonClass}
                          >
                            <Plus size={16} />
                            {creatingId === vehicle.id ? "Opening..." : (isPaint ? "New paint job" : "New job card")}
                          </button>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}
              <label className="text-sm font-semibold sm:col-span-2">
                {isGarage ? "Additional note" : "Internal note"}
                <span className="ml-2 text-[11px] font-normal uppercase text-[#6f746e]">
                  {isGarage ? "Prints at the end of the bill" : "Staff only — not printed or sent to the customer"}
                </span>
                <textarea
                  name="internal_notes"
                  rows={3}
                  className={`${inputClass} mt-2`}
                  placeholder={isPaint
                    ? "Paint code, finish (solid / metallic / pearl), existing colour, requested work..."
                    : isGarage
                      ? "Note for the customer at the end of this bill..."
                      : "Workshop notes, customer concerns, damage, requested work..."}
                />
              </label>
              {isGarage && (
                <div className="sm:col-span-2">
                  <p className="text-[11px] font-bold uppercase">Note background</p>
                  <div className="mt-2 flex items-center gap-1.5">
                    <label className="cursor-pointer">
                      <input type="radio" name="additional_note_color" value="blue" defaultChecked className="peer sr-only" />
                      <span className="block size-7 border border-transparent bg-[#1b365d] peer-checked:border-[#20221f] peer-checked:ring-2 peer-checked:ring-[#20221f] peer-checked:ring-offset-1" aria-hidden />
                      <span className="sr-only">Navy</span>
                    </label>
                    <label className="cursor-pointer">
                      <input type="radio" name="additional_note_color" value="red" className="peer sr-only" />
                      <span className="block size-7 border border-transparent bg-[#7a1c2e] peer-checked:border-[#20221f] peer-checked:ring-2 peer-checked:ring-[#20221f] peer-checked:ring-offset-1" aria-hidden />
                      <span className="sr-only">Maroon</span>
                    </label>
                  </div>
                </div>
              )}
              <input type="hidden" name="job_kind" value={jobKind} />
            </div>
            <div className="flex justify-end border-t border-[#d7d3c8] p-5">
              <button disabled={saving} className={buttonClass}>
                <Save size={16} />{saving ? "Opening job card..." : (isPaint ? "Open paint job" : "Open job card")}
              </button>
            </div>
          </Panel>
        </form>
      </div>
    </AppShell>
  );
}
