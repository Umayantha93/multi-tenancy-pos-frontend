"use client";

import { FormEvent, useEffect, useState } from "react";
import { Eye, Fingerprint, Pencil, Plus, X } from "lucide-react";
import { AppShell } from "@/components/app-shell";
import { buttonClass, ErrorMessage, inputClass, PageState, Panel } from "@/components/ui";
import { api, money } from "@/lib/api";

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
};

type Mode = "add" | "edit" | "view" | null;

export default function EmployeesPage() {
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [mode, setMode] = useState<Mode>(null);
  const [selected, setSelected] = useState<Employee | null>(null);
  const [error, setError] = useState("");

  function load() {
    api<{ data: Employee[] }>("/employees?active_only=1")
      .then((result) => setEmployees(result.data))
      .catch((caught) => setError(caught.message));
  }

  useEffect(() => { load(); }, []);

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
    const payload = Object.fromEntries(new FormData(form));
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

  return (
    <AppShell
      title="Team"
      eyebrow={`${employees.length} active employees`}
      action={
        <button onClick={openAdd} className="flex h-10 items-center gap-2 bg-[#f5c842] px-3 text-sm font-semibold">
          <Plus size={18} /><span className="hidden sm:inline">Add employee</span>
        </button>
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
                  <span className="flex items-center gap-1 bg-[#167c73]/10 px-2 py-1 text-[10px] font-bold text-[#167c73]">
                    <Fingerprint size={13} />{employee.fingerprint_id}
                  </span>
                </div>
                <h2 className="mt-5 font-display text-2xl font-semibold uppercase">{employee.name}</h2>
                <p className="text-sm text-[#167c73]">{employee.position}</p>
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
              ].map(([label, value]) => (
                <div key={label}>
                  <p className="text-[10px] font-bold uppercase text-[#6f746e]">{label}</p>
                  <p className="mt-1 font-semibold">{value}</p>
                </div>
              ))}
            </div>
            <div className="flex justify-end gap-2 border-t border-[#d7d3c8] p-5">
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
