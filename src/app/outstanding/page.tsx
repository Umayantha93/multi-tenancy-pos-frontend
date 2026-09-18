"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { MessageCircle, Search } from "lucide-react";
import { AppShell } from "@/components/app-shell";
import { buttonClass, ErrorMessage, inputClass, PageState, Panel } from "@/components/ui";
import { api, currentFeatures, formatDate, money } from "@/lib/api";
import { billShareUrl, whatsappHref } from "@/lib/whatsapp";
import { useT } from "@/lib/locale";

type Row = {
  id: number;
  name: string;
  phone?: string | null;
  outstanding_balance?: number | string;
  outstanding_days?: number;
  oldest_unpaid_bill?: {
    id: number;
    bill_number: string;
    admission_date?: string | null;
    balance_due?: string | number;
    share_token?: string | null;
  } | null;
};

export default function OutstandingPage() {
  const t = useT();
  const [sessionReady, setSessionReady] = useState(false);
  const [allowed, setAllowed] = useState(false);
  const [canWhatsapp, setCanWhatsapp] = useState(false);
  const [search, setSearch] = useState("");
  const [rows, setRows] = useState<Row[]>([]);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const features = currentFeatures();
    setSessionReady(true);
    setAllowed(features.includes("customers") && features.includes("billing"));
    setCanWhatsapp(features.includes("bill_whatsapp"));
  }, []);

  const load = useCallback((term: string) => {
    if (!allowed) return;
    setLoading(true);
    setError("");
    const params = new URLSearchParams({ per_page: "50" });
    if (term) params.set("search", term);
    api<{ data: Row[] }>(`/customers/outstanding?${params}`)
      .then((result) => setRows(result.data))
      .catch((caught) => setError(caught instanceof Error ? caught.message : t("outstanding.load_failed")))
      .finally(() => setLoading(false));
  }, [allowed, t]);

  useEffect(() => {
    if (!sessionReady || !allowed) return;
    const timer = setTimeout(() => load(search), 200);
    return () => clearTimeout(timer);
  }, [search, sessionReady, allowed, load]);

  function remind(row: Row) {
    if (!row.phone) {
      setError(t("outstanding.need_phone"));
      return;
    }
    const days = row.outstanding_days ?? 0;
    const amount = money(row.outstanding_balance ?? 0);
    const link = billShareUrl(row.oldest_unpaid_bill?.share_token);
    const text = [
      `Hi ${row.name},`,
      `you have ${amount} outstanding (${days} day${days === 1 ? "" : "s"}).`,
      link,
    ].filter(Boolean).join(" ");
    const href = whatsappHref(row.phone, text);
    if (!href) {
      setError(t("outstanding.need_phone"));
      return;
    }
    window.open(href, "_blank", "noopener,noreferrer");
  }

  return (
    <AppShell title={sessionReady ? t("outstanding.title") : "Outstanding"} eyebrow={sessionReady ? t("outstanding.eyebrow") : "Ageing"}>
      {sessionReady && !allowed ? (
        <Panel className="p-5"><p className="text-sm text-[#6f746e]">{t("outstanding.locked")}</p></Panel>
      ) : (
        <>
          <p className="mb-5 max-w-2xl text-sm text-[#6f746e]">{t("outstanding.intro")}</p>
          <label className="relative mb-5 block max-w-xl">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-[#6f746e]" size={16} />
            <input value={search} onChange={(event) => setSearch(event.target.value)} className={`${inputClass} pl-10`} placeholder={t("outstanding.search_placeholder")} />
          </label>
          {error && <ErrorMessage message={error} />}
          {!sessionReady || loading ? <PageState message={t("outstanding.loading")} /> : (
            <Panel>
              <div className="overflow-x-auto">
                <table className="w-full min-w-[720px] text-left text-sm">
                  <thead className="bg-[#eeece5] text-[10px] uppercase text-[#6f746e]">
                    <tr>
                      <th className="px-5 py-3">{t("common.customer")}</th>
                      <th>{t("outstanding.owes")}</th>
                      <th>{t("outstanding.days")}</th>
                      <th>{t("outstanding.oldest")}</th>
                      <th />
                    </tr>
                  </thead>
                  <tbody>
                    {rows.map((row) => (
                      <tr key={row.id} className="border-t border-[#e2ded4]">
                        <td className="px-5 py-3">
                          <Link href={`/customers/${row.id}`} className="font-semibold hover:text-[#167c73]">{row.name}</Link>
                          <p className="text-xs text-[#6f746e]">{row.phone || "—"}</p>
                        </td>
                        <td className="font-semibold text-[#b84837]">{money(row.outstanding_balance ?? 0)}</td>
                        <td>{row.outstanding_days ?? 0}</td>
                        <td>
                          {row.oldest_unpaid_bill ? (
                            <Link href={`/bills/${row.oldest_unpaid_bill.id}`} className="text-[#167c73]">
                              {row.oldest_unpaid_bill.bill_number}
                            </Link>
                          ) : "—"}
                          {row.oldest_unpaid_bill?.admission_date ? (
                            <p className="text-xs text-[#6f746e]">{formatDate(row.oldest_unpaid_bill.admission_date)}</p>
                          ) : null}
                        </td>
                        <td className="pr-5 text-right">
                          {canWhatsapp && (
                            <button type="button" onClick={() => remind(row)} className={buttonClass} disabled={!row.phone}>
                              <MessageCircle size={14} /> {t("outstanding.remind")}
                            </button>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
                {rows.length === 0 && <p className="p-8 text-center text-sm text-[#6f746e]">{t("outstanding.empty")}</p>}
              </div>
            </Panel>
          )}
        </>
      )}
    </AppShell>
  );
}
