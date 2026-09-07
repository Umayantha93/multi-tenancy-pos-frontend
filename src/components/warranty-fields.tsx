"use client";

import { useEffect, useState } from "react";
import { inputClass } from "@/components/ui";

type Mode = "" | "duration" | "custom";
type Unit = "months" | "years";

export function warrantyFromForm(form: FormData) {
  const mode = String(form.get("warranty_cover") || "");
  const starts = String(form.get("warranty_starts_on") || "") || null;
  if (!mode) {
    return { warranty_months: null, warranty_starts_on: null, warranty_until: null };
  }
  if (mode === "custom") {
    return {
      warranty_months: null,
      warranty_starts_on: starts,
      warranty_until: String(form.get("warranty_until") || "") || null,
    };
  }
  const amount = Number(form.get("warranty_amount") || 0);
  const unit = String(form.get("warranty_unit") || "months") === "years" ? "years" : "months";
  const months = unit === "years" ? Math.round(amount * 12) : Math.round(amount);
  if (months <= 0) {
    return { warranty_months: null, warranty_starts_on: null, warranty_until: null };
  }
  return {
    warranty_months: Math.min(120, months),
    warranty_starts_on: starts,
    warranty_until: null,
  };
}

function modeFrom(months?: number | null, until?: string | null): Mode {
  if (Number(months) > 0) return "duration";
  if (until) return "custom";
  return "";
}

function unitFrom(months?: number | null): Unit {
  const count = Number(months || 0);
  return count >= 12 && count % 12 === 0 ? "years" : "months";
}

function amountFrom(months?: number | null, unit: Unit = "months"): number {
  const count = Number(months || 0);
  if (count <= 0) return 1;
  return unit === "years" ? count / 12 : count;
}

export function WarrantyFields({
  purchaseDate,
  months,
  startsOn,
  until,
  hint = "Cover starts on the job or purchase date. Set months or years, or a custom end date.",
}: {
  purchaseDate?: string | null;
  months?: number | null;
  startsOn?: string | null;
  until?: string | null;
  hint?: string;
}) {
  const bought = (startsOn || purchaseDate || "").slice(0, 10);
  const [cover, setCover] = useState<Mode>(() => modeFrom(months, until));
  const [unit, setUnit] = useState<Unit>(() => unitFrom(months));
  const [amount, setAmount] = useState(() => amountFrom(months, unitFrom(months)));

  useEffect(() => {
    const nextUnit = unitFrom(months);
    setCover(modeFrom(months, until));
    setUnit(nextUnit);
    setAmount(amountFrom(months, nextUnit));
  }, [months, until]);

  return (
    <div className="space-y-3 border border-[#d7d3c8] bg-[#fbfaf6] p-3">
      <p className="text-xs font-bold uppercase">Warranty</p>
      <p className="text-[11px] text-[#6f746e]">{hint}</p>
      <label className="block text-xs font-bold uppercase">
        Cover
        <select name="warranty_cover" value={cover} onChange={(event) => setCover(event.target.value as Mode)} className={`${inputClass} mt-2`}>
          <option value="">No warranty</option>
          <option value="duration">Months or years</option>
          <option value="custom">Custom end date</option>
        </select>
      </label>
      {cover === "duration" && (
        <div className="grid grid-cols-2 gap-2">
          <label className="block text-xs font-bold uppercase">
            Length
            <input
              name="warranty_amount"
              type="number"
              min="1"
              max={unit === "years" ? 10 : 120}
              step="1"
              required
              value={amount}
              onChange={(event) => setAmount(Number(event.target.value))}
              className={`${inputClass} mt-2`}
            />
          </label>
          <label className="block text-xs font-bold uppercase">
            Unit
            <select
              name="warranty_unit"
              value={unit}
              onChange={(event) => {
                const next = event.target.value as Unit;
                setAmount((current) => {
                  const asMonths = unit === "years" ? current * 12 : current;
                  if (next === "years") return Math.max(1, Math.round(asMonths / 12) || 1);
                  return Math.max(1, asMonths);
                });
                setUnit(next);
              }}
              className={`${inputClass} mt-2`}
            >
              <option value="months">Months</option>
              <option value="years">Years</option>
            </select>
          </label>
        </div>
      )}
      {cover !== "" && (
        <label className="block text-xs font-bold uppercase">
          Starts
          <input name="warranty_starts_on" type="date" defaultValue={bought} className={`${inputClass} mt-2`} />
        </label>
      )}
      {cover === "custom" && (
        <label className="block text-xs font-bold uppercase">
          Covered until
          <input name="warranty_until" type="date" defaultValue={(until || "").slice(0, 10)} required className={`${inputClass} mt-2`} />
        </label>
      )}
    </div>
  );
}
