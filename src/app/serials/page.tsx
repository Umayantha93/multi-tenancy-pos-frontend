"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { Search } from "lucide-react";
import { AppShell } from "@/components/app-shell";
import { buttonClass, ErrorMessage, inputClass, PageState, Panel } from "@/components/ui";
import { api, currentFeatures, formatDate } from "@/lib/api";
import { useT } from "@/lib/locale";

type SerialRow = {
  id: number;
  serial: string;
  status: "in_stock" | "sold" | "returned";
  sold_at?: string | null;
  part?: { id: number; name: string; sku?: string | null; brand?: string | null } | null;
  bill_item?: {
    id: number;
    warranty_until?: string | null;
    bill?: { id: number; bill_number: string; customer?: { name: string; phone?: string } | null } | null;
  } | null;
};

export default function SerialsPage() {
  const t = useT();
  const [sessionReady, setSessionReady] = useState(false);
  const [allowed, setAllowed] = useState(false);
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState("");
  const [rows, setRows] = useState<SerialRow[]>([]);
  const [lookup, setLookup] = useState<SerialRow | null>(null);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setSessionReady(true);
    setAllowed(currentFeatures().includes("serial_inventory"));
  }, []);

  const load = useCallback((term: string, filter: string) => {
    if (!allowed) return;
    setLoading(true);
    setError("");
    const params = new URLSearchParams({ per_page: "50" });
    if (term) params.set("search", term);
    if (filter) params.set("status", filter);
    api<{ data: SerialRow[] }>(`/serials?${params}`)
      .then((result) => setRows(result.data))
      .catch((caught) => setError(caught instanceof Error ? caught.message : t("serials.load_failed")))
      .finally(() => setLoading(false));
  }, [allowed, t]);

  useEffect(() => {
    if (!sessionReady || !allowed) return;
    const timer = setTimeout(() => load(search, status), 200);
    return () => clearTimeout(timer);
  }, [search, status, sessionReady, allowed, load]);

  async function lookUp() {
    const needle = search.trim();
    if (!needle) return;
    setError("");
    setLookup(null);
    try {
      setLookup(await api<SerialRow>(`/serials/lookup?q=${encodeURIComponent(needle)}`));
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : t("serials.not_found"));
    }
  }

  const title = sessionReady ? t("serials.title") : "IMEI stock";
  const eyebrow = sessionReady ? t("serials.eyebrow") : "Unique units";

  return (
    <AppShell title={title} eyebrow={eyebrow}>
      {sessionReady && !allowed ? (
        <Panel className="p-5">
          <p className="text-sm text-[#6f746e]">{t("serials.locked")}</p>
        </Panel>
      ) : (
        <>
          <p className="mb-5 max-w-2xl text-sm text-[#6f746e]">{t("serials.intro")}</p>
          <div className="mb-5 flex flex-wrap items-end gap-2">
            <label className="relative min-w-56 flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-[#6f746e]" size={16} />
              <input
                value={search}
                onChange={(event) => setSearch(event.target.value)}
                onKeyDown={(event) => { if (event.key === "Enter") void lookUp(); }}
                className={`${inputClass} pl-10`}
                placeholder={t("serials.search_placeholder")}
              />
            </label>
            <select value={status} onChange={(event) => setStatus(event.target.value)} className={inputClass}>
              <option value="">{t("serials.all_status")}</option>
              <option value="in_stock">{t("serials.in_stock")}</option>
              <option value="sold">{t("serials.sold")}</option>
              <option value="returned">{t("serials.returned")}</option>
            </select>
            <button type="button" onClick={() => void lookUp()} className={buttonClass}>{t("serials.look_up")}</button>
          </div>
          {error && <ErrorMessage message={error} />}
          {lookup && (
            <Panel className="mb-5 p-5">
              <p className="text-xs font-bold uppercase text-[#6f746e]">{t("serials.lookup_result")}</p>
              <p className="mt-2 font-display text-2xl font-semibold">{lookup.serial}</p>
              <p className="mt-1 text-sm">{lookup.part?.name} · {t(`serials.${lookup.status}`)}</p>
              {lookup.bill_item?.bill && (
                <p className="mt-2 text-sm text-[#6f746e]">
                  <Link href={`/bills/${lookup.bill_item.bill.id}`} className="text-[#167c73]">{lookup.bill_item.bill.bill_number}</Link>
                  {lookup.bill_item.bill.customer?.name ? ` · ${lookup.bill_item.bill.customer.name}` : ""}
                  {lookup.bill_item.warranty_until ? ` · ${t("warranties.cover")} ${formatDate(lookup.bill_item.warranty_until)}` : ""}
                </p>
              )}
            </Panel>
          )}
          {!sessionReady || (loading && !lookup) ? <PageState message={t("serials.loading")} /> : (
            <Panel>
              <div className="overflow-x-auto">
                <table className="w-full min-w-[720px] text-left text-sm">
                  <thead className="bg-[#eeece5] text-[10px] uppercase text-[#6f746e]">
                    <tr>
                      <th className="px-5 py-3">{t("serials.imei")}</th>
                      <th>{t("common.item")}</th>
                      <th>{t("common.status")}</th>
                      <th>{t("warranties.bill")}</th>
                    </tr>
                  </thead>
                  <tbody>
                    {rows.map((row) => (
                      <tr key={row.id} className="border-t border-[#e2ded4]">
                        <td className="px-5 py-3 font-semibold">{row.serial}</td>
                        <td>{row.part?.name ?? "—"}</td>
                        <td className="uppercase text-[11px] font-bold">{t(`serials.${row.status}`)}</td>
                        <td>
                          {row.bill_item?.bill ? (
                            <Link href={`/bills/${row.bill_item.bill.id}`} className="text-[#167c73]">{row.bill_item.bill.bill_number}</Link>
                          ) : "—"}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
                {rows.length === 0 && <p className="p-8 text-center text-sm text-[#6f746e]">{t("serials.empty")}</p>}
              </div>
            </Panel>
          )}
        </>
      )}
    </AppShell>
  );
}
