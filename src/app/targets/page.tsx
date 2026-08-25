"use client";

import { FormEvent, useEffect, useState } from "react";
import { Plus, Trash2 } from "lucide-react";
import { AppShell } from "@/components/app-shell";
import { buttonClass, ErrorMessage, PageState, Panel, inputClass } from "@/components/ui";
import { api, money } from "@/lib/api";

type Employee = { id: number; name: string; position: string };
type ProgressLog = { id: number; work_date: string; amount: string; employee?: Employee | null };
type Target = {
  id: number;
  scope: "employee" | "team";
  starts_on: string;
  ends_on: string;
  kind: string;
  amount: string;
  progress_amount: string;
  incentive_amount: string;
  employee?: Employee | null;
  progress_logs?: ProgressLog[];
};

export default function TargetsPage() {
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [targets, setTargets] = useState<Target[]>([]);
  const [error, setError] = useState("");
  const [scope, setScope] = useState<"employee" | "team">("employee");
  const [progressTarget, setProgressTarget] = useState<Target | null>(null);

  function load() {
    Promise.all([
      api<{ data: Employee[] }>("/employees?active_only=1&per_page=100"),
      api<Target[]>("/employee-targets"),
    ]).then(([employeePage, rows]) => {
      setEmployees(employeePage.data);
      setTargets(Array.isArray(rows) ? rows : []);
    }).catch((caught) => setError(caught.message));
  }

  useEffect(load, []);

  async function create(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = event.currentTarget;
    const data = Object.fromEntries(new FormData(form));
    try {
      await api("/employee-targets", {
        method: "POST",
        body: JSON.stringify({
          scope,
          employee_id: scope === "employee" ? Number(data.employee_id) : null,
          starts_on: data.starts_on,
          ends_on: data.ends_on,
          kind: data.kind,
          amount: Number(data.amount),
          incentive_amount: Number(data.incentive_amount || 0),
        }),
      });
      form.reset();
      load();
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Unable to save target.");
    }
  }

  async function logProgress(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!progressTarget) return;
    const form = event.currentTarget;
    const data = Object.fromEntries(new FormData(form));
    try {
      await api(`/employee-targets/${progressTarget.id}/progress`, {
        method: "POST",
        body: JSON.stringify({
          employee_id: Number(data.employee_id),
          work_date: data.work_date,
          amount: Number(data.amount),
          notes: data.notes || null,
        }),
      });
      form.reset();
      setProgressTarget(null);
      load();
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Unable to save daily progress.");
    }
  }

  async function remove(id: number) {
    try {
      await api(`/employee-targets/${id}`, { method: "DELETE" });
      load();
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Unable to delete target.");
    }
  }

  return (
    <AppShell title="Targets" eyebrow="Team or one person. Log each day’s pieces/sales — payroll incentive pays when the target is met.">
      {error && <div className="mb-5"><ErrorMessage message={error} /></div>}
      <div className="grid gap-5 xl:grid-cols-[0.9fr_1.1fr]">
        <Panel className="p-5">
          <h2 className="font-display text-2xl font-semibold uppercase">Set target</h2>
          <form onSubmit={create} className="mt-4 grid gap-3">
            <select value={scope} onChange={(event) => setScope(event.target.value as "employee" | "team")} className={inputClass}>
              <option value="employee">One employee</option>
              <option value="team">Whole team</option>
            </select>
            {scope === "employee" && (
              <select name="employee_id" required className={inputClass}>
                <option value="">Employee</option>
                {employees.map((employee) => <option key={employee.id} value={employee.id}>{employee.name}</option>)}
              </select>
            )}
            <input name="starts_on" required type="date" className={inputClass} />
            <input name="ends_on" required type="date" className={inputClass} />
            <select name="kind" className={inputClass}>
              <option value="sales">Sales</option>
              <option value="pieces">Pieces</option>
            </select>
            <input name="amount" required type="number" min="0.01" step="0.01" placeholder="Target amount" className={inputClass} />
            <input name="incentive_amount" type="number" min="0" step="0.01" placeholder="Incentive if met (per person)" className={inputClass} />
            <button className={buttonClass}><Plus size={16} /> Save target</button>
          </form>
        </Panel>
        <Panel>
          {targets.length === 0 ? <PageState message="No targets yet." /> : (
            <div className="overflow-x-auto">
              <table className="w-full min-w-[720px] text-left text-sm">
                <thead className="bg-[#eeece5] text-[10px] uppercase text-[#6f746e]">
                  <tr><th className="px-5 py-3">Who</th><th>Dates</th><th>Target</th><th>Progress</th><th>Incentive</th><th /></tr>
                </thead>
                <tbody>
                  {targets.map((row) => (
                    <tr key={row.id} className="border-t border-[#e2ded4]">
                      <td className="px-5 py-3 font-semibold">{row.scope === "team" ? "Whole team" : (row.employee?.name ?? "—")}</td>
                      <td>{row.starts_on} → {row.ends_on}</td>
                      <td>{row.kind === "pieces" ? row.amount : money(row.amount)}</td>
                      <td>{row.kind === "pieces" ? row.progress_amount : money(row.progress_amount)}</td>
                      <td>{money(row.incentive_amount)}</td>
                      <td className="pr-4 text-right">
                        <button type="button" onClick={() => setProgressTarget(row)} className="mr-3 text-xs font-bold uppercase text-[#167c73]">Log day</button>
                        <button type="button" onClick={() => remove(row.id)} className="text-[#b84837]" aria-label="Delete"><Trash2 size={16} /></button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </Panel>
      </div>

      {progressTarget && (
        <div className="fixed inset-0 z-50 grid place-items-center bg-black/55 p-4">
          <form onSubmit={logProgress} className="w-full max-w-md bg-[#f3f0e8] p-5">
            <h2 className="font-display text-2xl font-semibold uppercase">Daily progress</h2>
            <p className="mt-1 text-sm text-[#6f746e]">
              {progressTarget.scope === "team" ? "Whole team" : progressTarget.employee?.name} · so far {progressTarget.progress_amount} / {progressTarget.amount}
            </p>
            <div className="mt-4 grid gap-3">
              <select name="employee_id" required className={inputClass} defaultValue={progressTarget.employee?.id ?? ""}>
                <option value="">Employee</option>
                {(progressTarget.scope === "team" ? employees : employees.filter((row) => row.id === progressTarget.employee?.id)).map((employee) => (
                  <option key={employee.id} value={employee.id}>{employee.name}</option>
                ))}
              </select>
              <input name="work_date" required type="date" defaultValue={new Date().toISOString().slice(0, 10)} className={inputClass} />
              <input name="amount" required type="number" min="0" step="0.01" placeholder="Today’s amount" className={inputClass} />
              <input name="notes" placeholder="Notes" className={inputClass} />
            </div>
            <div className="mt-5 flex justify-end gap-2">
              <button type="button" onClick={() => setProgressTarget(null)} className="h-11 border border-[#d7d3c8] px-4 text-sm">Cancel</button>
              <button className={buttonClass}>Save day</button>
            </div>
          </form>
        </div>
      )}
    </AppShell>
  );
}
