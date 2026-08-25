"use client";

import { FormEvent, useEffect, useState } from "react";
import { Plus, Trash2 } from "lucide-react";
import { AppShell } from "@/components/app-shell";
import { buttonClass, ErrorMessage, PageState, Panel, inputClass } from "@/components/ui";
import { api, currentFeatures, currentUser } from "@/lib/api";

type Employee = { id: number; name: string; paid_leave_days_per_year?: number | null };
type Leave = {
  id: number;
  start_date: string;
  end_date: string;
  type: string;
  days: number;
  status?: string;
  notes?: string | null;
  employee: Employee;
};

export default function LeavePage() {
  const now = new Date();
  const [year, setYear] = useState(now.getFullYear());
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [leaves, setLeaves] = useState<Leave[]>([]);
  const [error, setError] = useState("");
  const [isOwner, setIsOwner] = useState(false);
  const [selfOnly, setSelfOnly] = useState(false);

  function load() {
    const owner = currentUser()?.role === "business_owner";
    const manage = owner || currentFeatures().includes("employees_management");
    setIsOwner(owner);
    setSelfOnly(!manage);
    if (manage) {
      Promise.all([
        api<{ data: Employee[] }>("/employees?per_page=100"),
        api<{ data: Leave[] }>(`/employee-leaves?year=${year}`),
      ]).then(([employeePage, leavePage]) => {
        setEmployees(employeePage.data);
        setLeaves(leavePage.data);
      }).catch((caught) => setError(caught.message));
      return;
    }
    api<{ data: Leave[]; employee?: Employee }>(`/me/leaves?year=${year}`)
      .then((result) => {
        setLeaves(result.data);
        setEmployees(result.employee ? [result.employee] : []);
      })
      .catch((caught) => setError(caught.message));
  }

  useEffect(load, [year]);

  async function create(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = event.currentTarget;
    const data = Object.fromEntries(new FormData(form));
    try {
      if (selfOnly) {
        await api("/me/leaves", {
          method: "POST",
          body: JSON.stringify({
            start_date: data.start_date,
            end_date: data.end_date,
            type: data.type,
            notes: data.notes || null,
          }),
        });
      } else {
        await api("/employee-leaves", {
          method: "POST",
          body: JSON.stringify({
            employee_id: Number(data.employee_id),
            start_date: data.start_date,
            end_date: data.end_date,
            type: data.type,
            notes: data.notes || null,
          }),
        });
      }
      form.reset();
      load();
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Unable to record leave.");
    }
  }

  async function review(id: number, action: "approve" | "reject") {
    try {
      await api(`/employee-leaves/${id}/${action}`, { method: "POST" });
      load();
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Unable to update leave.");
    }
  }

  async function remove(id: number) {
    try {
      await api(`/employee-leaves/${id}`, { method: "DELETE" });
      load();
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Unable to delete leave.");
    }
  }

  return (
    <AppShell title="Leave" eyebrow={selfOnly ? "Apply for leave. The owner will approve or reject." : "Record leave, or approve staff requests. Unpaid days can reduce payroll."}>
      {error && <div className="mb-5"><ErrorMessage message={error} /></div>}
      <div className="grid gap-5 xl:grid-cols-[0.9fr_1.1fr]">
        <Panel className="p-5">
          <h2 className="font-display text-2xl font-semibold uppercase">{selfOnly ? "Apply for leave" : "Record leave"}</h2>
          <form onSubmit={create} className="mt-4 grid gap-3">
            {!selfOnly && (
              <select name="employee_id" required className={inputClass}>
                <option value="">Employee</option>
                {employees.map((employee) => (
                  <option key={employee.id} value={employee.id}>
                    {employee.name}{employee.paid_leave_days_per_year != null ? ` · ${employee.paid_leave_days_per_year} paid days/year` : ""}
                  </option>
                ))}
              </select>
            )}
            <input name="start_date" required type="date" className={inputClass} />
            <input name="end_date" required type="date" className={inputClass} />
            <select name="type" required className={inputClass}>
              <option value="paid">Paid</option>
              <option value="unpaid">Unpaid</option>
              <option value="medical">Medical</option>
            </select>
            <input name="notes" placeholder="Notes" className={inputClass} />
            <button className={buttonClass}><Plus size={16} /> {selfOnly ? "Send request" : "Save leave"}</button>
          </form>
        </Panel>
        <Panel>
          <div className="flex items-center justify-between border-b border-[#d7d3c8] px-5 py-4">
            <h2 className="font-display text-2xl font-semibold uppercase">This year</h2>
            <input value={year} onChange={(event) => setYear(Number(event.target.value))} type="number" className={`${inputClass} w-28`} />
          </div>
          {leaves.length === 0 ? <PageState message="No leave recorded." /> : (
            <div className="overflow-x-auto">
              <table className="w-full min-w-[640px] text-left text-sm">
                <thead className="bg-[#eeece5] text-[10px] uppercase text-[#6f746e]">
                  <tr><th className="px-5 py-3">Employee</th><th>Dates</th><th>Type</th><th>Days</th><th>Status</th><th /></tr>
                </thead>
                <tbody>
                  {leaves.map((row) => (
                    <tr key={row.id} className="border-t border-[#e2ded4]">
                      <td className="px-5 py-3 font-semibold">{row.employee.name}</td>
                      <td>{row.start_date} → {row.end_date}</td>
                      <td className="uppercase">{row.type}</td>
                      <td>{row.days}</td>
                      <td className="uppercase">{row.status ?? "approved"}</td>
                      <td className="pr-4 text-right">
                        {isOwner && row.status === "pending" && (
                          <>
                            <button type="button" onClick={() => review(row.id, "approve")} className="mr-2 text-xs font-bold uppercase text-[#167c73]">Approve</button>
                            <button type="button" onClick={() => review(row.id, "reject")} className="mr-2 text-xs font-bold uppercase text-[#b84837]">Reject</button>
                          </>
                        )}
                        {isOwner && (
                          <button type="button" onClick={() => remove(row.id)} className="text-[#b84837]" aria-label="Delete"><Trash2 size={16} /></button>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </Panel>
      </div>
    </AppShell>
  );
}
