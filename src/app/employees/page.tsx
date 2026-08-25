"use client";

import { FormEvent, useEffect, useState } from "react";
import { Eye, Fingerprint, Pencil, Plus, Power, X } from "lucide-react";
import { AppShell } from "@/components/app-shell";
import { buttonClass, ErrorMessage, inputClass, PageState, Panel } from "@/components/ui";
import { api, money } from "@/lib/api";

type Allowance = { name: string; amount: number | string; kind?: string; min_days?: number };
type Shift = { id: number; name: string };
type Employee = {
  id: number;
  name: string;
  nic: string;
  phone: string;
  position: string;
  base_salary: string;
  overtime_hourly_rate?: string;
  fingerprint_id: string;
  active: boolean;
  epf_enabled?: boolean;
  paid_leave_days_per_year?: number | null;
  default_shift_id?: number | null;
  default_shift?: Shift | null;
  allowances?: Allowance[] | null;
};

type Mode = "add" | "edit" | "view" | null;

export default function EmployeesPage() {
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [shifts, setShifts] = useState<Shift[]>([]);
  const [showInactive, setShowInactive] = useState(false);
  const [mode, setMode] = useState<Mode>(null);
  const [selected, setSelected] = useState<Employee | null>(null);
  const [error, setError] = useState("");

  function load() {
    api<{ data: Employee[] }>(`/employees?per_page=100${showInactive ? "" : "&active_only=1"}`)
      .then((result) => setEmployees(result.data))
      .catch((caught) => setError(caught.message));
  }

  useEffect(() => { load(); }, [showInactive]);

  useEffect(() => {
    api<Shift[]>("/work-shifts").then(setShifts).catch(() => setShifts([]));
  }, []);

  function openAdd() {
    setSelected(null);
    setMode("add");
    setError("");
  }

  function openView(employee: Employee) {
    setSelected(employee);
    setMode("view");
    setError("");
  }

  function openEdit(employee: Employee) {
    setSelected(employee);
    setMode("edit");
    setError("");
  }

  async function save(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = event.currentTarget;
    const data = Object.fromEntries(new FormData(form));
    const allowanceName = String(data.allowance_name || "").trim();
    const payload = {
      name: data.name,
      nic: data.nic,
      phone: data.phone,
      position: data.position,
      base_salary: data.base_salary,
      overtime_hourly_rate: data.overtime_hourly_rate || 0,
      fingerprint_id: data.fingerprint_id,
      epf_enabled: data.epf_enabled === "1",
      paid_leave_days_per_year: data.paid_leave_days_per_year ? Number(data.paid_leave_days_per_year) : null,
      default_shift_id: data.default_shift_id ? Number(data.default_shift_id) : null,
      allowances: allowanceName
        ? [{ name: allowanceName, amount: Number(data.allowance_amount || 0), kind: data.allowance_kind || "fixed", min_days: Number(data.allowance_min_days || 0) }]
        : [],
    };
    try {
      if (mode === "edit" && selected) {
        await api(`/employees/${selected.id}`, { method: "PUT", body: JSON.stringify(payload) });
      } else {
        await api("/employees", { method: "POST", body: JSON.stringify(payload) });
      }
      form.reset();
      setMode(null);
      setSelected(null);
      load();
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Could not save employee.");
    }
  }

  async function deactivate(employee: Employee) {
    if (!window.confirm(`Deactivate ${employee.name}? They will drop off payroll until reactivated.`)) return;
    try {
      await api(`/employees/${employee.id}`, { method: "DELETE" });
      setMode(null);
      setSelected(null);
      load();
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Could not deactivate employee.");
    }
  }

  async function reactivate(employee: Employee) {
    try {
      await api(`/employees/${employee.id}/activate`, { method: "POST" });
      setMode(null);
      setSelected(null);
      load();
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Could not reactivate employee.");
    }
  }

  const firstAllowance = selected?.allowances?.[0];

  return (
    <AppShell
      title="Team"
      eyebrow={`${employees.length} ${showInactive ? "" : "active "}employees`}
      action={
        <div className="flex gap-2">
          <button type="button" onClick={() => setShowInactive((value) => !value)} className="flex h-10 items-center border border-[#20221f] bg-white px-3 text-xs font-bold uppercase">
            {showInactive ? "Active only" : "Show inactive"}
          </button>
          <button onClick={openAdd} className="flex h-10 items-center gap-2 bg-[#f5c842] px-3 text-sm font-semibold">
            <Plus size={18} /><span className="hidden sm:inline">Add employee</span>
          </button>
        </div>
      }
    >
      {error && <div className="mb-5"><ErrorMessage message={error} /></div>}

      {employees.length === 0 && !error ? (
        <PageState message="No employees have been added." />
      ) : (
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {employees.map((employee) => (
            <Panel key={employee.id} className="p-5">
              <button type="button" onClick={() => openView(employee)} className="w-full text-left">
                <div className="flex items-start justify-between">
                  <span className="grid size-12 place-items-center bg-[#242723] font-display text-xl text-white">
                    {employee.name.split(" ").map((part) => part[0]).slice(0, 2).join("")}
                  </span>
                  <span className={`flex items-center gap-1 px-2 py-1 text-[10px] font-bold ${employee.active ? "bg-[#167c73]/10 text-[#167c73]" : "bg-[#b84837]/10 text-[#b84837]"}`}>
                    <Fingerprint size={13} />{employee.fingerprint_id}
                  </span>
                </div>
                <h2 className="mt-5 font-display text-2xl font-semibold uppercase">{employee.name}</h2>
                <p className="text-sm text-[#167c73]">{employee.position}{employee.epf_enabled ? " · EPF" : ""}</p>
                <div className="mt-5 grid grid-cols-2 gap-3 border-t border-[#d7d3c8] pt-4 text-xs">
                  <div><p className="text-[#6f746e]">NIC</p><strong>{employee.nic}</strong></div>
                  <div><p className="text-[#6f746e]">Phone</p><strong>{employee.phone}</strong></div>
                  <div className="col-span-2"><p className="text-[#6f746e]">Base salary</p><strong>{money(employee.base_salary)}</strong></div>
                </div>
              </button>
              <div className="mt-4 flex gap-2 border-t border-[#d7d3c8] pt-4">
                <button type="button" onClick={() => openView(employee)} className="flex flex-1 items-center justify-center gap-2 py-2 text-xs font-bold uppercase hover:bg-[#eeece5]">
                  <Eye size={14} /> View
                </button>
                <button type="button" onClick={() => openEdit(employee)} className="flex flex-1 items-center justify-center gap-2 py-2 text-xs font-bold uppercase text-[#167c73] hover:bg-[#eeece5]">
                  <Pencil size={14} /> Edit
                </button>
              </div>
            </Panel>
          ))}
        </div>
      )}

      {mode === "view" && selected && (
        <div className="fixed inset-0 z-50 grid place-items-center overflow-y-auto bg-black/55 p-4">
          <div className="my-8 w-full max-w-xl bg-[#f3f0e8]">
            <div className="flex items-center justify-between border-b border-[#d7d3c8] p-5">
              <h2 className="font-display text-3xl font-semibold uppercase">Employee details</h2>
              <button type="button" onClick={() => setMode(null)} aria-label="Close"><X /></button>
            </div>
            <div className="grid gap-4 p-5 sm:grid-cols-2 text-sm">
              {[
                ["Full name", selected.name],
                ["Position", selected.position],
                ["NIC", selected.nic],
                ["Phone", selected.phone],
                ["Base salary", money(selected.base_salary)],
                ["OT hourly rate", selected.overtime_hourly_rate ? money(selected.overtime_hourly_rate) : "—"],
                ["Fingerprint ID", selected.fingerprint_id],
                ["Status", selected.active ? "Active" : "Inactive"],
                ["EPF / ETF", selected.epf_enabled ? "On" : "Off"],
                ["Paid leave / year", selected.paid_leave_days_per_year != null ? String(selected.paid_leave_days_per_year) : "Not set"],
                ["Default shift", selected.default_shift?.name ?? "None"],
                ["Allowance", firstAllowance ? `${firstAllowance.name} ${money(firstAllowance.amount)}` : "None"],
              ].map(([label, value]) => (
                <div key={label}>
                  <p className="text-[10px] font-bold uppercase text-[#6f746e]">{label}</p>
                  <p className="mt-1 font-semibold">{value}</p>
                </div>
              ))}
            </div>
            <div className="flex justify-end gap-2 border-t border-[#d7d3c8] p-5">
              {selected.active ? (
                <button type="button" onClick={() => deactivate(selected)} className="flex h-11 items-center gap-2 border border-[#b84837] bg-white px-4 text-sm font-semibold text-[#b84837]">
                  <Power size={16} /> Deactivate
                </button>
              ) : (
                <button type="button" onClick={() => reactivate(selected)} className="flex h-11 items-center gap-2 border border-[#167c73] bg-white px-4 text-sm font-semibold text-[#167c73]">
                  <Power size={16} /> Reactivate
                </button>
              )}
              <button type="button" onClick={() => openEdit(selected)} className={buttonClass}>
                <Pencil size={16} /> Edit employee
              </button>
            </div>
          </div>
        </div>
      )}

      {(mode === "add" || mode === "edit") && (
        <div className="fixed inset-0 z-50 grid place-items-center overflow-y-auto bg-black/55 p-4">
          <form onSubmit={save} className="my-8 w-full max-w-xl bg-[#f3f0e8]">
            <div className="flex items-center justify-between border-b border-[#d7d3c8] p-5">
              <h2 className="font-display text-3xl font-semibold uppercase">{mode === "edit" ? "Edit employee" : "Add employee"}</h2>
              <button type="button" onClick={() => setMode(null)} aria-label="Close"><X /></button>
            </div>
            <div className="grid gap-4 p-5 sm:grid-cols-2">
              {[
                ["name", "Full name", selected?.name ?? ""],
                ["nic", "NIC", selected?.nic ?? ""],
                ["phone", "Phone", selected?.phone ?? ""],
                ["position", "Position", selected?.position ?? ""],
                ["base_salary", "Base salary", selected?.base_salary ?? ""],
                ["overtime_hourly_rate", "OT hourly rate", selected?.overtime_hourly_rate ?? ""],
                ["fingerprint_id", "Fingerprint ID", selected?.fingerprint_id ?? ""],
              ].map(([name, label, value]) => (
                <label key={name} className={`text-xs font-bold uppercase ${name === "fingerprint_id" ? "sm:col-span-2" : ""}`}>
                  {label}
                  <input
                    name={name}
                    defaultValue={value}
                    required={name !== "overtime_hourly_rate"}
                    type={name.includes("salary") || name.includes("rate") ? "number" : "text"}
                    step="0.01"
                    className={`${inputClass} mt-2`}
                  />
                </label>
              ))}
              <label className="text-xs font-bold uppercase">
                Paid leave days / year
                <input name="paid_leave_days_per_year" type="number" min="0" defaultValue={selected?.paid_leave_days_per_year ?? ""} className={`${inputClass} mt-2`} />
              </label>
              <label className="text-xs font-bold uppercase">
                Default shift
                <select name="default_shift_id" defaultValue={selected?.default_shift_id ?? ""} className={`${inputClass} mt-2`}>
                  <option value="">None (OT = hours − 8)</option>
                  {shifts.map((shift) => <option key={shift.id} value={shift.id}>{shift.name}</option>)}
                </select>
              </label>
              <label className="flex items-center gap-2 text-xs font-bold uppercase sm:col-span-2">
                <input name="epf_enabled" type="checkbox" value="1" defaultChecked={Boolean(selected?.epf_enabled)} />
                Enable EPF 8% / 12% and ETF 3%
              </label>
              <label className="text-xs font-bold uppercase">
                Allowance name
                <input name="allowance_name" defaultValue={firstAllowance?.name ?? ""} className={`${inputClass} mt-2`} />
              </label>
              <label className="text-xs font-bold uppercase">
                Allowance amount
                <input name="allowance_amount" type="number" min="0" step="0.01" defaultValue={firstAllowance?.amount ?? ""} className={`${inputClass} mt-2`} />
              </label>
              <label className="text-xs font-bold uppercase">
                Allowance type
                <select name="allowance_kind" defaultValue={firstAllowance?.kind ?? "fixed"} className={`${inputClass} mt-2`}>
                  <option value="fixed">Fixed monthly</option>
                  <option value="attendance">If attendance met</option>
                </select>
              </label>
              <label className="text-xs font-bold uppercase">
                Min days (attendance)
                <input name="allowance_min_days" type="number" min="0" defaultValue={firstAllowance?.min_days ?? ""} className={`${inputClass} mt-2`} />
              </label>
            </div>
            <div className="flex justify-end border-t border-[#d7d3c8] p-5">
              <button className={buttonClass}>{mode === "edit" ? "Save changes" : "Save employee"}</button>
            </div>
          </form>
        </div>
      )}
    </AppShell>
  );
}
