"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { Search } from "lucide-react";
import { AppShell } from "@/components/app-shell";
import { buttonClass, ErrorMessage, inputClass, PageState, Panel } from "@/components/ui";
import { api, formatDate } from "@/lib/api";
import { warrantyLabel } from "@/lib/warranty";

type WarrantyRow = {
  id: number;
  description: string;
  warranty_months: number | null;
  warranty_starts_on?: string | null;
  warranty_until: string | null;
  bill?: { id: number; bill_number: string; admission_date: string; customer?: { name: string; phone?: string } | null } | null;
  part?: { name: string; sku?: string | null; barcode?: string | null } | null;
};

export default function WarrantiesPage() {
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
      .catch((caught) => setError(caught instanceof Error ? caught.message : "Could not load warranties."))
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    const timer = setTimeout(() => load(search, includeExpired), 200);
    return () => clearTimeout(timer);
  }, [search, includeExpired, load]);

  return (
    <AppShell title="Warranties" eyebrow="Sold items still under cover">
      <p className="mb-5 max-w-2xl text-sm text-[#6f746e]">
        Warranties are added on the sale, from the day the customer bought the item. Search by customer, phone, barcode, SKU, or bill number.
      </p>
      <div className="mb-5 flex flex-wrap items-end gap-2">
        <label className="relative min-w-56 flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-[#6f746e]" size={16} />
          <input
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            className={`${inputClass} pl-10`}
            placeholder="Customer, phone, barcode, SKU or bill number"
          />
        </label>
        <button type="button" onClick={() => load(search, includeExpired)} className={buttonClass}>Look up</button>
        <label className="flex h-9 items-center gap-2 text-sm">
          <input type="checkbox" checked={includeExpired} onChange={(event) => setIncludeExpired(event.target.checked)} className="size-4 accent-[#167c73]" />
          Include expired
        </label>
      </div>
      {error && <ErrorMessage message={error} />}
      {loading ? <PageState message="Loading warranties..." /> : (
        <Panel>
          <div className="overflow-x-auto">
            <table className="w-full min-w-[720px] text-left text-sm">
              <thead className="bg-[#eeece5] text-[10px] uppercase text-[#6f746e]">
                <tr>
                  <th className="px-5 py-3">Item</th>
                  <th>Customer</th>
                  <th>Bill</th>
                  <th>Cover</th>
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
                      {row.bill?.customer?.name ?? "Walk-in"}
                      {row.bill?.customer?.phone ? <span className="block text-xs text-[#6f746e]">{row.bill.customer.phone}</span> : null}
                    </td>
                    <td>
                      {row.bill ? <Link href={`/bills/${row.bill.id}`} className="font-semibold text-[#167c73]">{row.bill.bill_number}</Link> : "—"}
                      <span className="block text-xs text-[#6f746e]">{formatDate(row.bill?.admission_date)}</span>
                    </td>
                    <td>
                      <p className="font-semibold">{warrantyLabel(row.warranty_months, row.warranty_until, row.warranty_starts_on)}</p>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {rows.length === 0 && (
            <p className="p-8 text-center text-sm text-[#6f746e]">No warranties match that search. Add cover on a sale bill after the customer buys the item.</p>
          )}
        </Panel>
      )}
    </AppShell>
  );
}
