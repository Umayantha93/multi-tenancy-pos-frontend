"use client";

import { FormEvent, useCallback, useEffect, useState } from "react";
import { Droplets, Loader2, ScanBarcode } from "lucide-react";
import { AppShell } from "@/components/app-shell";
import { buttonClass, ConfirmModal, ErrorMessage, inputClass, PageState, Panel, SuccessMessage } from "@/components/ui";
import { api, formatDate, money } from "@/lib/api";
import { useBusinessProfile } from "@/lib/use-business-profile";
import { formatStockQty, stockAllowsDecimal, stockUnitLabel } from "@/lib/stock-unit";

type PartHit = {
  id: number;
  name: string;
  sku?: string | null;
  barcode?: string | null;
  brand?: string;
  cost_price?: string;
  stock_qty: number;
  stock_unit?: string | null;
};

type Issue = {
  id: number;
  part: { id: number; name: string; sku?: string | null; stock_unit?: string | null } | null;
  branch: { id: number; name: string } | null;
  quantity: number;
  returned_qty: number;
  unit_cost: string | number;
  service_names: string[];
  opened_at: string;
  closed_at: string | null;
  notes: string | null;
  opened_by: string | null;
  closed_by: string | null;
  can_void: boolean;
  washes: number;
  revenue: number | string;
  cost: number | string;
  cost_per_wash: number | string;
  profit: number | string;
  days: number;
  average_washes_per_unit?: number | null;
};

type Payload = {
  open: Issue[];
  history: { data: Issue[]; current_page: number; last_page: number };
  services: string[];
};

