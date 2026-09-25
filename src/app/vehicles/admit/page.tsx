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
import { allowsRepairJobs, allowsServiceJobs } from "@/lib/business-profiles";
import { useT } from "@/lib/locale";

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

const JOB_KIND_STORAGE_KEY = "garage_admit_job_kind";

function todayIsoDate() {
  const now = new Date();
  const month = String(now.getMonth() + 1).padStart(2, "0");
  const day = String(now.getDate()).padStart(2, "0");
  return `${now.getFullYear()}-${month}-${day}`;
}

function readStoredJobKind(): JobKind | null {
  if (typeof window === "undefined") return null;
  const stored = localStorage.getItem(JOB_KIND_STORAGE_KEY);
  return stored === "repair" || stored === "service" ? stored : null;
}

export default function AdmitVehiclePage() {
  const router = useRouter();
  const t = useT();
  const profile = useBusinessProfile();
  const isDevice = profile.type === "device_repair";
  const isTyre = profile.type === "tyre";
  const isPaint = profile.type === "paint";
  const isGarage = profile.type === "garage";
  const fields: Array<[string, string, string, boolean]> = [
    ["customer_name", t("admit.customer_name"), "text", false],
    ["customer_phone", t("admit.customer_phone"), "tel", false],
    ["number_plate", isDevice ? t("admit.device_id") : t("admit.number_plate"), "text", true],
    [isDevice ? "imei" : "chassis_number", isDevice ? t("admit.imei") : t("admit.chassis"), "text", false],
    ["make", isDevice ? t("admit.brand") : t("admit.make"), "text", false],
    ["model", t("admit.model"), "text", false],
    ["year", isDevice ? t("admit.year_device") : t("admit.year"), "number", false],
  ];
  if (!isDevice) fields.push(["odometer", t("admit.odometer"), "number", false]);
  if (isTyre) {
    fields.push(["tyre_size", t("admit.tyre_size"), "text", false], ["axle", t("admit.axle"), "text", false]);
  }
  if (isDevice) fields.push(["fault_description", t("admit.fault"), "text", false]);

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
  const [admissionDate, setAdmissionDate] = useState(todayIsoDate);
  const [canRepair, setCanRepair] = useState(true);
  const [canService, setCanService] = useState(true);
  const [employees, setEmployees] = useState<EmployeeOption[]>([]);
  const [employeeIds, setEmployeeIds] = useState<number[]>([]);
  const [canAssignEmployees, setCanAssignEmployees] = useState(false);
  const [driverName, setDriverName] = useState("");
  const [driverPhone, setDriverPhone] = useState("");
  const phoneBoxRef = useRef<HTMLLabelElement>(null);

  function chooseJobKind(next: JobKind) {
    setJobKind(next);
    try {
      localStorage.setItem(JOB_KIND_STORAGE_KEY, next);
    } catch {
      /* ignore */
    }
  }

  useEffect(() => {
    const features = currentFeatures();
    setCanAssignEmployees(features.includes("employees_management") || features.includes("attendance"));
    const repair = allowsRepairJobs(profile.type, features);
    const service = allowsServiceJobs(profile.type, features);
    setCanRepair(repair);
    setCanService(service);
    if (repair && !service) {
      chooseJobKind("repair");
      return;
    }
    if (service && !repair) {
      chooseJobKind("service");
      return;
    }
    const stored = readStoredJobKind();
    if (stored === "repair" && repair) chooseJobKind("repair");
    else if (stored === "service" && service) chooseJobKind("service");
  }, [profile.type]);

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
        body: JSON.stringify({
          vehicle_id: vehicleId,
          job_kind: jobKind,
          admission_date: admissionDate,
          employee_ids: employeeIds,
          driver_name: driverName.trim() || null,
          driver_phone: driverPhone.trim() || null,
        }),
      });
      router.push(`/bills/${bill.id}`);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : t("admit.open_failed"));
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
      job_kind: jobKind,
      admission_date: admissionDate,
      employee_ids: employeeIds,
      driver_name: driverName.trim() || null,
      driver_phone: driverPhone.trim() || null,
    };
    if (isDevice) payload.asset_kind = "device";
    try {
      const bill = await api<{ id: number }>("/bills", { method: "POST", body: JSON.stringify(payload) });
      router.push(`/bills/${bill.id}`);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : t("admit.admit_failed"));
      setSaving(false);
    }
  }

  return (
    <AppShell title={isDevice ? t("admit.title_device") : t("admit.title_vehicle")} eyebrow={isPaint ? t("admit.eyebrow_paint") : t("admit.eyebrow")}>
      <div className="mx-auto max-w-5xl space-y-5">
        <div className="flex items-start gap-4 border-l-4 border-[#f5c842] bg-[#fbfaf6] p-4">
          <ClipboardCheck className="shrink-0 text-[#167c73]" />
          <div>
            <p className="font-semibold">{isDevice ? t("admit.search_first_device") : t("admit.search_first_plate")}</p>
            <p className="text-sm text-[#6f746e]">
              {isPaint ? t("admit.search_hint_paint") : isDevice ? t("admit.search_hint_device") : t("admit.search_hint")}
            </p>
          </div>
        </div>

        <Panel className="p-5">
          <h2 className="font-display text-2xl font-semibold uppercase">{isDevice ? t("admit.search_by_device") : t("admit.search_by_plate")}</h2>
          <label className="relative mt-4 block max-w-xl">
            <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 text-[#6f746e]" size={14} />
            <input
              value={plateQuery}
              onChange={(event) => setPlateQuery(event.target.value.toUpperCase())}
              className={`${inputClass} pl-8`}
              placeholder={isDevice ? t("admit.device_placeholder") : t("admit.plate_placeholder")}
            />
          </label>
          {lookingUp && <p className="mt-3 text-sm text-[#6f746e]">{t("admit.searching")}</p>}
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
                      {isPaint
                        ? t(vehicle.bills_count === 1 ? "admit.previous_paint" : "admit.previous_paints", { count: vehicle.bills_count })
                        : t(vehicle.bills_count === 1 ? "admit.previous_job" : "admit.previous_jobs", { count: vehicle.bills_count })}
                    </p>
                  </div>
                  <button
                    type="button"
                    disabled={creatingId === vehicle.id}
                    onClick={() => openNewCard(vehicle.id)}
                    className={buttonClass}
                  >
                    <Plus size={16} />{creatingId === vehicle.id ? t("common.opening") : (isPaint ? t("admit.new_paint") : t("admit.new_job"))}
                  </button>
                </div>
              ))}
            </div>
          )}
          {!lookingUp && plateQuery.trim().length >= 2 && vehicles.length === 0 && (
            <p className="mt-4 text-sm text-[#6f746e]">{t("admit.no_match")}</p>
          )}
        </Panel>

        <Panel className="p-5">
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div className="min-w-0 flex-1">
              <h2 className="font-display text-2xl font-semibold uppercase">{t("admit.job_type")}</h2>
              <p className="mt-1 text-sm text-[#6f746e]">
                {isPaint
                  ? t("admit.job_type_hint_paint")
                  : isGarage && !(canRepair && canService)
                    ? (canService ? "Every new admission is a service job." : "Every new admission is a repair job.")
                    : t("admit.job_type_hint")}
              </p>
            </div>
            <label className="block text-[10px] font-bold uppercase text-[#6f746e]">
              {t("admit.job_date")}
              <input
                type="date"
                value={admissionDate}
                max={todayIsoDate()}
                onChange={(event) => setAdmissionDate(event.target.value || todayIsoDate())}
                className={`${inputClass} mt-1 w-auto min-w-40 font-normal normal-case`}
              />
            </label>
          </div>
          {(!isGarage || (canRepair && canService)) ? (
            <div
              className="mt-4 inline-flex max-w-md overflow-hidden border border-[#20221f] bg-white p-0.5"
              role="group"
              aria-label={t("admit.job_type")}
            >
              {([
                ["repair", isPaint ? t("admit.panel_work") : t("admit.repair")],
                ["service", isPaint ? t("admit.paint_package") : t("admit.service")],
              ] as const).map(([value, label]) => {
                const selected = jobKind === value;
                return (
                  <button
                    key={value}
                    type="button"
                    onClick={() => chooseJobKind(value)}
                    className={`h-9 min-w-28 flex-1 px-4 text-[11px] font-bold uppercase transition ${
                      selected
                        ? "bg-[#20221f] text-white"
                        : "bg-transparent text-[#20221f] hover:bg-[#f7f5ef]"
                    }`}
                    aria-pressed={selected}
                  >
                    {label}
                  </button>
                );
              })}
            </div>
          ) : (
            <p className="mt-4 text-sm font-semibold">{canService ? t("admit.service") : t("admit.repair")}</p>
          )}
          {!isDevice && (
            <div className="mt-5 grid max-w-2xl gap-4 sm:grid-cols-2">
              <label className="text-xs font-semibold">
                {t("admit.driver_name")} <span className="font-normal text-[#6f746e]">{t("instant.optional")}</span>
                <input
                  value={driverName}
                  onChange={(event) => setDriverName(event.target.value)}
                  className={`${inputClass} mt-2`}
                  autoComplete="off"
                />
              </label>
              <label className="text-xs font-semibold">
                {t("admit.driver_phone")} <span className="font-normal text-[#6f746e]">{t("instant.optional")}</span>
                <input
                  type="tel"
                  value={driverPhone}
                  onChange={(event) => setDriverPhone(event.target.value)}
                  className={`${inputClass} mt-2`}
                  autoComplete="off"
                />
              </label>
            </div>
          )}
          {canAssignEmployees && (
            <div className="mt-5">
              <p className="mb-2 text-xs font-semibold">{t("admit.assign_employees")} <span className="font-normal text-[#6f746e]">{t("admit.assign_employees_hint")}</span></p>
              <EmployeePicker employees={employees} selectedIds={employeeIds} onChange={setEmployeeIds} />
            </div>
          )}
        </Panel>

        {error && <ErrorMessage message={error} />}

        <form onSubmit={submit}>
          <Panel>
            <div className="border-b border-[#d7d3c8] px-5 py-4">
              <h2 className="font-display text-2xl font-semibold uppercase">{isDevice ? t("admit.new_customer_device") : t("admit.new_customer_vehicle")}</h2>
              <p className="mt-1 text-sm text-[#6f746e]">
                {isDevice ? t("admit.form_hint_device") : t("admit.form_hint")}
              </p>
            </div>
            <div className="grid gap-5 p-5 sm:grid-cols-2">
              {fields.map(([name, label, type, required]) => {
                if (name === "customer_phone") {
                  return (
                    <label key={name} ref={phoneBoxRef} className="relative text-xs font-semibold">
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
                        placeholder={t("admit.phone_placeholder")}
                      />
                      {lookingUpCustomer && (
                        <p className="mt-1 text-xs font-normal text-[#6f746e]">{t("admit.looking_up")}</p>
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
                                {match.vehicles_count != null ? ` · ${t(match.vehicles_count === 1 ? "admit.vehicles_one" : "admit.vehicles_many", { count: match.vehicles_count })}` : ""}
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
                    <label key={name} className="text-xs font-semibold">
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
                    <label key={name} className="text-xs font-semibold">
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
                  <label key={name} className="text-xs font-semibold">
                    {label}{required && <span className="text-[#b84837]"> *</span>}
                    <input name={name} type={type} required={required} className={`${inputClass} mt-2`} />
                  </label>
                );
              })}
              <AddressField
                name="customer_address"
                label={t("admit.customer_address")}
                value={customerAddress}
                onChange={setCustomerAddress}
                className="sm:col-span-2"
                placeholder={t("admit.address_placeholder")}
              />
              {selectedCustomerId && (
                <div className="sm:col-span-2 border border-[#d7d3c8] bg-white">
                  <div className="border-b border-[#e2ded4] px-4 py-3">
                    <p className="text-[10px] font-bold uppercase tracking-wide text-[#167c73]">{t("admit.existing_vehicles")}</p>
                    <p className="mt-1 text-sm text-[#6f746e]">
                      {isDevice ? t("admit.existing_hint_device") : t("admit.existing_hint")}
                    </p>
                  </div>
                  {customerVehicles.length === 0 ? (
                    <p className="px-4 py-4 text-sm text-[#6f746e]">{t("admit.no_vehicles")}</p>
                  ) : (
                    <div className="divide-y divide-[#e2ded4]">
                      {customerVehicles.map((vehicle) => (
                        <div key={vehicle.id} className="flex flex-wrap items-center justify-between gap-3 px-4 py-3">
                          <div>
                            <p className="font-semibold">{vehicle.number_plate}</p>
                            <p className="text-sm text-[#6f746e]">
                              {[vehicle.make, vehicle.model, vehicle.year].filter(Boolean).join(" · ") || (isDevice ? t("admit.device") : t("common.vehicle"))}
                            </p>
                          </div>
                          <button
                            type="button"
                            disabled={creatingId === vehicle.id}
                            onClick={() => openNewCard(vehicle.id)}
                            className={buttonClass}
                          >
                            <Plus size={16} />
                            {creatingId === vehicle.id ? t("common.opening") : (isPaint ? t("admit.new_paint") : t("admit.new_job"))}
                          </button>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}
              <label className="text-xs font-semibold sm:col-span-2">
                {isGarage ? t("admit.additional_note") : t("admit.internal_note")}
                <span className="ml-2 text-[11px] font-normal uppercase text-[#6f746e]">
                  {isGarage ? t("admit.note_prints") : t("admit.note_staff")}
                </span>
                <textarea
                  name="internal_notes"
                  rows={3}
                  className={`${inputClass} mt-2`}
                  placeholder={isPaint
                    ? t("admit.note_placeholder_paint")
                    : isGarage
                      ? t("admit.note_placeholder_garage")
                      : t("admit.note_placeholder")}
                />
              </label>
              {isGarage && (
                <div className="sm:col-span-2">
                  <p className="text-[11px] font-bold uppercase">{t("admit.note_background")}</p>
                  <div className="mt-2 flex items-center gap-1.5">
                    <label className="cursor-pointer">
                      <input type="radio" name="additional_note_color" value="blue" defaultChecked className="peer sr-only" />
                      <span className="block size-7 border border-transparent bg-[#1b365d] peer-checked:border-[#20221f] peer-checked:ring-2 peer-checked:ring-[#20221f] peer-checked:ring-offset-1" aria-hidden />
                      <span className="sr-only">{t("common.navy")}</span>
                    </label>
                    <label className="cursor-pointer">
                      <input type="radio" name="additional_note_color" value="red" className="peer sr-only" />
                      <span className="block size-7 border border-transparent bg-[#7a1c2e] peer-checked:border-[#20221f] peer-checked:ring-2 peer-checked:ring-[#20221f] peer-checked:ring-offset-1" aria-hidden />
                      <span className="sr-only">{t("common.maroon")}</span>
                    </label>
                  </div>
                </div>
              )}
              <input type="hidden" name="job_kind" value={jobKind} />
            </div>
            <div className="flex justify-end border-t border-[#d7d3c8] p-5">
              <button disabled={saving} className={buttonClass}>
                <Save size={16} />{saving ? t("admit.opening_job") : (isPaint ? t("admit.open_paint") : t("admit.open_job"))}
              </button>
            </div>
          </Panel>
        </form>
      </div>
    </AppShell>
  );
}
