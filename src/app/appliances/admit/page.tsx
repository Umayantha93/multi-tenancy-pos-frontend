"use client";

import { FormEvent, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { ClipboardCheck, Search } from "lucide-react";
import { AppShell } from "@/components/app-shell";
import { AddressField } from "@/components/address-field";
import { EmployeePicker } from "@/components/employee-picker";
import { buttonClass, ErrorMessage, inputClass, Panel } from "@/components/ui";
import { api, currentFeatures } from "@/lib/api";
import { allowsRepairJobs, allowsServiceJobs, APPLIANCE_TYPE_LABELS } from "@/lib/business-profiles";
import { useT } from "@/lib/locale";

type JobKind = "repair" | "service";
type ServicePlace = "workshop" | "on_site";

type ApplianceMatch = {
  id: number;
  number_plate: string;
  appliance_type?: string | null;
  appliance_type_name?: string | null;
  make?: string | null;
  model?: string | null;
  bills_count: number;
  customer: { id: number; name: string; phone: string; address?: string | null };
};

type CustomerMatch = {
  id: number;
  name: string;
  phone: string;
  address?: string | null;
};

type CustomerDetail = CustomerMatch & {
  vehicles: Array<{
    id: number;
    asset_kind?: string | null;
    number_plate: string;
    appliance_type?: string | null;
    appliance_type_name?: string | null;
    make?: string | null;
    model?: string | null;
  }>;
};

const BUILT_IN_APPLIANCES = Object.keys(APPLIANCE_TYPE_LABELS).map((key) => ({
  key,
  name: APPLIANCE_TYPE_LABELS[key],
}));

type ApplianceTypeOption = { key: string; name: string };

function applianceOptionLabel(key: string, name: string, t: (key: string) => string) {
  return APPLIANCE_TYPE_LABELS[key] ? t(`admit.appliance_${key}`) : name;
}

function ChoiceRow({
  label,
  value,
  options,
  onChange,
}: {
  label: string;
  value: string;
  options: Array<[string, string]>;
  onChange: (next: string) => void;
}) {
  if (options.length === 0) return null;
  return (
    <div className="text-xs font-semibold">
      {label}
      <div
        className="mt-1.5 grid h-7 overflow-hidden border border-[#c9c5b9] bg-white"
        style={{ gridTemplateColumns: `repeat(${options.length}, minmax(0, 1fr))` }}
        role="group"
        aria-label={label}
      >
        {options.map(([id, text]) => {
          const selected = value === id;
          return (
            <button
              key={id}
              type="button"
              onClick={() => onChange(id)}
              aria-pressed={selected}
              className={`min-w-0 truncate px-2 text-[10px] font-bold uppercase leading-none ${selected ? "bg-[#20221f] text-white" : "text-[#20221f] hover:bg-[#f7f5ef]"}`}
            >
              {text}
            </button>
          );
        })}
      </div>
    </div>
  );
}

function todayIsoDate() {
  const now = new Date();
  const month = String(now.getMonth() + 1).padStart(2, "0");
  const day = String(now.getDate()).padStart(2, "0");
  return `${now.getFullYear()}-${month}-${day}`;
}

export default function AdmitAppliancePage() {
  const router = useRouter();
  const t = useT();
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);
  const [serialQuery, setSerialQuery] = useState("");
  const [matches, setMatches] = useState<ApplianceMatch[]>([]);
  const [lookingUp, setLookingUp] = useState(false);
  const [creatingId, setCreatingId] = useState<number | null>(null);
  const [customerName, setCustomerName] = useState("");
  const [customerPhone, setCustomerPhone] = useState("");
  const [customerAddress, setCustomerAddress] = useState("");
  const [customerMatches, setCustomerMatches] = useState<CustomerMatch[]>([]);
  const [customerAppliances, setCustomerAppliances] = useState<CustomerDetail["vehicles"]>([]);
  const [applianceTypes, setApplianceTypes] = useState<ApplianceTypeOption[]>(BUILT_IN_APPLIANCES);
  const [applianceType, setApplianceType] = useState("split_ac");
  const [addingType, setAddingType] = useState(false);
  const [newTypeName, setNewTypeName] = useState("");
  const [savingType, setSavingType] = useState(false);
  const [servicePlace, setServicePlace] = useState<ServicePlace>("workshop");
  const [jobKind, setJobKind] = useState<JobKind>("repair");
  const [canRepair, setCanRepair] = useState(true);
  const [canService, setCanService] = useState(true);
  const [admissionDate, setAdmissionDate] = useState(todayIsoDate);
  const [employees, setEmployees] = useState<Array<{ id: number; name: string; position?: string | null }>>([]);
  const [employeeIds, setEmployeeIds] = useState<number[]>([]);

  useEffect(() => {
    api<ApplianceTypeOption[]>("/appliance-types")
      .then((rows) => {
        if (rows.length > 0) setApplianceTypes(rows);
      })
      .catch(() => undefined);
  }, []);

  useEffect(() => {
    const features = currentFeatures();
    const repair = allowsRepairJobs("ac_service", features);
    const service = allowsServiceJobs("ac_service", features);
    setCanRepair(repair);
    setCanService(service);
    if (repair && !service) setJobKind("repair");
    if (service && !repair) setJobKind("service");
    if (features.includes("admit_vehicle") || features.includes("employees_management")) {
      api<{ data: Array<{ id: number; name: string; position?: string | null }> }>("/employees/options")
        .then((result) => setEmployees(result.data))
        .catch(() => setEmployees([]));
    }
  }, []);

  useEffect(() => {
    if (serialQuery.trim().length < 2) {
      setMatches([]);
      return;
    }
    setLookingUp(true);
    const timer = setTimeout(() => {
      api<{ data: ApplianceMatch[] }>(`/vehicles?search=${encodeURIComponent(serialQuery.trim())}&asset_kind=appliance&per_page=20`)
        .then((result) => setMatches(result.data))
        .catch(() => setMatches([]))
        .finally(() => setLookingUp(false));
    }, 300);
    return () => clearTimeout(timer);
  }, [serialQuery]);

  useEffect(() => {
    const phoneDigits = customerPhone.replace(/\D/g, "");
    if (phoneDigits.length < 3) {
      setCustomerMatches([]);
      return;
    }
    const timer = setTimeout(() => {
      api<{ data: CustomerMatch[] }>(`/customers?phone=${encodeURIComponent(customerPhone.trim())}&per_page=8`)
        .then((result) => setCustomerMatches(result.data))
        .catch(() => setCustomerMatches([]));
    }, 300);
    return () => clearTimeout(timer);
  }, [customerPhone]);

  async function pickCustomer(match: CustomerMatch) {
    setCustomerName(match.name || "");
    setCustomerPhone(match.phone || "");
    setCustomerAddress(match.address || "");
    setCustomerMatches([]);
    try {
      const detail = await api<CustomerDetail>(`/customers/${match.id}`);
      setCustomerAppliances((detail.vehicles ?? []).filter((vehicle) => vehicle.asset_kind === "appliance"));
    } catch {
      setCustomerAppliances([]);
    }
  }

  async function addApplianceType() {
    const name = newTypeName.trim();
    if (!name || savingType) return;
    setSavingType(true);
    setError("");
    try {
      const created = await api<ApplianceTypeOption>("/appliance-types", {
        method: "POST",
        body: JSON.stringify({ name }),
      });
      setApplianceTypes((current) => (
        current.some((row) => row.key === created.key) ? current : [...current, created]
      ));
      setApplianceType(created.key);
      setNewTypeName("");
      setAddingType(false);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : t("admit.admit_failed"));
    } finally {
      setSavingType(false);
    }
  }

  function openExisting(vehicleId: number) {
    setCreatingId(vehicleId);
    setError("");
    api<{ id: number }>("/bills/from-vehicle", {
      method: "POST",
      body: JSON.stringify({
        vehicle_id: vehicleId,
        job_kind: jobKind,
        service_place: servicePlace,
        admission_date: admissionDate,
        employee_ids: employeeIds,
      }),
    })
      .then((bill) => router.push(`/bills/${bill.id}`))
      .catch((caught) => {
        setError(caught instanceof Error ? caught.message : t("admit.admit_failed"));
        setCreatingId(null);
      });
  }

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSaving(true);
    setError("");
    const form = new FormData(event.currentTarget);
    try {
      const bill = await api<{ id: number }>("/bills", {
        method: "POST",
        body: JSON.stringify({
          customer_name: customerName,
          customer_phone: customerPhone,
          customer_address: customerAddress,
          number_plate: String(form.get("serial") || ""),
          make: String(form.get("make") || ""),
          model: String(form.get("model") || ""),
          fault_description: String(form.get("fault_description") || ""),
          asset_kind: "appliance",
          appliance_type: applianceType,
          service_place: servicePlace,
          job_kind: jobKind,
          admission_date: admissionDate,
          employee_ids: employeeIds,
        }),
      });
      router.push(`/bills/${bill.id}`);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : t("admit.admit_failed"));
      setSaving(false);
    }
  }

  return (
    <AppShell title={t("admit.title_appliance")} eyebrow={t("admit.eyebrow")}>
      <div className="mx-auto max-w-5xl space-y-5">
        <div className="flex items-start gap-4 border-l-4 border-[#f5c842] bg-[#fbfaf6] p-4">
          <ClipboardCheck className="shrink-0 text-[#167c73]" />
          <div>
            <p className="font-semibold">{t("admit.search_first_serial")}</p>
            <p className="text-sm text-[#6f746e]">{t("admit.search_hint_appliance")}</p>
          </div>
        </div>

        <Panel className="p-5">
          <h2 className="font-display text-2xl font-semibold uppercase">{t("admit.search_by_serial")}</h2>
          <label className="relative mt-4 block max-w-xl">
            <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 text-[#6f746e]" size={14} />
            <input
              value={serialQuery}
              onChange={(event) => setSerialQuery(event.target.value.toUpperCase())}
              className={`${inputClass} pl-8`}
              placeholder={t("admit.serial_placeholder")}
            />
          </label>
          {lookingUp && <p className="mt-3 text-sm text-[#6f746e]">{t("admit.searching")}</p>}
          {matches.length > 0 && (
            <div className="mt-4 divide-y divide-[#e2ded4] border border-[#e2ded4]">
              {matches.map((item) => (
                <div key={item.id} className="flex flex-wrap items-center justify-between gap-3 px-4 py-3">
                  <div>
                    <p className="font-semibold">{item.number_plate}</p>
                    <p className="text-xs text-[#6f746e]">
                      {[applianceOptionLabel(item.appliance_type ?? "", item.appliance_type_name ?? "", t), item.make, item.model, item.customer?.name].filter(Boolean).join(" · ")}
                    </p>
                  </div>
                  <button type="button" disabled={creatingId === item.id} onClick={() => openExisting(item.id)} className={buttonClass}>
                    {t("admit.new_job")}
                  </button>
                </div>
              ))}
            </div>
          )}
        </Panel>

        {error && <ErrorMessage message={error} />}

        <form onSubmit={submit}>
          <Panel>
            <div className="border-b border-[#d7d3c8] px-5 py-4">
              <h2 className="font-display text-2xl font-semibold uppercase">{t("admit.new_customer_appliance")}</h2>
              <p className="mt-1 text-sm text-[#6f746e]">{t("admit.form_hint_appliance")}</p>
            </div>
            <div className="grid gap-5 p-5 sm:grid-cols-2">
              <label className="relative text-xs font-semibold">
                {t("admit.customer_phone")}
                <input value={customerPhone} onChange={(event) => setCustomerPhone(event.target.value)} className={`${inputClass} mt-2`} placeholder={t("admit.phone_placeholder")} />
                {customerMatches.length > 0 && (
                  <div className="absolute left-0 right-0 top-full z-20 mt-1 max-h-56 overflow-y-auto border border-[#d7d3c8] bg-white shadow-lg">
                    {customerMatches.map((match) => (
                      <button key={match.id} type="button" onClick={() => void pickCustomer(match)} className="block w-full border-b border-[#e2ded4] px-3 py-2.5 text-left last:border-b-0 hover:bg-[#f7f5ef]">
                        <p className="font-semibold">{match.name}</p>
                        <p className="text-xs font-normal text-[#6f746e]">{match.phone}</p>
                      </button>
                    ))}
                  </div>
                )}
              </label>
              <label className="text-xs font-semibold">
                {t("admit.customer_name")}
                <input value={customerName} onChange={(event) => setCustomerName(event.target.value)} className={`${inputClass} mt-2`} />
              </label>
              <label className="text-xs font-semibold sm:col-span-2">
                {t("admit.customer_address")}
                <AddressField name="customer_address" value={customerAddress} onChange={setCustomerAddress} className="mt-2" placeholder={t("admit.address_placeholder")} />
              </label>
              {customerAppliances.length > 0 && (
                <div className="sm:col-span-2">
                  <p className="text-xs font-semibold">{t("admit.existing_appliances")}</p>
                  <p className="mt-1 text-xs text-[#6f746e]">{t("admit.existing_hint_appliance")}</p>
                  <div className="mt-3 divide-y divide-[#e2ded4] border border-[#e2ded4]">
                    {customerAppliances.map((item) => (
                      <div key={item.id} className="flex flex-wrap items-center justify-between gap-3 px-4 py-3">
                        <div>
                          <p className="font-semibold">{item.number_plate}</p>
                          <p className="text-xs text-[#6f746e]">{[applianceOptionLabel(item.appliance_type ?? "", item.appliance_type_name ?? "", t), item.make, item.model].filter(Boolean).join(" · ")}</p>
                        </div>
                        <button type="button" disabled={creatingId === item.id} onClick={() => openExisting(item.id)} className={buttonClass}>
                          {t("admit.new_job")}
                        </button>
                      </div>
                    ))}
                  </div>
                </div>
              )}
              <div className="text-xs font-semibold">
                {t("admit.appliance_type")}
                <div className="mt-2 flex gap-1.5">
                  <select value={applianceType} onChange={(event) => setApplianceType(event.target.value)} className={`${inputClass} min-w-0 flex-1`}>
                    {applianceTypes.map((row) => (
                      <option key={row.key} value={row.key}>{applianceOptionLabel(row.key, row.name, t)}</option>
                    ))}
                  </select>
                  <button
                    type="button"
                    onClick={() => setAddingType((open) => !open)}
                    className="h-8 shrink-0 border border-[#c9c5b9] bg-white px-2.5 text-[10px] font-bold uppercase hover:border-[#20221f]"
                  >
                    {t("admit.add_appliance")}
                  </button>
                </div>
                {addingType && (
                  <div className="mt-1.5 flex gap-1.5">
                    <input
                      value={newTypeName}
                      onChange={(event) => setNewTypeName(event.target.value)}
                      onKeyDown={(event) => {
                        if (event.key === "Enter") {
                          event.preventDefault();
                          void addApplianceType();
                        }
                      }}
                      className={`${inputClass} min-w-0 flex-1`}
                      placeholder={t("admit.appliance_name_placeholder")}
                    />
                    <button type="button" disabled={savingType || !newTypeName.trim()} onClick={() => void addApplianceType()} className={buttonClass}>
                      {savingType ? t("common.saving") : t("common.save")}
                    </button>
                  </div>
                )}
              </div>
              <label className="text-xs font-semibold">
                {t("admit.serial")}
                <input name="serial" required className={`${inputClass} mt-2 uppercase`} placeholder={t("admit.serial_placeholder")} />
              </label>
              <label className="text-xs font-semibold">
                {t("admit.brand")}
                <input name="make" className={`${inputClass} mt-2`} />
              </label>
              <label className="text-xs font-semibold">
                {t("admit.model")}
                <input name="model" className={`${inputClass} mt-2`} />
              </label>
              <label className="text-xs font-semibold sm:col-span-2">
                {t("admit.fault")}
                <input name="fault_description" className={`${inputClass} mt-2`} />
              </label>
              <ChoiceRow
                label={t("admit.service_place")}
                value={servicePlace}
                onChange={(next) => setServicePlace(next as ServicePlace)}
                options={[["workshop", t("admit.workshop")], ["on_site", t("admit.on_site")]]}
              />
              <ChoiceRow
                label={t("admit.job_type")}
                value={jobKind}
                onChange={(next) => setJobKind(next as JobKind)}
                options={[
                  ...(canRepair ? [["repair", t("admit.repair")] as [string, string]] : []),
                  ...(canService ? [["service", t("admit.service")] as [string, string]] : []),
                ]}
              />
              <label className="text-xs font-semibold">
                {t("admit.job_date")}
                <input type="date" value={admissionDate} onChange={(event) => setAdmissionDate(event.target.value)} className={`${inputClass} mt-1.5`} />
              </label>
              {employees.length > 0 && (
                <div className="sm:col-span-2">
                  <p className="mb-2 text-xs font-semibold">{t("admit.assign_employees")}</p>
                  <EmployeePicker employees={employees} selectedIds={employeeIds} onChange={setEmployeeIds} />
                </div>
              )}
            </div>
            <div className="border-t border-[#d7d3c8] px-5 py-4">
              <button disabled={saving} className={buttonClass}>{saving ? t("common.saving") : t("admit.title_appliance")}</button>
            </div>
          </Panel>
        </form>
      </div>
    </AppShell>
  );
}
