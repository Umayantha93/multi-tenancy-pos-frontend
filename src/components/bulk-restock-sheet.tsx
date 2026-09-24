"use client";

import { FormEvent, KeyboardEvent, useEffect, useMemo, useRef, useState } from "react";
import { Loader2, Plus, ScanBarcode, Trash2, X } from "lucide-react";
import { buttonClass, ErrorMessage } from "@/components/ui";
import { api, money } from "@/lib/api";
import { formatStockQty, stockAllowsDecimal, stockUnitLabel } from "@/lib/stock-unit";

type Supplier = { id: number; name: string; is_system?: boolean };

type PartHit = {
  id: number;
  name: string;
  sku?: string | null;
  barcode?: string | null;
  brand?: string;
  price?: string;
  cost_price?: string;
  stock_qty: number;
  stock_unit?: string | null;
  serialized?: boolean;
};

type SheetRow = {
  key: string;
  part: PartHit | null;
  query: string;
  quantity: string;
  unitCost: string;
  sellPrice: string;
  isFree: boolean;
  savedUnitCost: string;
  supplierId: string;
  paymentStatus: "paid" | "credit";
  dueDate: string;
  expenseDate: string;
  serials: string;
};

function emptyRow(key: string, defaults: { supplierId: string; expenseDate: string }): SheetRow {
  return {
    key,
    part: null,
    query: "",
    quantity: "",
    unitCost: "",
    sellPrice: "",
    isFree: false,
    savedUnitCost: "",
    supplierId: defaults.supplierId,
    paymentStatus: "paid",
    dueDate: "",
    expenseDate: defaults.expenseDate,
    serials: "",
  };
}

