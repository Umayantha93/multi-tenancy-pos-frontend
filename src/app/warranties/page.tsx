"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { Search } from "lucide-react";
import { AppShell } from "@/components/app-shell";
import { buttonClass, ErrorMessage, inputClass, PageState, Panel } from "@/components/ui";
import { api, formatDate } from "@/lib/api";
import { usesVehicleJobs } from "@/lib/business-profiles";
import { useBusinessProfile } from "@/lib/use-business-profile";
import { warrantyLabel } from "@/lib/warranty";
import { useT } from "@/lib/locale";

type WarrantyRow = {
  id: number | string;
  description: string;
  warranty_months: number | null;
  warranty_starts_on?: string | null;
  warranty_until: string | null;
  bill?: { id: number; bill_number: string; admission_date: string; customer?: { name: string; phone?: string } | null } | null;
  part?: { name: string; sku?: string | null; barcode?: string | null } | null;
};

export default function WarrantiesPage() {
  const t = useT();
  const profile = useBusinessProfile();
  const vehicleJobs = usesVehicleJobs(profile.type);
  const [search, setSearch] = useState("");
  const [includeExpired, setIncludeExpired] = useState(false);
  const [rows, setRows] = useState<WarrantyRow[]>([]);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);

  const load = useCallback((term: string, expired: boolean) => {
    setLoading(true);
    setError("");
    const params = new URLSearchParams({ search: term, per_page: "50" });
    if (expired) params.set("include_expired", "1");
    api<{ data: WarrantyRow[] }>(`/warranties?${params}`)
      .then((result) => setRows(result.data))
      .catch((caught) => setError(caught instanceof Error ? caught.message : t("warranties.load_failed")))
      .finally(() => setLoading(false));
  }, [t]);

  useEffect(() => {
    const timer = setTimeout(() => load(search, includeExpired), 200);
    return () => clearTimeout(timer);
  }, [search, includeExpired, load]);

  return (
    <AppShell title={t("warranties.title")} eyebrow={t("warranties.eyebrow")}>
      <p className="mb-5 max-w-2xl text-sm text-[#6f746e]">
        {t(vehicleJobs ? "warranties.intro" : "warranties.intro_sale")}
      </p>
      <div className="mb-5 flex flex-wrap items-end gap-2">
        <label className="relative min-w-56 flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-[#6f746e]" size={16} />
          <input
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            className={`${inputClass} pl-10`}
            placeholder={t(vehicleJobs ? "warranties.search_placeholder" : "warranties.search_placeholder_sale")}
          />
        </label>
        <button type="button" onClick={() => load(search, includeExpired)} className={buttonClass}>{t("warranties.look_up")}</button>
        <label className="flex h-8 items-center gap-2 text-sm">
          <input type="checkbox" checked={includeExpired} onChange={(event) => setIncludeExpired(event.target.checked)} className="size-4 accent-[#167c73]" />
          {t("warranties.include_expired")}
        </label>
      </div>
      {error && <ErrorMessage message={error} />}
      {loading ? <PageState message={t("warranties.loading")} /> : (
        <Panel>
          <div className="overflow-x-auto">
            <table className="w-full min-w-[720px] text-left text-sm">
              <thead className="bg-[#eeece5] text-[10px] uppercase text-[#6f746e]">
                <tr>
                  <th className="px-5 py-3">{t("common.item")}</th>
                  <th>{t("common.customer")}</th>
                  <th>{t("warranties.bill")}</th>
                  <th>{t("warranties.cover")}</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((row) => (
                  <tr key={row.id} className="border-t border-[#e2ded4]">
                    <td className="px-5 py-3">
                      <strong>{row.part?.name || row.description}</strong>
                      {(row.part?.barcode || row.part?.sku) && (
                        <p className="text-xs text-[#6f746e]">{row.part?.barcode || row.part?.sku}</p>
                      )}
                    </td>
                    <td>
                      {row.bill?.customer?.name ?? t("common.walk_in")}
                      {row.bill?.customer?.phone ? <span className="block text-xs text-[#6f746e]">{row.bill.customer.phone}</span> : null}
                    </td>
                    <td>
                      {row.bill ? <Link href={`/bills/${row.bill.id}`} className="font-semibold text-[#167c73]">{row.bill.bill_number}</Link> : "—"}
                      <span className="block text-xs text-[#6f746e]">{formatDate(row.bill?.admission_date)}</span>
                    </td>
                    <td>
                      <p className="font-semibold">{warrantyLabel(row.warranty_months, row.warranty_until, row.warranty_starts_on, t)}</p>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {rows.length === 0 && (
            <p className="p-8 text-center text-sm text-[#6f746e]">{t(vehicleJobs ? "warranties.empty" : "warranties.empty_sale")}</p>
          )}
        </Panel>
      )}
    </AppShell>
  );
}
