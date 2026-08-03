"use client";

import { FormEvent, useCallback, useEffect, useState } from "react";
import { Fingerprint, Plus } from "lucide-react";
import { AppShell } from "@/components/app-shell";
import { buttonClass, ErrorMessage, inputClass, PageState, Panel } from "@/components/ui";
import { api } from "@/lib/api";

type Employee = { id: number; name: string; position: string; fingerprint_id: string; active: boolean };
type Attendance = {
  id: number;
  date: string;
  check_in: string;
  check_out: string | null;
  hours_worked: string;
  overtime_hours: string;
  source: string;
  employee: { id: number; name: string; position: string; fingerprint_id: string };
};

function formatTime(value: string | null) {
  if (!value) return "—";
  return new Date(value).toLocaleTimeString("en-LK", { hour: "2-digit", minute: "2-digit" });
}

export default function AttendancePage() {
  const now = new Date();
  const [month, setMonth] = useState(now.getMonth() + 1);
  const [year, setYear] = useState(now.getFullYear());
  const [employeeId, setEmployeeId] = useState("");
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [rows, setRows] = useState<Attendance[]>([]);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);
  const [fingerprintId, setFingerprintId] = useState("");
  const [punching, setPunching] = useState(false);

  const load = useCallback(() => {
    setLoading(true);
    const params = new URLSearchParams({ month: String(month), year: String(year), per_page: "100" });
    if (employeeId) params.set("employee_id", employeeId);
    api<{ data: Attendance[] }>(`/attendance?${params}`)
      .then((result) => setRows(result.data))
      .catch((caught) => setError(caught.message))
      .finally(() => setLoading(false));
  }, [employeeId, month, year]);

  useEffect(() => {
    api<{ data: Employee[] }>("/employees?active_only=1&per_page=100")
      .then((result) => setEmployees(result.data))
      .catch(() => undefined);
  }, []);

  useEffect(() => { load(); }, [load]);

  async function punchFingerprint(event: FormEvent) {
    event.preventDefault();
    setPunching(true);
    setError("");
    try {
      await api("/attendance/punch", {
        method: "POST",
        body: JSON.stringify({ fingerprint_id: fingerprintId.trim() }),
      });
      setFingerprintId("");
      load();
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Fingerprint punch failed.");
    } finally {
      setPunching(false);
    }
  }

  async function markManual(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");
    const form = event.currentTarget;
    const data = Object.fromEntries(new FormData(form));
    try {
      await api("/attendance", {
        method: "POST",
        body: JSON.stringify({
          employee_id: Number(data.employee_id),
          check_in: data.check_in,
          check_out: data.check_out || null,
          source: "manual",
        }),
      });
      form.reset();
      load();
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Could not save attendance.");
    }
  }

  const todayStamp = `${now.toISOString().slice(0, 10)}T${String(now.getHours()).padStart(2, "0")}:${String(now.getMinutes()).padStart(2, "0")}`;

  return (
    <AppShell title="Attendance" eyebrow="Fingerprint & manual check-in">
      <div className="mb-5 grid gap-5 xl:grid-cols-2">
        <Panel>
          <div className="border-b border-[#d7d3c8] p-5">
            <div className="flex items-center gap-2 text-[#167c73]">
              <Fingerprint size={18} />
              <h2 className="font-display text-2xl font-semibold uppercase">Fingerprint punch</h2>
            </div>
            <p className="mt-2 text-sm text-[#6f746e]">
              Scan or type the employee fingerprint ID. First punch checks in; next punch checks out for today.
              Hardware devices can also post to <code className="text-xs">/api/attendance/ingest</code>.
            </p>
          </div>
          <form onSubmit={punchFingerprint} className="space-y-4 p-5">
            <label className="block text-xs font-bold uppercase">
              Fingerprint ID
              <input
                value={fingerprintId}
                onChange={(event) => setFingerprintId(event.target.value)}
                required
                list="fingerprint-options"
                className={`${inputClass} mt-2`}
                placeholder="e.g. FP-001-01"
              />
              <datalist id="fingerprint-options">
                {employees.map((employee) => (
                  <option key={employee.id} value={employee.fingerprint_id}>{employee.name}</option>
                ))}
              </datalist>
            </label>
            <button disabled={punching} className={`${buttonClass} w-full`}>
              <Fingerprint size={17} />{punching ? "Recording..." : "Record fingerprint punch"}
            </button>
          </form>
        </Panel>

        <Panel>
          <div className="border-b border-[#d7d3c8] p-5">
            <div className="flex items-center gap-2">
              <Plus size={18} className="text-[#167c73]" />
              <h2 className="font-display text-2xl font-semibold uppercase">Manual attendance</h2>
            </div>
            <p className="mt-2 text-sm text-[#6f746e]">Use when the fingerprint device is unavailable.</p>
          </div>
          <form onSubmit={markManual} className="grid gap-4 p-5 sm:grid-cols-2">
            <label className="block text-xs font-bold uppercase sm:col-span-2">
              Employee
              <select name="employee_id" required className={`${inputClass} mt-2`}>
                <option value="">Select employee</option>
                {employees.map((employee) => (
                  <option key={employee.id} value={employee.id}>
                    {employee.name} · {employee.fingerprint_id}
                  </option>
                ))}
              </select>
            </label>
            <label className="block text-xs font-bold uppercase">
              Check in
              <input name="check_in" type="datetime-local" required defaultValue={todayStamp} className={`${inputClass} mt-2`} />
            </label>
            <label className="block text-xs font-bold uppercase">
              Check out
              <input name="check_out" type="datetime-local" className={`${inputClass} mt-2`} />
            </label>
            <button className={`${buttonClass} sm:col-span-2`}>Save attendance</button>
          </form>
        </Panel>
      </div>

      <div className="mb-5 flex flex-wrap items-end gap-3">
        <label className="text-xs font-bold uppercase">
          Month
          <select value={month} onChange={(event) => setMonth(Number(event.target.value))} className={`${inputClass} mt-2 w-40`}>
            {Array.from({ length: 12 }, (_, index) => (
              <option key={index + 1} value={index + 1}>{new Date(2026, index).toLocaleString("en", { month: "long" })}</option>
            ))}
          </select>
        </label>
        <label className="text-xs font-bold uppercase">
          Year
          <input value={year} onChange={(event) => setYear(Number(event.target.value))} type="number" className={`${inputClass} mt-2 w-28`} />
        </label>
        <label className="text-xs font-bold uppercase">
          Employee
          <select value={employeeId} onChange={(event) => setEmployeeId(event.target.value)} className={`${inputClass} mt-2 w-56`}>
            <option value="">All employees</option>
            {employees.map((employee) => (
              <option key={employee.id} value={employee.id}>{employee.name}</option>
            ))}
          </select>
        </label>
        <button type="button" onClick={load} className={buttonClass}>Apply</button>
      </div>

      {error && <div className="mb-5"><ErrorMessage message={error} /></div>}

      {loading ? (
        <PageState message="Loading attendance..." />
      ) : (
        <Panel className="overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full min-w-[860px] text-left text-sm">
              <thead className="bg-[#242723] text-[10px] uppercase text-white/60">
                <tr>
                  <th className="px-5 py-3">Employee</th>
                  <th>Date</th>
                  <th>Check in</th>
                  <th>Check out</th>
                  <th>Hours</th>
                  <th>OT</th>
                  <th className="pr-5">Source</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((row) => (
                  <tr key={row.id} className="border-t border-[#e2ded4]">
                    <td className="px-5 py-4">
                      <p className="font-semibold">{row.employee.name}</p>
                      <p className="text-xs text-[#6f746e]">{row.employee.fingerprint_id}</p>
                    </td>
                    <td>{row.date?.slice?.(0, 10) || row.date}</td>
                    <td>{formatTime(row.check_in)}</td>
                    <td>{formatTime(row.check_out)}</td>
                    <td>{row.hours_worked}</td>
                    <td>{row.overtime_hours}</td>
                    <td className="pr-5">
                      <span className={`inline-flex items-center gap-1 px-2 py-1 text-[10px] font-bold uppercase ${row.source === "fingerprint" ? "bg-[#167c73]/10 text-[#167c73]" : "bg-[#f5c842]/25 text-[#735a00]"}`}>
                        {row.source === "fingerprint" && <Fingerprint size={12} />}
                        {row.source}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            {rows.length === 0 && <p className="p-10 text-center text-sm text-[#6f746e]">No attendance for this period.</p>}
          </div>
        </Panel>
      )}
    </AppShell>
  );
}
