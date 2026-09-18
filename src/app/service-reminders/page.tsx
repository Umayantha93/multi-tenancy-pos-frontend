"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { AppShell } from "@/components/app-shell";
import { buttonClass, ErrorMessage, inputClass, PageState, Panel } from "@/components/ui";
import { api, currentFeatures, formatDate } from "@/lib/api";
import { useT } from "@/lib/locale";

type Row = {
  id: number;
  bill_number: string;
  next_service_due_on?: string | null;
  next_service_mileage?: number | string | null;
  service_reminder_sent_at?: string | null;
  customer?: { name: string; phone?: string | null } | null;
  vehicle?: { number_plate: string } | null;
};

export default function ServiceRemindersPage() {
  const t = useT();
  const [sessionReady, setSessionReady] = useState(false);
  const [allowed, setAllowed] = useState(false);
  const [rows, setRows] = useState<Row[]>([]);
  const [days, setDays] = useState("14");
  const [includeSent, setIncludeSent] = useState(false);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState<number | null>(null);

  const load = useCallback(() => {
    if (!allowed) return;
    setLoading(true);
    setError("");
    const params = new URLSearchParams({ days, include_sent: includeSent ? "1" : "0" });
    api<{ data: Row[] }>(`/service-reminders?${params}`)
      .then((result) => setRows(result.data))
      .catch((caught) => setError(caught instanceof Error ? caught.message : t("reminders.load_failed")))
      .finally(() => setLoading(false));
  }, [allowed, days, includeSent, t]);

  useEffect(() => {
    setAllowed(currentFeatures().includes("service_reminders"));
    setSessionReady(true);
  }, []);

  useEffect(() => { load(); }, [load]);

  async function send(row: Row, channel: "sms" | "whatsapp") {
    setSending(row.id);
    setError("");
    try {
      const result = await api<{ message: string; whatsapp_url?: string | null }>(`/service-reminders/${row.id}/send`, {
        method: "POST",
        body: JSON.stringify({ channel }),
      });
      if (channel === "whatsapp" && result.whatsapp_url) {
        window.open(result.whatsapp_url, "_blank");
      }
      load();
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : t("reminders.send_failed"));
    } finally {
      setSending(null);
    }
  }

  return (
    <AppShell title={t("reminders.title")} eyebrow={t("reminders.eyebrow")}>
      {!sessionReady ? <PageState message={t("reminders.loading")} /> : !allowed ? (
        <PageState message={t("reminders.locked")} />
      ) : (
      <>
      <p className="mb-5 max-w-2xl text-sm text-[#6f746e]">{t("reminders.intro")}</p>
      <div className="mb-5 flex flex-wrap items-end gap-3">
        <label className="text-sm font-semibold">
          {t("reminders.days")}
          <input type="number" min={1} max={90} value={days} onChange={(event) => setDays(event.target.value)} className={`${inputClass} mt-2 w-24`} />
        </label>
        <label className="flex h-8 items-center gap-2 text-sm">
          <input type="checkbox" checked={includeSent} onChange={(event) => setIncludeSent(event.target.checked)} className="size-4 accent-[#167c73]" />
          {t("reminders.include_sent")}
        </label>
      </div>
      {error && <ErrorMessage message={error} />}
      {loading ? <PageState message={t("reminders.loading")} /> : (
        <Panel>
          <div className="overflow-x-auto">
            <table className="w-full min-w-[720px] text-left text-sm">
              <thead className="bg-[#eeece5] text-[10px] uppercase text-[#6f746e]">
                <tr>
                  <th className="px-5 py-3">{t("common.customer")}</th>
                  <th>{t("common.vehicle")}</th>
                  <th>{t("reminders.due")}</th>
                  <th>{t("bill.next_service")}</th>
                  <th className="pr-5">{t("reminders.actions")}</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((row) => (
                  <tr key={row.id} className="border-t border-[#e2ded4]">
                    <td className="px-5 py-4">
                      <Link href={`/bills/${row.id}`} className="font-semibold hover:text-[#167c73]">{row.customer?.name ?? t("common.walk_in")}</Link>
                      <p className="text-xs text-[#6f746e]">{row.bill_number}</p>
                    </td>
                    <td>{row.vehicle?.number_plate ?? "—"}</td>
                    <td>{row.next_service_due_on ? formatDate(row.next_service_due_on) : "—"}</td>
                    <td>{row.next_service_mileage != null ? `${Number(row.next_service_mileage).toLocaleString()} km` : "—"}</td>
                    <td className="pr-5">
                      <div className="flex flex-wrap gap-2">
                        <button type="button" disabled={sending === row.id} onClick={() => send(row, "sms")} className={buttonClass}>
                          {t("reminders.sms")}
                        </button>
                        <button type="button" disabled={sending === row.id} onClick={() => send(row, "whatsapp")} className={`${buttonClass} bg-white`}>
                          WhatsApp
                        </button>
                      </div>
                      {row.service_reminder_sent_at && (
                        <p className="mt-1 text-[11px] text-[#167c73]">{t("reminders.sent")}</p>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            {rows.length === 0 && <p className="p-8 text-center text-sm text-[#6f746e]">{t("reminders.empty")}</p>}
          </div>
        </Panel>
      )}
      </>
      )}
    </AppShell>
  );
}