export function BulkRestockSheet({
  open,
  onClose,
  onDone,
  suppliers,
  isGarage,
  isPaint,
  canSerial,
}: {
  open: boolean;
  onClose: () => void;
  onDone: (count: number) => void;
  suppliers: Supplier[];
  isGarage: boolean;
  isPaint: boolean;
  canSerial: boolean;
}) {
  const rowSeq = useRef(0);
  const defaultSupplier = useMemo(() => {
    if (!isGarage) return "";
    return String(suppliers.find((row) => row.is_system)?.id ?? suppliers[0]?.id ?? "");
  }, [suppliers, isGarage]);
  const today = new Date().toISOString().slice(0, 10);

  const [rows, setRows] = useState<SheetRow[]>([]);
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);
  const [suggestions, setSuggestions] = useState<Record<string, PartHit[]>>({});
  const [activeKey, setActiveKey] = useState<string | null>(null);

  useEffect(() => {
    if (!open) return;
    rowSeq.current = 0;
    const defaults = { supplierId: defaultSupplier, expenseDate: today };
    setRows(Array.from({ length: 5 }, () => emptyRow(`r-${++rowSeq.current}`, defaults)));
    setError("");
    setSuggestions({});
    setActiveKey(null);
  }, [open, defaultSupplier, today]);

  useEffect(() => {
    if (!open || !activeKey) return;
    const row = rows.find((item) => item.key === activeKey);
    const needle = row?.query.trim() ?? "";
    if (!needle || row?.part) {
      setSuggestions((current) => ({ ...current, [activeKey]: [] }));
      return;
    }
    let cancelled = false;
    const timer = window.setTimeout(() => {
      api<{ data: PartHit[] }>(`/parts?search=${encodeURIComponent(needle)}&per_page=20`)
        .then((result) => {
          if (!cancelled) setSuggestions((current) => ({ ...current, [activeKey]: result.data }));
        })
        .catch(() => {
          if (!cancelled) setSuggestions((current) => ({ ...current, [activeKey]: [] }));
        });
    }, 180);
    return () => {
      cancelled = true;
      window.clearTimeout(timer);
    };
  }, [open, activeKey, rows]);

  const filled = useMemo(() => rows.filter((row) => row.part), [rows]);
  const grandTotal = useMemo(
    () => filled.reduce((sum, row) => {
      const qty = Number(row.quantity) || 0;
      const cost = Number(row.unitCost) || 0;
      return sum + qty * cost;
    }, 0),
    [filled],
  );

  function patchRow(key: string, patch: Partial<SheetRow>) {
    setRows((current) => current.map((row) => (row.key === key ? { ...row, ...patch } : row)));
  }

  function selectPart(key: string, part: PartHit) {
    const cost = part.cost_price ? String(Number(part.cost_price)) : "";
    setRows((current) => current.map((row) => {
      if (row.key !== key) return row;
      return {
        ...row,
        part,
        query: part.name,
        unitCost: row.isFree ? "0" : cost,
        savedUnitCost: cost,
        sellPrice: part.price ? String(Number(part.price)) : "",
      };
    }));
    setSuggestions((current) => ({ ...current, [key]: [] }));
    setActiveKey(null);
  }

  function clearPart(key: string) {
    patchRow(key, {
      part: null,
      query: "",
      unitCost: "",
      sellPrice: "",
      quantity: "",
      serials: "",
      isFree: false,
      savedUnitCost: "",
    });
    setActiveKey(key);
  }

  function toggleFree(key: string, next: boolean) {
    setRows((current) => current.map((row) => {
      if (row.key !== key) return row;
      if (next) {
        return {
          ...row,
          isFree: true,
          savedUnitCost: row.unitCost || row.savedUnitCost,
          unitCost: "0",
          paymentStatus: "paid",
          dueDate: "",
        };
      }
      return {
        ...row,
        isFree: false,
        unitCost: row.savedUnitCost || (row.part?.cost_price ? String(Number(row.part.cost_price)) : ""),
      };
    }));
  }

  async function resolveExact(needle: string): Promise<PartHit | null> {
    try {
      const byBarcode = await api<{ data: PartHit[] }>(`/parts?barcode=${encodeURIComponent(needle)}&per_page=1`);
      if (byBarcode.data[0]) return byBarcode.data[0];
      const search = await api<{ data: PartHit[] }>(`/parts?search=${encodeURIComponent(needle)}&per_page=20`);
      return search.data.find((part) =>
        part.barcode?.toLowerCase() === needle.toLowerCase()
        || part.sku?.toLowerCase() === needle.toLowerCase()
        || part.name.toLowerCase() === needle.toLowerCase(),
      ) ?? (search.data.length === 1 ? search.data[0] : null);
    } catch {
      return null;
    }
  }

  async function onItemKey(key: string, event: KeyboardEvent<HTMLInputElement>) {
    if (event.key !== "Enter") return;
    event.preventDefault();
    const needle = rows.find((row) => row.key === key)?.query.trim() ?? "";
    if (!needle) return;
    const match = await resolveExact(needle);
    if (match) selectPart(key, match);
    else setError("No inventory match for that barcode / SKU / name.");
  }

  function addRow() {
    setRows((current) => [
      ...current,
      emptyRow(`r-${++rowSeq.current}`, { supplierId: defaultSupplier, expenseDate: today }),
    ]);
  }

  function removeRow(key: string) {
    setRows((current) => (current.length <= 1
      ? [emptyRow(`r-${++rowSeq.current}`, { supplierId: defaultSupplier, expenseDate: today })]
      : current.filter((row) => row.key !== key)));
  }

  async function submit(event: FormEvent) {
    event.preventDefault();
    setError("");
    const payload = filled.map((row) => {
      const serials = row.serials
        .split(/[\n,;]+/)
        .map((code) => code.trim())
        .filter(Boolean);
      const body: Record<string, unknown> = {
        part_id: row.part!.id,
        unit_cost: row.isFree ? 0 : (row.unitCost === "" ? undefined : Number(row.unitCost)),
        price: row.sellPrice === "" ? undefined : Number(row.sellPrice),
        is_free: row.isFree || undefined,
        supplier_id: row.supplierId || undefined,
        payment_status: row.isFree ? "paid" : row.paymentStatus,
        expense_date: row.expenseDate || today,
      };
      if (!row.isFree && row.paymentStatus === "credit") body.due_date = row.dueDate || undefined;
      if (serials.length) body.serials = serials;
      else body.quantity = Number(row.quantity);
      return body;
    });

    if (payload.length === 0) {
      setError("Select at least one item and enter quantity.");
      return;
    }
    for (const [index, row] of filled.entries()) {
      if (isGarage && !row.supplierId) {
        setError(`Row ${index + 1}: pick a supplier.`);
        return;
      }
      const serials = row.serials.split(/[\n,;]+/).map((code) => code.trim()).filter(Boolean);
      if (canSerial && row.part?.serialized && serials.length === 0) {
        setError(`Row ${index + 1}: enter IMEIs / serials.`);
        return;
      }
      if (serials.length === 0 && !(Number(row.quantity) > 0)) {
        setError(`Row ${index + 1}: enter quantity to add.`);
        return;
      }
      if (!row.isFree && row.paymentStatus === "credit" && !row.dueDate) {
        setError(`Row ${index + 1}: due date required for credit.`);
        return;
      }
    }

    setSaving(true);
    try {
      const result = await api<{ restocked: number }>("/parts/restock/bulk", {
        method: "POST",
        body: JSON.stringify({ items: payload }),
      });
      onDone(result.restocked);
      onClose();
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Bulk restock failed.");
    } finally {
      setSaving(false);
    }
  }

  if (!open) return null;

  const cell = "h-7 w-full border border-[#c9c5b9] bg-white px-1.5 text-[11px] outline-none focus:border-[#167c73] disabled:bg-[#eeece5] disabled:opacity-70";
  const cellSm = `${cell} w-[4.5rem]`;
  const cellMd = `${cell} w-[5.5rem]`;
  const cellDate = `${cell} w-[7.25rem]`;
  const td = "border-b border-[#e8e4da] px-1 py-1 align-middle";

  return (
    <div className="fixed inset-0 z-50 flex bg-black/55 p-1 sm:p-2" onClick={() => { if (!saving) onClose(); }}>
      <form
        onSubmit={submit}
        onClick={(event) => event.stopPropagation()}
        aria-busy={saving}
        className="relative flex h-full w-full flex-col bg-[#f3f0e8]"
      >
        {saving && (
          <div className="absolute inset-0 z-10 grid place-items-center bg-[#f3f0e8]/80" role="status" aria-live="polite">
            <Loader2 className="animate-spin text-[#167c73]" size={36} />
          </div>
        )}
        <div className="flex shrink-0 items-center justify-between border-b border-[#d7d3c8] px-3 py-2">
          <div>
            <h2 className="font-display text-xl font-semibold uppercase sm:text-2xl">Bulk restock</h2>
            <p className="text-xs text-[#6f746e]">Scan or type item name / SKU, then fill qty and cost like a spreadsheet.</p>
          </div>
          <button type="button" onClick={onClose} disabled={saving} aria-label="Close"><X size={20} /></button>
        </div>

        <div className="min-h-0 flex-1 overflow-auto p-2">
          {error && <div className="mb-2"><ErrorMessage message={error} /></div>}
          <div className="overflow-x-auto border border-[#d7d3c8] bg-white">
            <table className="w-full min-w-[980px] border-collapse text-left text-[11px]">
              <thead className="bg-[#eeece5] text-[9px] font-bold uppercase tracking-wide text-[#6f746e]">
                <tr>
                  <th className="border-b border-[#d7d3c8] px-1 py-1.5 w-7">#</th>
                  <th className="border-b border-[#d7d3c8] px-1 py-1.5 min-w-[160px]">Item</th>
                  <th className="border-b border-[#d7d3c8] px-1 py-1.5 w-10 text-center">Free</th>
                  <th className="border-b border-[#d7d3c8] px-1 py-1.5">Qty</th>
                  <th className="border-b border-[#d7d3c8] px-1 py-1.5">Unit</th>
                  <th className="border-b border-[#d7d3c8] px-1 py-1.5">Cost</th>
                  <th className="border-b border-[#d7d3c8] px-1 py-1.5">Sell</th>
                  <th className="border-b border-[#d7d3c8] px-1 py-1.5 min-w-[110px]">Supplier</th>
                  <th className="border-b border-[#d7d3c8] px-1 py-1.5">Pay</th>
                  <th className="border-b border-[#d7d3c8] px-1 py-1.5">Due</th>
                  <th className="border-b border-[#d7d3c8] px-1 py-1.5">Exp. date</th>
                  {canSerial && <th className="border-b border-[#d7d3c8] px-1 py-1.5 min-w-[100px]">Serials</th>}
                  <th className="border-b border-[#d7d3c8] px-1 py-1.5 text-right">Total</th>
                  <th className="border-b border-[#d7d3c8] px-1 py-1.5 w-7" />
                </tr>
              </thead>
              <tbody>
                {rows.map((row, index) => {
                  const qty = Number(row.quantity) || 0;
                  const cost = row.isFree ? 0 : (Number(row.unitCost) || 0);
                  const lineTotal = qty * cost;
                  const hits = suggestions[row.key] ?? [];
                  return (
                    <tr key={row.key} className={`odd:bg-[#fbfaf6] ${row.isFree ? "bg-[#e8f5f3]" : ""}`}>
                      <td className={`${td} tabular-nums text-[#6f746e]`}>{index + 1}</td>
                      <td className={td}>
                        {row.part ? (
                          <div className="flex items-center justify-between gap-1">
                            <div className="min-w-0">
                              <p className="truncate text-[11px] font-semibold leading-tight">
                                {row.part.name}
                                {row.isFree && <span className="ml-1 text-[9px] font-bold uppercase text-[#167c73]">gift</span>}
                              </p>
                              <p className="truncate text-[9px] leading-tight text-[#6f746e]">
                                {[row.part.barcode, row.part.sku, row.part.brand].filter(Boolean).join(" · ")}
                              </p>
                            </div>
                            <button type="button" className="shrink-0 text-[10px] text-[#167c73] underline" onClick={() => clearPart(row.key)}>Change</button>
                          </div>
                        ) : (
                          <div className="relative">
                            <ScanBarcode className="pointer-events-none absolute left-1.5 top-1/2 -translate-y-1/2 text-[#6f746e]" size={12} />
                            <input
                              value={row.query}
                              onChange={(event) => {
                                patchRow(row.key, { query: event.target.value });
                                setActiveKey(row.key);
                                setError("");
                              }}
                              onFocus={() => setActiveKey(row.key)}
                              onKeyDown={(event) => void onItemKey(row.key, event)}
                              className={`${cell} pl-6`}
                              placeholder="Scan / name / SKU"
                              autoComplete="off"
                            />
                            {activeKey === row.key && hits.length > 0 && (
                              <ul className="absolute z-20 mt-0.5 max-h-40 w-full overflow-auto border border-[#d7d3c8] bg-white shadow-sm">
                                {hits.map((hit) => (
                                  <li key={hit.id}>
                                    <button
                                      type="button"
                                      className="flex w-full items-center justify-between gap-2 px-2 py-1.5 text-left hover:bg-[#eeece5]"
                                      onClick={() => selectPart(row.key, hit)}
                                    >
                                      <span className="min-w-0 truncate">
                                        <span className="font-semibold">{hit.name}</span>
                                        <span className="block text-[9px] text-[#6f746e]">
                                          {[hit.barcode, hit.sku, hit.brand].filter(Boolean).join(" · ")}
                                        </span>
                                      </span>
                                      <span className="shrink-0 tabular-nums text-[10px]">{money(hit.cost_price || 0)}</span>
                                    </button>
                                  </li>
                                ))}
                              </ul>
                            )}
                          </div>
                        )}
                      </td>
                      <td className={`${td} text-center`}>
                        <input
                          type="checkbox"
                          checked={row.isFree}
                          disabled={!row.part}
                          onChange={(event) => toggleFree(row.key, event.target.checked)}
                          className="size-3.5 accent-[#167c73]"
                          title="Supplier free / gift — no cost"
                          aria-label="Free gift"
                        />
                      </td>
                      <td className={td}>
                        <input
                          type="number"
                          min={row.part && stockAllowsDecimal(row.part.stock_unit, isPaint) ? "0.001" : "1"}
                          step={row.part && stockAllowsDecimal(row.part.stock_unit, isPaint) ? "0.001" : "1"}
                          value={row.quantity}
                          onChange={(event) => patchRow(row.key, { quantity: event.target.value })}
                          disabled={!row.part || (canSerial && Boolean(row.part.serialized))}
                          className={cellSm}
                        />
                      </td>
                      <td className={`${td} text-[9px] font-semibold uppercase text-[#6f746e]`}>
                        {row.part ? stockUnitLabel(row.part.stock_unit, isPaint) : "—"}
                      </td>
                      <td className={td}>
                        <input
                          type="number"
                          min="0"
                          step="0.01"
                          value={row.unitCost}
                          onChange={(event) => patchRow(row.key, { unitCost: event.target.value, savedUnitCost: event.target.value })}
                          disabled={!row.part || row.isFree}
                          className={cellMd}
                        />
                      </td>
                      <td className={td}>
                        <input
                          type="number"
                          min="0"
                          step="0.01"
                          value={row.sellPrice}
                          onChange={(event) => patchRow(row.key, { sellPrice: event.target.value })}
                          disabled={!row.part}
                          className={cellMd}
                        />
                      </td>
                      <td className={td}>
                        {suppliers.length > 0 ? (
                          <select
                            value={row.supplierId}
                            onChange={(event) => patchRow(row.key, { supplierId: event.target.value })}
                            disabled={!row.part}
                            required={isGarage && Boolean(row.part)}
                            className={cell}
                          >
                            {!isGarage && <option value="">No supplier</option>}
                            {suppliers.map((supplier) => (
                              <option key={supplier.id} value={supplier.id}>{supplier.name}</option>
                            ))}
                          </select>
                        ) : (
                          <span className="text-[#6f746e]">—</span>
                        )}
                      </td>
                      <td className={td}>
                        <select
                          value={row.paymentStatus}
                          onChange={(event) => patchRow(row.key, { paymentStatus: event.target.value as "paid" | "credit" })}
                          disabled={!row.part || row.isFree}
                          className={`${cell} w-[4.75rem]`}
                        >
                          <option value="paid">Paid</option>
                          <option value="credit">Credit</option>
                        </select>
                      </td>
                      <td className={td}>
                        <input
                          type="date"
                          value={row.dueDate}
                          onChange={(event) => patchRow(row.key, { dueDate: event.target.value })}
                          disabled={!row.part || row.isFree || row.paymentStatus !== "credit"}
                          className={cellDate}
                        />
                      </td>
                      <td className={td}>
                        <input
                          type="date"
                          value={row.expenseDate}
                          onChange={(event) => patchRow(row.key, { expenseDate: event.target.value })}
                          disabled={!row.part}
                          className={cellDate}
                        />
                      </td>
                      {canSerial && (
                        <td className={td}>
                          <textarea
                            rows={1}
                            value={row.serials}
                            onChange={(event) => {
                              const serials = event.target.value;
                              const count = serials.split(/[\n,;]+/).map((code) => code.trim()).filter(Boolean).length;
                              patchRow(row.key, {
                                serials,
                                quantity: row.part?.serialized ? String(count || "") : row.quantity,
                              });
                            }}
                            disabled={!row.part || !row.part.serialized}
                            placeholder={row.part?.serialized ? "IMEIs" : "—"}
                            className={`${cell} h-7 min-h-7 resize-y py-1`}
                          />
                        </td>
                      )}
                      <td className={`${td} whitespace-nowrap text-right text-[11px] font-semibold tabular-nums`}>
                        {row.part ? money(lineTotal) : "—"}
                      </td>
                      <td className={td}>
                        <button type="button" className="grid size-6 place-items-center text-[#b84837]" onClick={() => removeRow(row.key)} aria-label="Remove row">
                          <Trash2 size={12} />
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
          <button type="button" onClick={addRow} className="mt-2 flex items-center gap-1 text-xs font-semibold text-[#167c73]">
            <Plus size={14} /> Add row
          </button>
        </div>

        <div className="flex shrink-0 flex-wrap items-center justify-between gap-2 border-t border-[#d7d3c8] px-3 py-2">
          <div>
            <p className="text-[9px] font-bold uppercase text-[#6f746e]">Sheet total</p>
            <p className="font-display text-xl font-semibold tabular-nums leading-tight">{money(grandTotal)}</p>
            <p className="text-[10px] text-[#6f746e]">
              {filled.length} item{filled.length === 1 ? "" : "s"}
              {filled[0] ? ` · e.g. stock now ${formatStockQty(filled[0].part!.stock_qty, filled[0].part!.stock_unit, isPaint)}` : ""}
            </p>
          </div>
          <div className="flex gap-2">
            <button type="button" disabled={saving} onClick={onClose} className="h-8 border border-[#20221f] bg-white px-3 text-[11px] font-semibold">Cancel</button>
            <button type="submit" disabled={saving || filled.length === 0} className={buttonClass}>
              {saving && <Loader2 className="animate-spin" size={16} />}
              {saving ? "Saving…" : "Restock all"}
            </button>
          </div>
        </div>
      </form>
    </div>
  );
}
