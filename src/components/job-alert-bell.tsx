"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Bell } from "lucide-react";
import { api } from "@/lib/api";
import { useT } from "@/lib/locale";

type JobAlert = {
  id: number;
  bill_id: number | null;
  bill_number: string;
  vehicle_label?: string | null;
  read_at?: string | null;
};

type JobAlertList = {
  unread: number;
  data: JobAlert[];
};

export function JobAlertBell({ enabled }: { enabled: boolean }) {
  const t = useT();
  const router = useRouter();
  const rootRef = useRef<HTMLDivElement>(null);
  const [open, setOpen] = useState(false);
  const [unread, setUnread] = useState(0);
  const [alerts, setAlerts] = useState<JobAlert[]>([]);

  useEffect(() => {
    if (!enabled) return;
    let timer = 0;
    const load = () => {
      api<JobAlertList>("/job-alerts")
        .then((result) => {
          setUnread(result.unread);
          setAlerts(result.data);
        })
        .catch(() => undefined);
    };
    load();
    timer = window.setInterval(() => {
      if (document.visibilityState === "visible") load();
    }, 20000);
    window.addEventListener("focus", load);
    return () => {
      window.clearInterval(timer);
      window.removeEventListener("focus", load);
    };
  }, [enabled]);

  useEffect(() => {
    if (!open) return;
    function onPointer(event: MouseEvent) {
      if (!rootRef.current?.contains(event.target as Node)) setOpen(false);
    }
    document.addEventListener("mousedown", onPointer);
    return () => document.removeEventListener("mousedown", onPointer);
  }, [open]);

  if (!enabled) return null;

  async function openAlert(alert: JobAlert) {
    setOpen(false);
    if (!alert.read_at) {
      await api(`/job-alerts/${alert.id}/read`, { method: "POST" }).catch(() => undefined);
      setUnread((count) => Math.max(0, count - 1));
      setAlerts((rows) => rows.map((row) => (row.id === alert.id ? { ...row, read_at: new Date().toISOString() } : row)));
    }
    if (alert.bill_id) router.push(`/bills/${alert.bill_id}`);
  }

  async function markAll() {
    const result = await api<JobAlertList>("/job-alerts/read-all", { method: "POST" }).catch(() => null);
    if (!result) return;
    setUnread(result.unread);
    setAlerts(result.data);
  }

  const hasAlerts = unread > 0;

  return (
    <div ref={rootRef} className="relative">
      <button
        type="button"
        aria-label={t("shell.job_alerts")}
        aria-expanded={open}
        onClick={() => setOpen((value) => !value)}
        className={`relative grid size-10 place-items-center border border-[#242723] bg-[#242723] ${hasAlerts ? "text-[#c4352b]" : "text-white"}`}
      >
        <Bell size={16} />
        {hasAlerts && (
          <span className="absolute -top-1 -right-1 grid min-w-4 place-items-center bg-[#f5c842] px-1 text-[10px] font-bold leading-4 text-[#20221f]">
            {unread > 9 ? "9+" : unread}
          </span>
        )}
      </button>
      {open && (
        <div className="absolute right-0 z-50 mt-2 w-80 max-w-[calc(100vw-2rem)] border border-[#d7d3c8] bg-white shadow-lg">
          <div className="flex items-center justify-between border-b border-[#d7d3c8] px-3 py-2">
            <p className="text-[10px] font-bold uppercase tracking-wide text-[#6f746e]">{t("shell.job_alerts")}</p>
            {unread > 0 && (
              <button type="button" onClick={() => void markAll()} className="text-[11px] font-semibold text-[#167c73]">
                {t("shell.mark_alerts_read")}
              </button>
            )}
          </div>
          {alerts.length === 0 ? (
            <p className="px-3 py-4 text-sm text-[#6f746e]">{t("shell.no_job_alerts")}</p>
          ) : (
            <ul className="max-h-80 overflow-y-auto">
              {alerts.map((alert) => (
                <li key={alert.id}>
                  <button
                    type="button"
                    onClick={() => void openAlert(alert)}
                    className={`block w-full px-3 py-3 text-left text-sm hover:bg-[#f7f5ef] ${alert.read_at ? "text-[#6f746e]" : "font-semibold text-[#20221f]"}`}
                  >
                    {alert.vehicle_label
                      ? t("shell.new_job_card_for", { number: alert.bill_number, plate: alert.vehicle_label })
                      : t("shell.new_job_card", { number: alert.bill_number })}
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
    </div>
  );
}