export default function StationUsePage() {
  const profile = useBusinessProfile();
  const isPaint = profile.type === "paint";

  const [open, setOpen] = useState<Issue[]>([]);
  const [history, setHistory] = useState<Issue[]>([]);
  const [historyPage, setHistoryPage] = useState(1);
  const [historyLastPage, setHistoryLastPage] = useState(1);
  const [services, setServices] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");

  const [query, setQuery] = useState("");
  const [hits, setHits] = useState<PartHit[]>([]);
  const [part, setPart] = useState<PartHit | null>(null);
  const [quantity, setQuantity] = useState("1");
  const [picked, setPicked] = useState<string[]>([]);
  const [notes, setNotes] = useState("");
  const [saving, setSaving] = useState(false);
  const [confirmPrevious, setConfirmPrevious] = useState<Issue | null>(null);

  const [leftover, setLeftover] = useState<Record<number, string>>({});
  const [busyId, setBusyId] = useState<number | null>(null);

  const load = useCallback((page = 1, append = false) => {
    api<Payload>(`/station-consumables?page=${page}`)
      .then((result) => {
        setOpen(result.open);
        setServices(result.services);
        setHistory((current) => (append ? [...current, ...result.history.data] : result.history.data));
        setHistoryPage(result.history.current_page || page);
        setHistoryLastPage(Math.max(1, result.history.last_page || 1));
      })
      .catch((caught: Error) => setError(caught.message))
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  useEffect(() => {
    const needle = query.trim();
    if (!needle || part) return;
    let cancelled = false;
    const timer = window.setTimeout(() => {
      api<{ data: PartHit[] }>(`/parts?search=${encodeURIComponent(needle)}&per_page=50`)
        .then((result) => { if (!cancelled) setHits(result.data); })
        .catch(() => { if (!cancelled) setHits([]); });
    }, 180);
    return () => {
      cancelled = true;
      window.clearTimeout(timer);
    };
  }, [query, part]);

  function choosePart(hit: PartHit) {
    setPart(hit);
    setQuery(hit.name);
    setHits([]);
    setQuantity("1");
  }

  function toggleService(name: string) {
    setPicked((current) => (current.includes(name) ? current.filter((item) => item !== name) : [...current, name]));
  }

  async function issue(closePrevious: boolean) {
    if (!part) return;
    setSaving(true);
    setError("");
    setNotice("");
    try {
      await api("/station-consumables", {
        method: "POST",
        body: JSON.stringify({
          part_id: part.id,
          quantity: Number(quantity),
          service_names: picked,
          notes: notes.trim() || null,
          close_previous: closePrevious || undefined,
        }),
      });
      setNotice(`${part.name} issued to the station. Stock reduced by ${formatStockQty(Number(quantity), part.stock_unit, isPaint)}.`);
      setPart(null);
      setQuery("");
      setQuantity("1");
      setNotes("");
      setConfirmPrevious(null);
      load();
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Could not issue this item.");
      setConfirmPrevious(null);
    } finally {
      setSaving(false);
    }
  }

  function submit(event: FormEvent) {
    event.preventDefault();
    if (!part) {
      setError("Pick the item you are opening.");
      return;
    }
    if (!(Number(quantity) > 0)) {
      setError("Enter the quantity issued.");
      return;
    }
    if (picked.length === 0) {
      setError("Tick the services that use this item.");
      return;
    }
    const previous = open.find((row) => row.part?.id === part.id);
    if (previous) {
      setConfirmPrevious(previous);
      return;
    }
    void issue(false);
  }

  async function finish(row: Issue) {
    const returned = leftover[row.id]?.trim() ?? "";
    if (returned !== "" && !(Number(returned) >= 0 && Number(returned) <= row.quantity)) {
      setError(`Leftover must be between 0 and ${row.quantity}.`);
      return;
    }
    setBusyId(row.id);
    setError("");
    setNotice("");
    try {
      await api(`/station-consumables/${row.id}/close`, {
        method: "POST",
        body: JSON.stringify({ returned_qty: returned === "" ? null : Number(returned) }),
      });
      setNotice(`${row.part?.name ?? "Item"} marked finished.`);
      setLeftover((current) => ({ ...current, [row.id]: "" }));
      load();
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Could not mark finished.");
    } finally {
      setBusyId(null);
    }
  }

  async function voidIssue(row: Issue) {
    setBusyId(row.id);
    setError("");
    setNotice("");
    try {
      await api(`/station-consumables/${row.id}`, { method: "DELETE" });
      setNotice(`${row.part?.name ?? "Item"} issue voided. Stock returned.`);
      load();
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Could not void.");
    } finally {
      setBusyId(null);
    }
  }

  const decimal = part ? stockAllowsDecimal(part.stock_unit, isPaint) : false;
  const label = "block text-[10px] font-bold uppercase text-[#6f746e]";

  return (
    <AppShell title="Station use" eyebrow="Bulk tins opened for the wash bay">
      <div className="space-y-4">
        {error && <ErrorMessage message={error} />}
        {notice && <SuccessMessage message={notice} />}

        <Panel className="p-4">
          <h2 className="font-display text-lg font-semibold uppercase">Issue to station</h2>
          <p className="mt-0.5 text-xs text-[#6f746e]">
            Stock drops now. Washes billed while it is in use are counted to work out cost per wash.
          </p>
          <form onSubmit={submit} className="mt-3 grid gap-3 lg:grid-cols-[minmax(0,2fr)_8rem_minmax(0,1fr)]">
            <label className={label}>
              Item
              {part ? (
                <div className="mt-1 flex h-8 items-center justify-between gap-2 border border-[#c9c5b9] bg-white px-2 text-[11px] font-normal normal-case">
                  <span className="min-w-0 truncate">
                    <span className="font-semibold">{part.name}</span>
                    <span className="ml-1 text-[#6f746e]">· stock {formatStockQty(part.stock_qty, part.stock_unit, isPaint)} · cost {money(part.cost_price || 0)}</span>
                  </span>
                  <button type="button" className="shrink-0 text-[10px] text-[#167c73] underline" onClick={() => { setPart(null); setQuery(""); }}>
                    Change
                  </button>
                </div>
              ) : (
                <div className="relative mt-1">
                  <ScanBarcode className="pointer-events-none absolute left-2 top-1/2 -translate-y-1/2 text-[#6f746e]" size={13} />
                  <input
                    value={query}
                    onChange={(event) => { setQuery(event.target.value); setError(""); if (!event.target.value.trim()) setHits([]); }}
                    className={`${inputClass} pl-7 font-normal normal-case`}
                    placeholder="Scan or type item name / SKU (e.g. Hypower 20L)"
                    autoComplete="off"
                  />
                  {query.trim() !== "" && hits.length > 0 && (
                    <ul className="absolute z-30 mt-0.5 max-h-64 w-full overflow-auto border border-[#d7d3c8] bg-white text-[11px] font-normal normal-case shadow-lg">
                      {hits.map((hit) => (
                        <li key={hit.id}>
                          <button
                            type="button"
                            onClick={() => choosePart(hit)}
                            className="flex w-full items-center justify-between gap-2 px-2 py-1.5 text-left hover:bg-[#eeece5]"
                          >
                            <span className="min-w-0 truncate">
                              <span className="font-semibold">{hit.name}</span>
                              <span className="block text-[9px] text-[#6f746e]">{[hit.barcode, hit.sku, hit.brand].filter(Boolean).join(" · ")}</span>
                            </span>
                            <span className="shrink-0 text-right tabular-nums text-[10px]">{formatStockQty(hit.stock_qty, hit.stock_unit, isPaint)}</span>
                          </button>
                        </li>
                      ))}
                    </ul>
                  )}
                </div>
              )}
            </label>
            <label className={label}>
              Quantity {part && <span className="normal-case">({stockUnitLabel(part.stock_unit, isPaint)})</span>}
              <input
                type="number"
                min={decimal ? "0.001" : "1"}
                step={decimal ? "0.001" : "1"}
                value={quantity}
                onChange={(event) => setQuantity(event.target.value)}
                disabled={!part}
                className={`${inputClass} mt-1 font-normal normal-case tabular-nums disabled:bg-[#eeece5]`}
              />
            </label>
            <label className={label}>
              Note
              <input
                value={notes}
                onChange={(event) => setNotes(event.target.value)}
                maxLength={500}
                className={`${inputClass} mt-1 font-normal normal-case`}
                placeholder="Optional"
              />
            </label>
            <div className="lg:col-span-3">
              <p className={label}>Used by these services</p>
              {services.length === 0 ? (
                <p className="mt-1 text-[11px] text-[#6f746e]">No service addons yet. Add them under Service addons first.</p>
              ) : (
                <div className="mt-1 flex flex-wrap gap-1.5">
                  {services.map((name) => (
                    <label
                      key={name}
                      className={`inline-flex h-7 cursor-pointer items-center gap-1.5 border px-2 text-[11px] ${picked.includes(name) ? "border-[#167c73] bg-[#167c73]/10 font-semibold text-[#167c73]" : "border-[#c9c5b9] bg-white"}`}
                    >
                      <input type="checkbox" checked={picked.includes(name)} onChange={() => toggleService(name)} className="size-3.5 accent-[#167c73]" />
                      {name}
                    </label>
                  ))}
                </div>
              )}
            </div>
            <div className="lg:col-span-3">
              <button type="submit" disabled={saving || !part || picked.length === 0} className={buttonClass}>
                {saving ? <Loader2 className="animate-spin" size={16} /> : <Droplets size={16} />}
                {saving ? "Issuing…" : "Issue to station"}
              </button>
            </div>
          </form>
        </Panel>

        <section>
          <h2 className="mb-2 font-display text-lg font-semibold uppercase">In use</h2>
          {loading ? (
            <PageState message="Loading…" />
          ) : open.length === 0 ? (
            <PageState message="No tins open at the station." />
          ) : (
            <div className="grid gap-3 md:grid-cols-2">
              {open.map((row) => {
                const unit = row.part?.stock_unit;
                const expected = row.average_washes_per_unit ? Math.round(row.average_washes_per_unit * row.quantity) : null;
                const nearEnd = expected !== null && row.washes >= expected * 0.85;
                return (
                  <Panel key={row.id} className={`p-3 ${nearEnd ? "border-[#b8860b]" : ""}`}>
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0">
                        <p className="truncate font-semibold">{row.part?.name ?? "Deleted item"}</p>
                        <p className="text-[11px] text-[#6f746e]">
                          {formatStockQty(row.quantity, unit, isPaint)} · opened {formatDate(row.opened_at)} · {row.days} day{row.days === 1 ? "" : "s"}
                          {row.branch ? ` · ${row.branch.name}` : ""}
                        </p>
                      </div>
                      {row.can_void && (
                        <button
                          type="button"
                          disabled={busyId === row.id}
                          onClick={() => void voidIssue(row)}
                          className="shrink-0 text-[10px] font-semibold text-[#b84837] underline"
                        >
                          Void
                        </button>
                      )}
                    </div>
                    <div className="mt-1.5 flex flex-wrap gap-1">
                      {row.service_names.map((name) => (
                        <span key={name} className="bg-[#eeece5] px-1.5 py-0.5 text-[9px] font-bold uppercase text-[#6f746e]">{name}</span>
                      ))}
                    </div>
                    <div className="mt-2 grid grid-cols-4 gap-2 border-t border-[#e8e4da] pt-2 text-[11px]">
                      <Stat label="Washes" value={String(row.washes)} />
                      <Stat label="Cost" value={money(row.cost)} />
                      <Stat label="Per wash" value={row.washes > 0 ? money(row.cost_per_wash) : "—"} />
                      <Stat label="Revenue" value={money(row.revenue)} />
                    </div>
                    {expected !== null && (
                      <p className={`mt-1.5 text-[10px] ${nearEnd ? "font-semibold text-[#735a00]" : "text-[#6f746e]"}`}>
                        Usually about {expected} washes per tin
                        {nearEnd ? " — nearly finished, get the next one ready." : ` · ${Math.max(0, expected - Math.round(row.washes))} to go.`}
                      </p>
                    )}
                    <div className="mt-2 flex flex-wrap items-center gap-2">
                      <input
                        type="number"
                        min="0"
                        max={row.quantity}
                        step={stockAllowsDecimal(unit, isPaint) ? "0.001" : "1"}
                        value={leftover[row.id] ?? ""}
                        onChange={(event) => setLeftover((current) => ({ ...current, [row.id]: event.target.value }))}
                        className={`${inputClass} w-40`}
                        placeholder={`Leftover ${stockUnitLabel(unit, isPaint)} (optional)`}
                        aria-label="Leftover returned to stock"
                      />
                      <button type="button" disabled={busyId === row.id} onClick={() => void finish(row)} className={buttonClass}>
                        {busyId === row.id && <Loader2 className="animate-spin" size={14} />}
                        Mark finished
                      </button>
                    </div>
                  </Panel>
                );
              })}
            </div>
          )}
        </section>

        <Panel className="p-3">
          <h2 className="font-display text-lg font-semibold uppercase">Finished tins</h2>
          <div className="mt-2 overflow-x-auto">
            <table className="w-full min-w-[760px] text-left text-[11px]">
              <thead className="bg-[#eeece5] text-[9px] font-bold uppercase tracking-wide text-[#6f746e]">
                <tr>
                  <th className="px-2 py-1.5">Item</th>
                  <th className="px-2 py-1.5">Opened → finished</th>
                  <th className="px-2 py-1.5 text-right">Days</th>
                  <th className="px-2 py-1.5 text-right">Used</th>
                  <th className="px-2 py-1.5 text-right">Washes</th>
                  <th className="px-2 py-1.5 text-right">Cost</th>
                  <th className="px-2 py-1.5 text-right">Per wash</th>
                  <th className="px-2 py-1.5 text-right">Revenue</th>
                  <th className="px-2 py-1.5 text-right">Profit</th>
                </tr>
              </thead>
              <tbody>
                {history.map((row) => (
                  <tr key={row.id} className="border-t border-[#e8e4da]">
                    <td className="px-2 py-1.5">
                      <p className="font-semibold">{row.part?.name ?? "Deleted item"}</p>
                      <p className="text-[9px] text-[#6f746e]">{row.service_names.join(", ")}</p>
                    </td>
                    <td className="px-2 py-1.5">{formatDate(row.opened_at)} → {formatDate(row.closed_at)}</td>
                    <td className="px-2 py-1.5 text-right tabular-nums">{row.days}</td>
                    <td className="px-2 py-1.5 text-right tabular-nums">{formatStockQty(row.quantity - row.returned_qty, row.part?.stock_unit, isPaint)}</td>
                    <td className="px-2 py-1.5 text-right tabular-nums">{row.washes}</td>
                    <td className="px-2 py-1.5 text-right tabular-nums">{money(row.cost)}</td>
                    <td className="px-2 py-1.5 text-right tabular-nums">{row.washes > 0 ? money(row.cost_per_wash) : "—"}</td>
                    <td className="px-2 py-1.5 text-right tabular-nums">{money(row.revenue)}</td>
                    <td className={`px-2 py-1.5 text-right font-semibold tabular-nums ${Number(row.profit) < 0 ? "text-[#b84837]" : "text-[#167c73]"}`}>{money(row.profit)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
            {!loading && history.length === 0 && <p className="p-4 text-center text-[11px] text-[#6f746e]">No finished tins yet.</p>}
          </div>
          {historyPage < historyLastPage && (
            <button type="button" onClick={() => load(historyPage + 1, true)} className="mt-2 text-xs font-semibold text-[#167c73]">
              Load more
            </button>
          )}
        </Panel>
      </div>

      <ConfirmModal
        open={Boolean(confirmPrevious)}
        title="Previous tin still open"
        message={confirmPrevious
          ? `The ${confirmPrevious.part?.name ?? "item"} opened on ${formatDate(confirmPrevious.opened_at)} is still in use (${confirmPrevious.washes} washes). Mark it finished and open the new one?`
          : ""}
        confirmLabel="Finish it and issue new"
        busy={saving}
        onCancel={() => { if (!saving) setConfirmPrevious(null); }}
        onConfirm={() => void issue(true)}
      />
    </AppShell>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="min-w-0">
      <p className="text-[9px] font-bold uppercase text-[#6f746e]">{label}</p>
      <p className="truncate font-semibold tabular-nums">{value}</p>
    </div>
  );
}
