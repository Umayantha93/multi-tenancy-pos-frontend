"use client";

import { CSSProperties, FormEvent, KeyboardEvent, useCallback, useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import Link from "next/link";
import { ArrowLeft, ChevronDown, ChevronRight, Loader2, Plus, ScanBarcode, Search, Trash2 } from "lucide-react";
import { AppShell } from "@/components/app-shell";
import { buttonClass, ErrorMessage, inputClass, Panel, SuccessMessage } from "@/components/ui";
import { api, currentFeatures, formatDate, money } from "@/lib/api";
import { useBusinessProfile } from "@/lib/use-business-profile";
import { formatStockQty, stockAllowsDecimal, stockUnitLabel } from "@/lib/stock-unit";

type Supplier = { id: number; name: string; is_system?: boolean };

type PartHit = {
  id: number;
  name: string;
  sku?: string | null;
  barcode?: string | null;
  brand?: string;
  price?: string;
  pending_price?: string | null;
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
  afterOldStock: boolean;
  isFree: boolean;
  savedUnitCost: string;
  serials: string;
};

type Receipt = {
  id: number;
  receipt_number: string;
  invoice_number: string;
  received_at: string | null;
  payment_status: string;
  due_date: string | null;
  supplier: { id: number; name: string } | null;
  total: number | string;
  items: Array<{
    id: number;
    name: string;
    sku?: string | null;
    stock_unit?: string | null;
    quantity: number;
    unit_cost: string | number;
    line_total: number | string;
  }>;
};

type ReceiptsPage = { data: Receipt[]; current_page: number; last_page: number; total: number };

const SEARCH_LIMIT = 50;

function emptyRow(key: string): SheetRow {
  return { key, part: null, query: "", quantity: "", unitCost: "", sellPrice: "", afterOldStock: true, isFree: false, savedUnitCost: "", serials: "" };
}

function sellPriceChanged(row: SheetRow): boolean {
  if (!row.part || row.sellPrice === "") return false;
  return Number(row.sellPrice) !== Number(row.part.price ?? 0) && Number(row.part.stock_qty) > 0;
}

function parseSerials(raw: string): string[] {
  return raw.split(/[\n,;]+/).map((code) => code.trim()).filter(Boolean);
}

export default function BulkRestockPage() {
  const profile = useBusinessProfile();
  const isPaint = profile.type === "paint";
  const isGarage = profile.type === "garage";
  const rowSeq = useRef(0);
  const nextKey = () => `r-${++rowSeq.current}`;

  const [suppliers, setSuppliers] = useState<Supplier[]>([]);
  const [canSerial, setCanSerial] = useState(false);
  const [invoiceNumber, setInvoiceNumber] = useState("");
  const [supplierId, setSupplierId] = useState("");
  const [paymentStatus, setPaymentStatus] = useState<"paid" | "credit">("paid");
  const [dueDate, setDueDate] = useState("");

  const [rows, setRows] = useState<SheetRow[]>(() => Array.from({ length: 5 }, (_, index) => emptyRow(`r-init-${index}`)));
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [saving, setSaving] = useState(false);
  const [suggestions, setSuggestions] = useState<Record<string, PartHit[]>>({});
  const [searchingKey, setSearchingKey] = useState<string | null>(null);
  const [activeKey, setActiveKey] = useState<string | null>(null);
  const [dropdown, setDropdown] = useState<CSSProperties | null>(null);
  const itemInputs = useRef<Record<string, HTMLInputElement | null>>({});

  const [receipts, setReceipts] = useState<Receipt[]>([]);
  const [receiptSearch, setReceiptSearch] = useState("");
  const [receiptPage, setReceiptPage] = useState(1);
  const [receiptLastPage, setReceiptLastPage] = useState(1);
  const [receiptsLoading, setReceiptsLoading] = useState(false);
  const [openReceiptId, setOpenReceiptId] = useState<number | null>(null);
  const receiptSeq = useRef(0);

  useEffect(() => {
    const frame = requestAnimationFrame(() => {
      const features = currentFeatures();
      setCanSerial(features.includes("serial_inventory"));
      if (features.includes("suppliers")) {
        api<{ data: Supplier[] }>("/suppliers?per_page=100")
          .then((result) => {
            setSuppliers(result.data);
            const walkIn = result.data.find((row) => row.is_system) ?? result.data[0];
            if (walkIn) setSupplierId((current) => current || (profile.type === "garage" ? String(walkIn.id) : ""));
          })
          .catch(() => setSuppliers([]));
      }
    });
    return () => cancelAnimationFrame(frame);
  }, [profile.type]);

  function placeDropdown(input: HTMLElement) {
    const rect = input.getBoundingClientRect();
    const below = window.innerHeight - rect.bottom - 8;
    const above = rect.top - 8;
    const openUp = below < 220 && above > below;
    setDropdown({
      left: rect.left,
      width: rect.width,
      maxHeight: Math.max(120, Math.min(320, openUp ? above : below)),
      ...(openUp ? { bottom: window.innerHeight - rect.top + 2 } : { top: rect.bottom + 2 }),
    });
  }

  useEffect(() => {
    if (!activeKey) return;
    const reposition = () => {
      const input = itemInputs.current[activeKey];
      if (input) placeDropdown(input);
    };
    window.addEventListener("scroll", reposition, true);
    window.addEventListener("resize", reposition);
    return () => {
      window.removeEventListener("scroll", reposition, true);
      window.removeEventListener("resize", reposition);
    };
  }, [activeKey]);

  const activeQuery = rows.find((row) => row.key === activeKey && !row.part)?.query.trim() ?? "";

  useEffect(() => {
    if (!activeKey || !activeQuery) return;
    let cancelled = false;
    const key = activeKey;
    const timer = window.setTimeout(() => {
      setSearchingKey(key);
      api<{ data: PartHit[] }>(`/parts?search=${encodeURIComponent(activeQuery)}&per_page=${SEARCH_LIMIT}`)
        .then((result) => {
          if (!cancelled) setSuggestions((current) => ({ ...current, [key]: result.data }));
        })
        .catch(() => {
          if (!cancelled) setSuggestions((current) => ({ ...current, [key]: [] }));
        })
        .finally(() => {
          if (!cancelled) setSearchingKey(null);
        });
    }, 180);
    return () => {
      cancelled = true;
      window.clearTimeout(timer);
    };
  }, [activeKey, activeQuery]);

  const loadReceipts = useCallback((term: string, page: number, append: boolean) => {
    const seq = ++receiptSeq.current;
    const params = new URLSearchParams({ per_page: "20", page: String(page) });
    if (term.trim()) params.set("search", term.trim());
    setReceiptsLoading(true);
    api<ReceiptsPage>(`/stock-receipts?${params}`)
      .then((result) => {
        if (seq !== receiptSeq.current) return;
        setReceipts((current) => (append ? [...current, ...result.data] : result.data));
        setReceiptPage(result.current_page || page);
        setReceiptLastPage(Math.max(1, result.last_page || 1));
      })
      .catch(() => {
        if (seq === receiptSeq.current && !append) setReceipts([]);
      })
      .finally(() => {
        if (seq === receiptSeq.current) setReceiptsLoading(false);
      });
  }, []);

  useEffect(() => {
    const handle = window.setTimeout(() => loadReceipts(receiptSearch, 1, false), receiptSearch.trim() ? 250 : 0);
    return () => window.clearTimeout(handle);
  }, [receiptSearch, loadReceipts]);

  const filled = useMemo(() => rows.filter((row) => row.part), [rows]);
  const grandTotal = useMemo(
    () => filled.reduce((sum, row) => sum + (Number(row.quantity) || 0) * (row.isFree ? 0 : Number(row.unitCost) || 0), 0),
    [filled],
  );

  function patchRow(key: string, patch: Partial<SheetRow>) {
    setRows((current) => current.map((row) => (row.key === key ? { ...row, ...patch } : row)));
  }

  function selectPart(key: string, part: PartHit) {
    const cost = part.cost_price ? String(Number(part.cost_price)) : "";
    setRows((current) => {
      const next = current.map((row) => (row.key !== key ? row : {
        ...row,
        part,
        query: part.name,
        unitCost: row.isFree ? "0" : cost,
        savedUnitCost: cost,
        sellPrice: part.price ? String(Number(part.price)) : "",
      }));
      return next.at(-1)?.part ? [...next, emptyRow(nextKey())] : next;
    });
    setSuggestions((current) => ({ ...current, [key]: [] }));
    setActiveKey(null);
    window.setTimeout(() => document.getElementById(`qty-${key}`)?.focus(), 0);
  }

  function clearPart(key: string) {
    patchRow(key, { part: null, query: "", unitCost: "", sellPrice: "", quantity: "", serials: "", isFree: false, savedUnitCost: "" });
    setActiveKey(key);
  }

  function toggleFree(key: string, next: boolean) {
    setRows((current) => current.map((row) => {
      if (row.key !== key) return row;
      if (next) return { ...row, isFree: true, savedUnitCost: row.unitCost || row.savedUnitCost, unitCost: "0" };
      return { ...row, isFree: false, unitCost: row.savedUnitCost || (row.part?.cost_price ? String(Number(row.part.cost_price)) : "") };
    }));
  }

  async function resolveExact(needle: string): Promise<PartHit | null> {
    try {
      const byBarcode = await api<{ data: PartHit[] }>(`/parts?barcode=${encodeURIComponent(needle)}&per_page=1`);
      if (byBarcode.data[0]) return byBarcode.data[0];
      const search = await api<{ data: PartHit[] }>(`/parts?search=${encodeURIComponent(needle)}&per_page=100`);
      const lower = needle.toLowerCase();
      return search.data.find((part) =>
        part.barcode?.toLowerCase() === lower || part.sku?.toLowerCase() === lower || part.name.toLowerCase() === lower,
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
    setRows((current) => [...current, emptyRow(nextKey())]);
  }

  function removeRow(key: string) {
    setRows((current) => (current.length <= 1 ? [emptyRow(nextKey())] : current.filter((row) => row.key !== key)));
  }

  function resetSheet() {
    setRows(Array.from({ length: 5 }, () => emptyRow(nextKey())));
    setInvoiceNumber("");
    setPaymentStatus("paid");
    setDueDate("");
    setSuggestions({});
    setActiveKey(null);
  }

  async function submit(event: FormEvent) {
    event.preventDefault();
    setError("");
    setNotice("");

    if (!invoiceNumber.trim()) {
      setError("Enter the invoice number.");
      return;
    }
    if (filled.length === 0) {
      setError("Select at least one item and enter quantity.");
      return;
    }
    if (isGarage && suppliers.length > 0 && !supplierId) {
      setError("Pick a supplier.");
      return;
    }
    if (paymentStatus === "credit" && grandTotal > 0 && !dueDate) {
      setError("Due date is required for credit.");
      return;
    }
    for (const [index, row] of filled.entries()) {
      const serials = parseSerials(row.serials);
      if (canSerial && row.part?.serialized && serials.length === 0) {
        setError(`Row ${index + 1}: enter IMEIs / serials.`);
        return;
      }
      if (serials.length === 0 && !(Number(row.quantity) > 0)) {
        setError(`Row ${index + 1}: enter quantity to add.`);
        return;
      }
    }

    const items = filled.map((row) => {
      const serials = parseSerials(row.serials);
      const body: Record<string, unknown> = {
        part_id: row.part!.id,
        unit_cost: row.isFree ? 0 : (row.unitCost === "" ? undefined : Number(row.unitCost)),
        price: row.sellPrice === "" ? undefined : Number(row.sellPrice),
        price_after_old_stock: (sellPriceChanged(row) && row.afterOldStock) || undefined,
        is_free: row.isFree || undefined,
      };
      if (serials.length) body.serials = serials;
      else body.quantity = Number(row.quantity);
      return body;
    });

    setSaving(true);
    try {
      const result = await api<{ restocked: number; receipt: { receipt_number: string } | null }>("/parts/restock/bulk", {
        method: "POST",
        body: JSON.stringify({
          invoice_number: invoiceNumber.trim() || null,
          supplier_id: supplierId || null,
          payment_status: paymentStatus,
          due_date: paymentStatus === "credit" ? dueDate || null : null,
          items,
        }),
      });
      const grn = result.receipt?.receipt_number;
      setNotice(`Restocked ${result.restocked} line${result.restocked === 1 ? "" : "s"}${grn ? ` · ${grn}` : ""}${invoiceNumber.trim() ? ` · invoice ${invoiceNumber.trim()}` : ""}.`);
      resetSheet();
      loadReceipts(receiptSearch, 1, false);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Bulk restock failed.");
    } finally {
      setSaving(false);
    }
  }

  const cell = "h-7 w-full border border-[#c9c5b9] bg-white px-1.5 text-[11px] outline-none focus:border-[#167c73] disabled:bg-[#eeece5] disabled:opacity-70";
  const cellNum = `${cell} tabular-nums`;
  const th = "border-b border-[#d7d3c8] px-1 py-1.5";
  const td = "border-b border-[#e8e4da] px-1 py-1 align-middle";
  const label = "block text-[10px] font-bold uppercase text-[#6f746e]";

  return (
    <AppShell
      title="Bulk restock"
      eyebrow="Goods received from one supplier invoice"
      action={(
        <Link href="/parts" className="flex h-8 items-center gap-2 border border-[#20221f] bg-white px-2.5 text-[11px] font-semibold">
          <ArrowLeft size={16} /><span className="hidden sm:inline">Inventory</span>
        </Link>
      )}
    >
      <div className="space-y-3">
        {error && <ErrorMessage message={error} />}
        {notice && <SuccessMessage message={notice} />}

        <form onSubmit={submit} aria-busy={saving} className="space-y-3">
          <Panel className="p-3">
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
              <label className={label}>
                Invoice number <span className="text-[#b84837]">*</span>
                <input
                  value={invoiceNumber}
                  onChange={(event) => setInvoiceNumber(event.target.value)}
                  maxLength={80}
                  required
                  className={`${inputClass} mt-1 font-normal normal-case`}
                  placeholder="Supplier invoice no."
                />
              </label>
              <label className={label}>
                Supplier
                {suppliers.length > 0 ? (
                  <select
                    value={supplierId}
                    onChange={(event) => setSupplierId(event.target.value)}
                    className={`${inputClass} mt-1 font-normal normal-case`}
                  >
                    {!isGarage && <option value="">No supplier</option>}
                    {suppliers.map((supplier) => (
                      <option key={supplier.id} value={supplier.id}>{supplier.name}</option>
                    ))}
                  </select>
                ) : (
                  <p className="mt-1 flex h-8 items-center text-[11px] font-normal normal-case">{isGarage ? "Walk-in supplier" : "—"}</p>
                )}
              </label>
              <label className={label}>
                Pay
                <select
                  value={paymentStatus}
                  onChange={(event) => setPaymentStatus(event.target.value as "paid" | "credit")}
                  className={`${inputClass} mt-1 font-normal normal-case`}
                >
                  <option value="paid">Paid</option>
                  <option value="credit">Credit</option>
                </select>
              </label>
              <label className={label}>
                Due date
                <input
                  type="date"
                  value={dueDate}
                  min={new Date().toISOString().slice(0, 10)}
                  onChange={(event) => setDueDate(event.target.value)}
                  disabled={paymentStatus !== "credit"}
                  required={paymentStatus === "credit" && grandTotal > 0}
                  className={`${inputClass} mt-1 font-normal normal-case disabled:bg-[#eeece5] disabled:opacity-70`}
                />
              </label>
            </div>
          </Panel>

          <Panel className="p-2">
            <div className="overflow-x-auto border border-[#d7d3c8] bg-white">
              <table className="w-full min-w-[820px] border-collapse text-left text-[11px]">
                <thead className="bg-[#eeece5] text-[9px] font-bold uppercase tracking-wide text-[#6f746e]">
                  <tr>
                    <th className={`${th} w-7`}>#</th>
                    <th className={`${th} w-full min-w-[240px]`}>Item</th>
                    <th className={`${th} w-10 text-center`}>Free</th>
                    <th className={`${th} w-28 min-w-28`}>Qty</th>
                    <th className={`${th} w-12`}>Unit</th>
                    <th className={`${th} w-32 min-w-32`}>Cost</th>
                    <th className={`${th} w-32 min-w-32`}>Sell</th>
                    {canSerial && <th className={`${th} min-w-[120px]`}>Serials</th>}
                    <th className={`${th} w-24 text-right`}>Total</th>
                    <th className={`${th} w-7`} />
                  </tr>
                </thead>
                <tbody>
                  {rows.map((row, index) => {
                    const lineTotal = (Number(row.quantity) || 0) * (row.isFree ? 0 : Number(row.unitCost) || 0);
                    const hits = suggestions[row.key] ?? [];
                    const decimal = row.part ? stockAllowsDecimal(row.part.stock_unit, isPaint) : false;
                    return (
                      <tr key={row.key} className={row.isFree ? "bg-[#e8f5f3]" : "odd:bg-[#fbfaf6]"}>
                        <td className={`${td} tabular-nums text-[#6f746e]`}>{index + 1}</td>
                        <td className={td}>
                          {row.part ? (
                            <div className="flex items-center justify-between gap-2">
                              <div className="min-w-0">
                                <p className="truncate text-[11px] font-semibold leading-tight">
                                  {row.part.name}
                                  {row.isFree && <span className="ml-1 text-[9px] font-bold uppercase text-[#167c73]">gift</span>}
                                </p>
                                <p className="truncate text-[9px] leading-tight text-[#6f746e]">
                                  {[row.part.barcode, row.part.sku, row.part.brand].filter(Boolean).join(" · ")}
                                  {` · stock ${formatStockQty(row.part.stock_qty, row.part.stock_unit, isPaint)}`}
                                </p>
                              </div>
                              <button type="button" className="shrink-0 text-[10px] text-[#167c73] underline" onClick={() => clearPart(row.key)}>Change</button>
                            </div>
                          ) : (
                            <div className="relative">
                              <ScanBarcode className="pointer-events-none absolute left-1.5 top-1/2 -translate-y-1/2 text-[#6f746e]" size={12} />
                              <input
                                ref={(node) => { itemInputs.current[row.key] = node; }}
                                value={row.query}
                                onChange={(event) => {
                                  patchRow(row.key, { query: event.target.value });
                                  setActiveKey(row.key);
                                  placeDropdown(event.currentTarget);
                                  setError("");
                                }}
                                onFocus={(event) => {
                                  setActiveKey(row.key);
                                  placeDropdown(event.currentTarget);
                                }}
                                onBlur={() => setActiveKey((current) => (current === row.key ? null : current))}
                                onKeyDown={(event) => void onItemKey(row.key, event)}
                                className={`${cell} pl-6`}
                                placeholder="Scan barcode or type name / SKU"
                                autoComplete="off"
                              />
                              {searchingKey === row.key && (
                                <Loader2 className="absolute right-1.5 top-1/2 -translate-y-1/2 animate-spin text-[#6f746e]" size={12} />
                              )}
                              {activeKey === row.key && row.query.trim() !== "" && hits.length > 0 && dropdown && createPortal(
                                <ul
                                  style={dropdown}
                                  className="fixed z-[60] overflow-auto border border-[#d7d3c8] bg-white text-[11px] shadow-lg"
                                  onMouseDown={(event) => event.preventDefault()}
                                >
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
                                        <span className="shrink-0 text-right tabular-nums text-[10px]">
                                          {money(hit.cost_price || 0)}
                                          <span className="block text-[9px] text-[#6f746e]">{formatStockQty(hit.stock_qty, hit.stock_unit, isPaint)}</span>
                                        </span>
                                      </button>
                                    </li>
                                  ))}
                                  {hits.length >= SEARCH_LIMIT && (
                                    <li className="px-2 py-1 text-[9px] text-[#6f746e]">Showing first {SEARCH_LIMIT} matches — type more to narrow.</li>
                                  )}
                                </ul>,
                                document.body,
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
                            id={`qty-${row.key}`}
                            type="number"
                            min={decimal ? "0.001" : "1"}
                            step={decimal ? "0.001" : "1"}
                            value={row.quantity}
                            onChange={(event) => patchRow(row.key, { quantity: event.target.value })}
                            disabled={!row.part || (canSerial && Boolean(row.part.serialized))}
                            className={cellNum}
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
                            className={cellNum}
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
                            className={cellNum}
                          />
                          {sellPriceChanged(row) && (
                            <label className="mt-1 flex cursor-pointer items-center gap-1 text-[9px] leading-tight text-[#6f746e]" title="Old stock keeps its labelled price; the new price starts by itself when it runs out">
                              <input
                                type="checkbox"
                                checked={row.afterOldStock}
                                onChange={(event) => patchRow(row.key, { afterOldStock: event.target.checked })}
                                className="size-3 accent-[#167c73]"
                              />
                              After old {formatStockQty(row.part!.stock_qty, row.part!.stock_unit, isPaint)} sold
                            </label>
                          )}
                          {row.part?.pending_price != null && !sellPriceChanged(row) && (
                            <p className="mt-1 text-[9px] leading-tight text-[#167c73]">Next price {money(row.part.pending_price)}</p>
                          )}
                        </td>
                        {canSerial && (
                          <td className={td}>
                            <textarea
                              rows={1}
                              value={row.serials}
                              onChange={(event) => {
                                const serials = event.target.value;
                                const count = parseSerials(serials).length;
                                patchRow(row.key, { serials, quantity: row.part?.serialized ? String(count || "") : row.quantity });
                              }}
                              disabled={!row.part || !row.part.serialized}
                              placeholder={row.part?.serialized ? "IMEIs" : "—"}
                              className={`${cell} min-h-7 resize-y py-1`}
                            />
                          </td>
                        )}
                        <td className={`${td} whitespace-nowrap text-right font-semibold tabular-nums`}>
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
            <div className="mt-2 flex flex-wrap items-center justify-between gap-2">
              <button type="button" onClick={addRow} className="flex items-center gap-1 text-xs font-semibold text-[#167c73]">
                <Plus size={14} /> Add row
              </button>
              <div className="flex items-center gap-4">
                <div className="text-right">
                  <p className="text-[9px] font-bold uppercase text-[#6f746e]">
                    Invoice total · {filled.length} item{filled.length === 1 ? "" : "s"}
                  </p>
                  <p className="font-display text-xl font-semibold tabular-nums leading-tight">{money(grandTotal)}</p>
                </div>
                <button
                  type="submit"
                  disabled={saving || filled.length === 0 || !invoiceNumber.trim()}
                  title={!invoiceNumber.trim() ? "Enter the invoice number first" : undefined}
                  className={buttonClass}
                >
                  {saving && <Loader2 className="animate-spin" size={16} />}
                  {saving ? "Saving…" : "Restock all"}
                </button>
              </div>
            </div>
          </Panel>
        </form>

        <Panel className="p-3">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <h2 className="font-display text-lg font-semibold uppercase">Previous GRNs</h2>
            <label className="relative w-full max-w-xs">
              <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 text-[#6f746e]" size={14} />
              <input
                value={receiptSearch}
                onChange={(event) => setReceiptSearch(event.target.value)}
                className={`${inputClass} pl-8`}
                placeholder="Invoice no., GRN or supplier"
              />
            </label>
          </div>
          <div className="mt-2 divide-y divide-[#e8e4da] border border-[#d7d3c8] bg-white">
            {receipts.map((receipt) => {
              const open = openReceiptId === receipt.id;
              return (
                <div key={receipt.id}>
                  <button
                    type="button"
                    onClick={() => setOpenReceiptId(open ? null : receipt.id)}
                    className="flex w-full items-center gap-2 px-2 py-2 text-left text-[11px] hover:bg-[#fbfaf6]"
                  >
                    {open ? <ChevronDown size={14} className="shrink-0" /> : <ChevronRight size={14} className="shrink-0" />}
                    <span className="min-w-0 flex-1">
                      <span className="block truncate font-semibold">
                        Invoice {receipt.invoice_number}
                      </span>
                      <span className="block truncate text-[10px] text-[#6f746e]">
                        {[receipt.receipt_number, receipt.supplier?.name, formatDate(receipt.received_at), `${receipt.items.length} item${receipt.items.length === 1 ? "" : "s"}`]
                          .filter(Boolean)
                          .join(" · ")}
                      </span>
                    </span>
                    <span className={`shrink-0 px-1.5 py-0.5 text-[9px] font-bold uppercase ${receipt.payment_status === "credit" ? "bg-[#2b6cb0]/15 text-[#2b6cb0]" : "bg-[#167c73]/10 text-[#167c73]"}`}>
                      {receipt.payment_status === "credit" ? `Credit${receipt.due_date ? ` · ${formatDate(receipt.due_date)}` : ""}` : "Paid"}
                    </span>
                    <span className="w-24 shrink-0 text-right font-semibold tabular-nums">{money(receipt.total)}</span>
                  </button>
                  {open && (
                    <table className="w-full border-t border-[#e8e4da] bg-[#fbfaf6] text-[11px]">
                      <tbody>
                        {receipt.items.map((item) => (
                          <tr key={item.id} className="border-b border-[#efece4] last:border-b-0">
                            <td className="py-1 pl-8 pr-2">
                              {item.name}
                              {item.sku && <span className="ml-1 text-[9px] text-[#6f746e]">{item.sku}</span>}
                              {Number(item.unit_cost) === 0 && <span className="ml-1 text-[9px] font-bold uppercase text-[#167c73]">gift</span>}
                            </td>
                            <td className="px-2 py-1 text-right tabular-nums">{formatStockQty(item.quantity, item.stock_unit, isPaint)}</td>
                            <td className="px-2 py-1 text-right tabular-nums">× {money(item.unit_cost)}</td>
                            <td className="w-24 px-2 py-1 text-right font-semibold tabular-nums">{money(item.line_total)}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  )}
                </div>
              );
            })}
            {!receiptsLoading && receipts.length === 0 && (
              <p className="px-2 py-4 text-center text-[11px] text-[#6f746e]">
                {receiptSearch.trim() ? "No GRNs match that search." : "No GRNs with an invoice number yet."}
              </p>
            )}
            {receiptsLoading && (
              <p className="flex items-center justify-center gap-2 px-2 py-3 text-[11px] text-[#6f746e]">
                <Loader2 className="animate-spin" size={14} /> Loading…
              </p>
            )}
          </div>
          {!receiptsLoading && receiptPage < receiptLastPage && (
            <button
              type="button"
              onClick={() => loadReceipts(receiptSearch, receiptPage + 1, true)}
              className="mt-2 text-xs font-semibold text-[#167c73]"
            >
              Load more
            </button>
          )}
        </Panel>
      </div>
    </AppShell>
  );
}
