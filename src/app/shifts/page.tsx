"use client";

import { FormEvent, useEffect, useState } from "react";
import { Plus, Trash2 } from "lucide-react";
import { AppShell } from "@/components/app-shell";
import { buttonClass, ErrorMessage, PageState, Panel, inputClass } from "@/components/ui";
import { api, currentFeatures, currentUser } from "@/lib/api";

type Shift = { id: number; name: string; start_time: string; end_time: string; paid_hours?: string | null };
type Employee = { id: number; name: string; position: string };
type Assignment = { id: number; starts_on: string; ends_on?: string | null; employee: Employee; shift: Shift };

function timeValue(value?: string | null) {
  return (value ?? "").slice(0, 5);
}

export default function ShiftsPage() {
  const [shifts, setShifts] = useState<Shift[]>([]);
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [assignments, setAssignments] = useState<Assignment[]>([]);
  const [error, setError] = useState("");
  const [selfOnly, setSelfOnly] = useState(false);

  function load() {
    const staffSelf = currentUser()?.role === "staff" && !currentFeatures().includes("employees_management");
    setSelfOnly(staffSelf);
    if (staffSelf) {
      api<{ assignments: Assignment[]; employee?: { name: string; default_shift?: Shift | null } }>("/me/shifts")
        .then((result) => {
          setAssignments(result.assignments);
          setShifts([]);
          setEmployees([]);
        })
        .catch((caught) => setError(caught.message));
      return;
    }
    Promise.all([
      api<Shift[]>("/work-shifts"),
      api<{ data: Employee[] }>("/employees?active_only=1&per_page=100"),
      api<Assignment[]>("/shift-assignments"),
    ]).then(([shiftRows, employeePage, assignmentRows]) => {
      setShifts(shiftRows);
      setEmployees(employeePage.data);
      setAssignments(assignmentRows);
    }).catch((caught) => setError(caught.message));
  }

  useEffect(load, []);

  async function saveShift(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = event.currentTarget;
    const data = Object.fromEntries(new FormData(form));
    try {
      await api("/work-shifts", {
        method: "POST",
        body: JSON.stringify({
          name: data.name,
          start_time: data.start_time,
          end_time: data.end_time,
          paid_hours: data.paid_hours || null,
        }),
      });
      form.reset();
      load();
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Unable to save shift.");
    }
  }

  async function assign(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = event.currentTarget;
    const data = Object.fromEntries(new FormData(form));
    setError("");
    try {
      await api("/shift-assignments", {
        method: "POST",
        body: JSON.stringify({
          employee_id: Number(data.employee_id),
          work_shift_id: Number(data.work_shift_id),
          starts_on: data.starts_on,
          ends_on: data.ends_on || null,
        }),
      });
      form.reset();
      load();
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Unable to assign shift.");
    }
  }

  async function removeShift(id: number) {
    try {
      await api(`/work-shifts/${id}`, { method: "DELETE" });
      load();
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Unable to delete shift.");
    }
  }

  async function removeAssignment(id: number) {
    try {
      await api(`/shift-assignments/${id}`, { method: "DELETE" });
      load();
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Unable to remove assignment.");
    }
  }

  return (
    <AppShell title="Shifts" eyebrow={selfOnly ? "Your assigned shifts." : "OT uses the assigned shift. No shift still means hours minus 8."}>
      {error && <div className="mb-5"><ErrorMessage message={error} /></div>}
      {selfOnly ? (
        <Panel className="p-5">
          <h2 className="font-display text-2xl font-semibold uppercase">My shifts</h2>
          <div className="mt-4 space-y-2">
            {assignments.map((row) => (
              <div key={row.id} className="border border-[#d7d3c8] bg-white px-3 py-3 text-sm">
                <p className="font-semibold">{row.shift.name}</p>
                <p className="text-xs text-[#6f746e]">{timeValue(row.shift.start_time)} – {timeValue(row.shift.end_time)} · {row.starts_on}{row.ends_on ? ` → ${row.ends_on}` : " onward"}</p>
              </div>
            ))}
            {assignments.length === 0 && <PageState message="No shift assigned yet." />}
          </div>
        </Panel>
      ) : (
      <div className="grid gap-5 xl:grid-cols-2">
        <Panel className="p-5">
          <h2 className="font-display text-2xl font-semibold uppercase">Add shift</h2>
          <form onSubmit={saveShift} className="mt-4 grid gap-3 sm:grid-cols-2">
            <input name="name" required placeholder="Name" className={`sm:col-span-2 ${inputClass}`} />
            <input name="start_time" required type="time" className={inputClass} />
            <input name="end_time" required type="time" className={inputClass} />
            <input name="paid_hours" type="number" min="0" step="0.25" placeholder="Paid hours (optional)" className={`sm:col-span-2 ${inputClass}`} />
            <button className={`${buttonClass} sm:col-span-2`}><Plus size={16} /> Save shift</button>
          </form>
          <div className="mt-6 space-y-2">
            {shifts.map((shift) => (
              <div key={shift.id} className="flex items-center justify-between border border-[#d7d3c8] bg-white px-3 py-2 text-sm">
                <div>
                  <p className="font-semibold">{shift.name}</p>
                  <p className="text-xs text-[#6f746e]">{timeValue(shift.start_time)} – {timeValue(shift.end_time)}</p>
                </div>
                <button type="button" onClick={() => removeShift(shift.id)} className="text-[#b84837]" aria-label="Delete"><Trash2 size={16} /></button>
              </div>
            ))}
            {shifts.length === 0 && <PageState message="No shifts yet." />}
          </div>
        </Panel>
        <Panel className="p-5">
          <h2 className="font-display text-2xl font-semibold uppercase">Assign shift</h2>
          <form onSubmit={assign} className="mt-4 grid gap-3">
            <select name="employee_id" required className={inputClass}>
              <option value="">Employee</option>
              {employees.map((employee) => <option key={employee.id} value={employee.id}>{employee.name}</option>)}
            </select>
            <select name="work_shift_id" required className={inputClass}>
              <option value="">Shift</option>
              {shifts.map((shift) => <option key={shift.id} value={shift.id}>{shift.name}</option>)}
            </select>
            <input name="starts_on" required type="date" className={inputClass} />
            <input name="ends_on" type="date" className={inputClass} />
            <button className={buttonClass}><Plus size={16} /> Assign</button>
          </form>
          <div className="mt-6 space-y-2">
            {assignments.map((row) => (
              <div key={row.id} className="flex items-center justify-between border border-[#d7d3c8] bg-white px-3 py-2 text-sm">
                <div>
                  <p className="font-semibold">{row.employee.name} · {row.shift.name}</p>
                  <p className="text-xs text-[#6f746e]">{row.starts_on}{row.ends_on ? ` → ${row.ends_on}` : " onward"}</p>
                </div>
                <button type="button" onClick={() => removeAssignment(row.id)} className="text-[#b84837]" aria-label="Delete"><Trash2 size={16} /></button>
              </div>
            ))}
          </div>
        </Panel>
      </div>
      )}
    </AppShell>
  );
}
