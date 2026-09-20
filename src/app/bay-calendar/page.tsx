"use client";

import { FormEvent, useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { Plus } from "lucide-react";
import { AppShell } from "@/components/app-shell";
import { buttonClass, ErrorMessage, inputClass, PageState, Panel } from "@/components/ui";
import { api, currentFeatures, formatDate } from "@/lib/api";
import { useT } from "@/lib/locale";

type Bay = { id: number; name: string };
type Technician = { id: number; name: string; position?: string | null };
type Booking = {
  id: number;
  starts_at: string;
  ends_at: string;
  number_plate?: string | null;
  status: string;
  notes?: string | null;
  bay?: Bay | null;
  customer?: { name: string; phone?: string | null } | null;
  employee?: { id: number; name: string } | null;
  bill?: { id: number; bill_number: string } | null;
};
type DayPayload = { date: string; bays: Bay[]; technicians: Technician[]; bookings: Booking[] };

const HOURS = [8, 9, 10, 11, 12, 13, 14, 15, 16, 17];

function hourLabel(hour: number) {
  return `${String(hour).padStart(2, "0")}:00`;
}

function slotStart(date: string, hour: number) {
  return `${date} ${hourLabel(hour)}:00`;
}

function overlaps(booking: Booking, date: string, hour: number) {
  const start = new Date(booking.starts_at.replace(" ", "T"));
  const end = new Date(booking.ends_at.replace(" ", "T"));
  const from = new Date(`${date}T${hourLabel(hour)}:00`);
  const to = new Date(from.getTime() + 60 * 60 * 1000);
  return start < to && end > from;
}

export default function BayCalendarPage() {
  const t = useT();
  const [sessionReady, setSessionReady] = useState(false);
  const [allowed, setAllowed] = useState(false);
  const [date, setDate] = useState("");
  const [day, setDay] = useState<DayPayload | null>(null);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [draft, setDraft] = useState<{ bayId: number; hour: number } | null>(null);
  const [plate, setPlate] = useState("");
  const [customerName, setCustomerName] = useState("");
  const [customerPhone, setCustomerPhone] = useState("");
  const [employeeId, setEmployeeId] = useState("");
  const [notes, setNotes] = useState("");
  const [bayName, setBayName] = useState("");

  const load = useCallback(() => {
    if (!allowed || !date) return;
    setLoading(true);
    setError("");
    api<DayPayload>(`/job-bookings?date=${date}`)
      .then(setDay)
      .catch((caught) => setError(caught instanceof Error ? caught.message : t("bay_calendar.load_failed")))
      .finally(() => setLoading(false));
  }, [allowed, date, t]);

  useEffect(() => {
    setAllowed(currentFeatures().includes("job_bookings"));
    setDate(new Date().toISOString().slice(0, 10));
    setSessionReady(true);
  }, []);

  useEffect(() => { load(); }, [load]);

  const bookingsByBay = useMemo(() => {
    const map = new Map<number, Booking[]>();
    for (const booking of day?.bookings ?? []) {
      const bayId = booking.bay?.id;
      if (!bayId) continue;
      const list = map.get(bayId) ?? [];
      list.push(booking);
      map.set(bayId, list);
    }
    return map;
  }, [day]);

  async function createBooking(event: FormEvent) {
    event.preventDefault();
    if (!draft) return;
    setSaving(true);
    setError("");
    try {
      await api("/job-bookings", {
        method: "POST",
        body: JSON.stringify({
          bay_id: draft.bayId,
          starts_at: slotStart(date, draft.hour),
          ends_at: slotStart(date, draft.hour + 1),
          number_plate: plate,
          customer_name: customerName || undefined,
          customer_phone: customerPhone || undefined,
          employee_id: employeeId ? Number(employeeId) : null,
          notes: notes || undefined,
        }),
      });
      setDraft(null);
      setPlate("");
      setCustomerName("");
      setCustomerPhone("");
      setEmployeeId("");
      setNotes("");
      load();
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : t("bay_calendar.save_failed"));
    } finally {
      setSaving(false);
    }
  }

  async function openJob(booking: Booking) {
    setSaving(true);
    setError("");
    try {
      const result = await api<Booking>(`/job-bookings/${booking.id}/open-job`, { method: "POST" });
      if (result.bill?.id) window.location.href = `/bills/${result.bill.id}`;
      else load();
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : t("bay_calendar.open_failed"));
      setSaving(false);
    }
  }

  async function addBay(event: FormEvent) {
    event.preventDefault();
    if (!bayName.trim()) return;
    setSaving(true);
    try {
      await api("/bays", { method: "POST", body: JSON.stringify({ name: bayName.trim() }) });
      setBayName("");
      load();
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : t("bay_calendar.save_failed"));
    } finally {
      setSaving(false);
    }
  }

  return (
    <AppShell
      title={t("bay_calendar.title")}
      eyebrow={t("bay_calendar.eyebrow")}
      action={sessionReady && allowed ? (
        <input type="date" value={date} onChange={(event) => setDate(event.target.value)} className={inputClass} />
      ) : undefined}
    >
      {!sessionReady ? <PageState message={t("bay_calendar.loading")} /> : !allowed ? (
        <PageState message={t("bay_calendar.locked")} />
      ) : (
      <>
      <p className="mb-5 max-w-2xl text-sm text-[#6f746e]">{t("bay_calendar.intro")}</p>
      {error && <ErrorMessage message={error} />}
      {loading || !day ? <PageState message={t("bay_calendar.loading")} /> : (
        <Panel className="overflow-x-auto">
          <table className="w-full min-w-[720px] border-collapse text-left text-sm">
            <thead className="bg-[#eeece5] text-[10px] uppercase text-[#6f746e]">
              <tr>
                <th className="sticky left-0 bg-[#eeece5] px-3 py-3">{t("bay_calendar.bay")}</th>
                {HOURS.map((hour) => <th key={hour} className="px-2 py-3 text-center">{hourLabel(hour)}</th>)}
              </tr>
            </thead>
            <tbody>
              {day.bays.map((bay) => (
                <tr key={bay.id} className="border-t border-[#e2ded4]">
                  <th className="sticky left-0 bg-[#fbfaf6] px-3 py-2 text-left text-sm font-semibold">{bay.name}</th>
                  {HOURS.map((hour) => {
                    const hit = (bookingsByBay.get(bay.id) ?? []).find((booking) => overlaps(booking, date, hour));
                    return (
                      <td key={hour} className="border-l border-[#eeeae0] p-1 align-top">
                        {hit ? (
                          <div className="min-h-14 bg-[#f5c842]/25 p-1.5">
                            <p className="font-semibold">{hit.number_plate}</p>
                            <p className="text-[11px] text-[#6f746e]">{hit.employee?.name ?? hit.customer?.name}</p>
                            {hit.bill ? (
                              <Link href={`/bills/${hit.bill.id}`} className="text-[11px] font-bold uppercase text-[#167c73]">{hit.bill.bill_number}</Link>
                            ) : (
                              <button type="button" onClick={() => openJob(hit)} className="text-[11px] font-bold uppercase text-[#167c73]">{t("bay_calendar.open_job")}</button>
                            )}
                          </div>
                        ) : (
                          <button type="button" onClick={() => setDraft({ bayId: bay.id, hour })} className="grid min-h-14 w-full place-items-center text-[#c9c5b9] hover:bg-[#167c73]/8 hover:text-[#167c73]">
                            <Plus size={14} />
                          </button>
                        )}
                      </td>
                    );
                  })}
                </tr>
              ))}
            </tbody>
          </table>
          {day.bays.length === 0 && <p className="p-8 text-center text-sm text-[#6f746e]">{t("bay_calendar.no_bays")}</p>}
        </Panel>
      )}

      {draft && (
        <div className="fixed inset-0 z-50 grid place-items-center bg-black/50 p-4" onClick={() => setDraft(null)}>
          <form onSubmit={createBooking} onClick={(event) => event.stopPropagation()} className="w-full max-w-md space-y-3 bg-[#f3f0e8] p-5">
            <h2 className="font-display text-2xl font-semibold uppercase">{t("bay_calendar.book_slot")}</h2>
            <p className="text-sm text-[#6f746e]">{formatDate(date)} · {hourLabel(draft.hour)}</p>
            <input required value={plate} onChange={(event) => setPlate(event.target.value)} className={inputClass} placeholder={t("bay_calendar.plate")} />
            <input value={customerName} onChange={(event) => setCustomerName(event.target.value)} className={inputClass} placeholder={t("common.customer")} />
            <input value={customerPhone} onChange={(event) => setCustomerPhone(event.target.value)} className={inputClass} placeholder={t("common.phone")} />
            <select value={employeeId} onChange={(event) => setEmployeeId(event.target.value)} className={inputClass}>
              <option value="">{t("bay_calendar.any_tech")}</option>
              {(day?.technicians ?? []).map((tech) => <option key={tech.id} value={tech.id}>{tech.name}</option>)}
            </select>
            <input value={notes} onChange={(event) => setNotes(event.target.value)} className={inputClass} placeholder={t("bay_calendar.notes")} />
            <div className="flex gap-2">
              <button type="button" onClick={() => setDraft(null)} className={`${buttonClass} flex-1 bg-white`}>{t("common.cancel")}</button>
              <button disabled={saving} className={`${buttonClass} flex-1`}>{saving ? t("common.saving") : t("bay_calendar.book")}</button>
            </div>
          </form>
        </div>
      )}

      <form onSubmit={addBay} className="mt-5 flex max-w-md gap-2">
        <input value={bayName} onChange={(event) => setBayName(event.target.value)} className={inputClass} placeholder={t("bay_calendar.new_bay")} />
        <button className={buttonClass}>{t("bay_calendar.add_bay")}</button>
      </form>
      </>
      )}
    </AppShell>
  );
}
