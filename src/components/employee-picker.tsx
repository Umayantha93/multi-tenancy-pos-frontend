"use client";

import { useMemo, useState } from "react";
import { Plus, X } from "lucide-react";
import { buttonClass, inputClass } from "@/components/ui";

type EmployeeOption = { id: number; name: string; position?: string | null };

export function EmployeePicker({
  employees,
  selectedIds,
  onChange,
  disabled = false,
}: {
  employees: EmployeeOption[];
  selectedIds: number[];
  onChange: (ids: number[]) => void;
  disabled?: boolean;
  compact?: boolean;
}) {
  const [pendingId, setPendingId] = useState("");

  const byId = useMemo(
    () => new Map(employees.map((employee) => [employee.id, employee])),
    [employees],
  );
  const assigned = selectedIds
    .map((id) => byId.get(id))
    .filter((employee): employee is EmployeeOption => Boolean(employee));
  const available = employees.filter((employee) => !selectedIds.includes(employee.id));

  function assign() {
    const id = Number(pendingId);
    if (disabled || !id || selectedIds.includes(id)) return;
    onChange([...selectedIds, id]);
    setPendingId("");
  }

  function remove(id: number) {
    if (disabled) return;
    onChange(selectedIds.filter((value) => value !== id));
    if (pendingId === String(id)) setPendingId("");
  }

  if (employees.length === 0) {
    return <p className="text-sm text-[#6f746e]">No employees yet. Add them under Team if you want to assign jobs.</p>;
  }

  return (
    <div className="space-y-2">
      <div className="flex items-stretch gap-2">
        <select
          value={pendingId}
          disabled={disabled || available.length === 0}
          onChange={(event) => setPendingId(event.target.value)}
          className={inputClass}
        >
          <option value="">{available.length === 0 ? "All employees assigned" : "Select employee"}</option>
          {available.map((employee) => (
            <option key={employee.id} value={employee.id}>
              {employee.name}{employee.position ? ` · ${employee.position}` : ""}
            </option>
          ))}
        </select>
        <button
          type="button"
          disabled={disabled || !pendingId}
          onClick={assign}
          className={`${buttonClass} shrink-0 px-3`}
        >
          <Plus size={14} />
          Assign
        </button>
      </div>

      {assigned.length > 0 ? (
        <ul className="divide-y divide-[#eeeae1] border border-[#d7d3c8] bg-white">
          {assigned.map((employee) => (
            <li key={employee.id} className="flex items-center gap-2 px-2.5 py-1.5">
              <span className="min-w-0 flex-1">
                <span className="block truncate text-[13px] font-semibold leading-tight">{employee.name}</span>
                {employee.position && (
                  <span className="block truncate text-[10px] uppercase text-[#6f746e]">{employee.position}</span>
                )}
              </span>
              {!disabled && (
                <button
                  type="button"
                  onClick={() => remove(employee.id)}
                  className="grid size-7 shrink-0 place-items-center text-[#6f746e] hover:text-[#b84837]"
                  aria-label={`Remove ${employee.name}`}
                  title="Remove"
                >
                  <X size={14} />
                </button>
              )}
            </li>
          ))}
        </ul>
      ) : (
        <p className="text-xs text-[#6f746e]">No one assigned yet. Optional — jobs can stay unassigned.</p>
      )}
    </div>
  );
}
