"use client";

import { useEffect, useState } from "react";
import { PlatformShell } from "@/components/platform-shell";
import { ErrorMessage, PageState, Panel } from "@/components/ui";
import { api } from "@/lib/api";

type ContactNotice = {
  id: number;
  name: string;
  email: string;
  phone?: string | null;
  message: string;
  opened_at?: string | null;
  created_at: string;
};

type NoticeList = {
  unread: number;
  data: ContactNotice[];
};

function formatWhen(value: string) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleString("en-LK", { dateStyle: "medium", timeStyle: "short" });
}

export default function SuperAdminNotificationsPage() {
  const [rows, setRows] = useState<ContactNotice[]>([]);
  const [unread, setUnread] = useState(0);
  const [selectedId, setSelectedId] = useState<number | null>(null);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let timer = 0;
    const load = () => {
      api<NoticeList>("/super-admin/notifications")
        .then((result) => {
          setRows(result.data);
          setUnread(result.unread);
          setError("");
          window.dispatchEvent(new CustomEvent("iubits-notifications", { detail: result.unread }));
        })
        .catch((caught) => setError(caught instanceof Error ? caught.message : "Could not load notifications."))
        .finally(() => setLoading(false));
    };
    load();
    timer = window.setInterval(() => {
      if (document.visibilityState === "visible") load();
    }, 8000);
    window.addEventListener("focus", load);
    return () => {
      window.clearInterval(timer);
      window.removeEventListener("focus", load);
    };
  }, []);

  const selected = rows.find((row) => row.id === selectedId) ?? null;

  async function openNotice(notice: ContactNotice) {
    setSelectedId(notice.id);
    if (notice.opened_at) return;
    const result = await api<{ message: ContactNotice; unread: number }>(`/super-admin/notifications/${notice.id}/open`, {
      method: "POST",
    }).catch(() => null);
    if (!result) return;
    setRows((current) => current.map((row) => (row.id === notice.id ? { ...row, opened_at: result.message.opened_at } : row)));
    setUnread(result.unread);
    window.dispatchEvent(new CustomEvent("iubits-notifications", { detail: result.unread }));
  }

  return (
    <PlatformShell title="Notifications" eyebrow="Website messages">
      {error && <div className="mb-5"><ErrorMessage message={error} /></div>}
      {loading ? (
        <PageState message="Loading notifications..." />
      ) : rows.length === 0 ? (
        <PageState message="No messages yet. New contact form submissions will appear here." />
      ) : (
        <div className="grid gap-4 lg:grid-cols-[320px_1fr]">
          <Panel className="max-h-[70vh] overflow-y-auto">
            <div className="flex items-center justify-between border-b border-[#d7d3c8] px-4 py-3">
              <p className="text-xs font-bold uppercase tracking-wide text-[#6f746e]">Inbox</p>
              {unread > 0 && (
                <p className="bg-[#f5c842] px-2 text-[11px] font-bold leading-5 text-[#181b19]">{unread} unopened</p>
              )}
            </div>
            <ul>
              {rows.map((notice) => {
                const active = notice.id === selectedId;
                const unopened = !notice.opened_at;
                return (
                  <li key={notice.id} className="border-b border-[#ebe7dc] last:border-b-0">
                    <button
                      type="button"
                      onClick={() => void openNotice(notice)}
                      className={`block w-full px-4 py-3 text-left ${active ? "bg-[#f5c842]/35" : "hover:bg-[#f7f5ef]"}`}
                    >
                      <span className="flex items-center gap-2">
                        {unopened && <span className="size-2 shrink-0 rounded-full bg-[#167c73]" />}
                        <span className={`truncate text-sm ${unopened ? "font-semibold text-[#20221f]" : "text-[#6f746e]"}`}>{notice.name}</span>
                      </span>
                      <span className="mt-1 block truncate text-xs text-[#6f746e]">{notice.message}</span>
                      <span className="mt-1 block text-[10px] uppercase text-[#8a8f88]">{formatWhen(notice.created_at)}</span>
                    </button>
                  </li>
                );
              })}
            </ul>
          </Panel>
          {selected ? (
            <Panel className="p-5">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <h2 className="font-display text-3xl font-semibold uppercase leading-none">{selected.name}</h2>
                  <p className="mt-2 text-xs uppercase text-[#6f746e]">{formatWhen(selected.created_at)}</p>
                </div>
                {!selected.opened_at && <span className="bg-[#f5c842] px-2 text-[11px] font-bold leading-5 text-[#181b19]">Unopened</span>}
              </div>
              <dl className="mt-5 grid gap-3 text-sm sm:grid-cols-2">
                <div>
                  <dt className="text-[10px] font-bold uppercase text-[#167c73]">Email</dt>
                  <dd className="mt-1"><a className="font-semibold hover:text-[#167c73]" href={`mailto:${selected.email}`}>{selected.email}</a></dd>
                </div>
                <div>
                  <dt className="text-[10px] font-bold uppercase text-[#167c73]">Phone</dt>
                  <dd className="mt-1 font-semibold">{selected.phone ? <a className="hover:text-[#167c73]" href={`tel:${selected.phone}`}>{selected.phone}</a> : "—"}</dd>
                </div>
              </dl>
              <p className="mt-5 whitespace-pre-wrap border-t border-[#d7d3c8] pt-5 text-sm leading-6 text-[#20221f]">{selected.message}</p>
            </Panel>
          ) : (
            <PageState message="Select a message. Opening it clears it from the unopened count." />
          )}
        </div>
      )}
    </PlatformShell>
  );
}
