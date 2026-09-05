"use client";

import { useEffect, useState } from "react";
import { inputClass } from "@/components/ui";

type Cover = "" | "12" | "24" | "custom";

export function warrantyFromForm(form: FormData) {
  const cover = String(form.get("warranty_cover") || "");
  const starts = String(form.get("warranty_starts_on") || "") || null;
  if (!cover) {
    return { warranty_months: null, warranty_starts_on: null, warranty_until: null };
  }
  if (cover === "custom") {
    return {
      warranty_months: null,
      warranty_starts_on: starts,
      warranty_until: String(form.get("warranty_until") || "") || null,
    };
  }
  return {
    warranty_months: Number(cover),
    warranty_starts_on: starts,
    warranty_until: null,
  };
}

export function WarrantyFields({
  purchaseDate,
  months,
  startsOn,
  until,
}: {
  purchaseDate?: string | null;
  months?: number | null;
  startsOn?: string | null;
  until?: string | null;
}) {
  const bought = (startsOn || purchaseDate || "").slice(0, 10);
  const [cover, setCover] = useState<Cover>(() => {
    if (!months && !until) return "";
    if (months === 12) return "12";
    if (months === 24) return "24";
    return "custom";
  });

  useEffect(() => {
    if (!months && !until) setCover("");
    else if (months === 12) setCover("12");
    else if (months === 24) setCover("24");
    else setCover("custom");
  }, [months, until]);

  return (
    <div className="space-y-3 border border-[#d7d3c8] bg-[#fbfaf6] p-3">
      <p className="text-xs font-bold uppercase">Warranty</p>
      <p className="text-[11px] text-[#6f746e]">Starts on the day this customer bought the item. Choose 1 year, 2 years, or a custom end date.</p>
      <label className="block text-xs font-bold uppercase">
        Cover
        <select name="warranty_cover" value={cover} onChange={(event) => setCover(event.target.value as Cover)} className={`${inputClass} mt-2`}>
          <option value="">No warranty</option>
          <option value="12">1 year</option>
          <option value="24">2 years</option>
          <option value="custom">Custom end date</option>
        </select>
      </label>
      {cover !== "" && (
        <label className="block text-xs font-bold uppercase">
          Starts (purchase date)
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
