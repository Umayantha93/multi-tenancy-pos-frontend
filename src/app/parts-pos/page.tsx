"use client";

import { FormEvent, KeyboardEvent, useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { ClipboardCheck, Save, ScanBarcode, Trash2, X } from "lucide-react";
import { AppShell } from "@/components/app-shell";
import { AddressField } from "@/components/address-field";
import { EmployeePicker } from "@/components/employee-picker";
import { buttonClass, ErrorMessage, inputClass, PageState, Panel, QtyStepper } from "@/components/ui";
import { api, currentFeatures, money } from "@/lib/api";
import { BillingBranchBanner } from "@/components/branch-chip";
import { useBusinessProfile } from "@/lib/use-business-profile";
import { formatStockNumber, formatStockQty, salePriceLayers, stockAllowsDecimal } from "@/lib/stock-unit";
import { useT } from "@/lib/locale";

function localToday() {
  const date = new Date();
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
}

type EmployeeOption = { id: number; name: string; position?: string | null };
type StockItem = {
  id: number;
  name: string;
  price: string;
  pending_price?: string | null;
  pending_price_at_qty?: string | number | null;
  stock_qty: number;
  stock_unit?: string | null;
  sku?: string | null;
  barcode?: string | null;
  brand?: string;
  type?: string | null;
};
type CartLine = {
  key: string;
  kind: "stock" | "custom";
  partId?: number;
  name: string;
  price: number;
  pendingPrice?: number | null;
  pendingAtQty?: number | null;
  quantity: number;
  stock_qty?: number;
  stock_unit?: string | null;
};

function lineLayers(line: CartLine) {
  if (line.kind !== "stock") return [{ quantity: line.quantity, unitPrice: line.price }];
  return salePriceLayers(line.quantity, line.price, line.stock_qty ?? line.quantity, line.pendingPrice, line.pendingAtQty);
}

function lineAmount(line: CartLine): number {
  return lineLayers(line).reduce((sum, layer) => sum + layer.unitPrice * layer.quantity, 0);
}

export default function InstantBillPage() {
  const profile = useBusinessProfile();
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);

  if (!mounted) {
    return (
      <AppShell title="Instant bill" eyebrow="Quick billing">
        <PageState message="Loading..." />
      </AppShell>
    );
  }

  if (profile.type === "garage") {
    return <GarageInstantTill />;
  }

  return <PaintCounterForm />;
}

function GarageInstantTill() {
  const router = useRouter();
  const t = useT();
  const scanRef = useRef<HTMLInputElement>(null);
  const customKey = useRef(0);
  const [matches, setMatches] = useState<StockItem[]>([]);
  const [cart, setCart] = useState<CartLine[]>([]);
  const [search, setSearch] = useState("");
  const [customName, setCustomName] = useState("");
  const [customPrice, setCustomPrice] = useState("");
  const [customQty, setCustomQty] = useState("1");
  const [error, setError] = useState("");
  const [searching, setSearching] = useState(false);
  const [saving, setSaving] = useState(false);
  const savingLock = useRef(false);
  const [payLater, setPayLater] = useState(false);
  const [tendered, setTendered] = useState("");

  useEffect(() => {
    const needle = search.trim();
    if (!needle) {
      setMatches([]);
      setSearching(false);
      return;
    }

    let cancelled = false;
    const timer = window.setTimeout(() => {
      setSearching(true);
      api<{ data: StockItem[] }>(`/parts?search=${encodeURIComponent(needle)}&per_page=100`)
        .then((result) => {
          if (!cancelled) setMatches(result.data);
        })
        .catch((caught) => {
          if (!cancelled) {
            setMatches([]);
            setError(caught instanceof Error ? caught.message : t("pos.catalog_failed"));
          }
        })
        .finally(() => {
          if (!cancelled) setSearching(false);
        });
    }, 220);

    return () => {
      cancelled = true;
      window.clearTimeout(timer);
    };
  }, [search, t]);

  useEffect(() => {
    scanRef.current?.focus({ preventScroll: true });
  }, []);

  const subtotal = useMemo(
    () => cart.reduce((sum, line) => sum + lineAmount(line), 0),
    [cart],
  );
  const tenderedAmount = Number(tendered || 0);
  const changeDue = !payLater && tenderedAmount > subtotal ? tenderedAmount - subtotal : 0;

  function add(item: StockItem, clearSearch = false) {
    if (item.stock_qty <= 0) return;
    const decimal = stockAllowsDecimal(item.stock_unit);
    const step = decimal ? 0.1 : 1;
    setCart((lines) => {
      const existing = lines.find((line) => line.kind === "stock" && line.partId === item.id);
      if (existing) {
        if (existing.quantity + step > item.stock_qty + 0.0001) return lines;
        return lines.map((line) => (
          line.key === existing.key ? { ...line, quantity: Number((line.quantity + step).toFixed(3)) } : line
        ));
      }
      const start = !decimal ? 1 : (item.stock_qty >= 1 ? 1 : item.stock_qty);
      if (start > item.stock_qty + 0.0001) return lines;
      return [...lines, {
        key: `stock-${item.id}`,
        kind: "stock" as const,
        partId: item.id,
        name: item.name,
        price: Number(item.price),
        pendingPrice: item.pending_price == null || item.pending_price === "" ? null : Number(item.pending_price),
        pendingAtQty: item.pending_price_at_qty == null || item.pending_price_at_qty === "" ? null : Number(item.pending_price_at_qty),
        quantity: Number(start.toFixed(3)),
        stock_qty: item.stock_qty,
        stock_unit: item.stock_unit,
      }];
    });
    setError("");
    if (clearSearch) {
      setSearch("");
      setMatches([]);
    }
    scanRef.current?.focus({ preventScroll: true });
  }

  function addCustom(event?: FormEvent) {
    event?.preventDefault();
    const name = customName.trim();
    const price = Number(customPrice);
    const quantity = Math.max(1, Number(customQty) || 1);
    if (!name || !Number.isFinite(price) || price < 0) {
      setError(t("instant.custom_required"));
      return;
    }
    customKey.current += 1;
    setCart((lines) => [...lines, {
      key: `custom-${customKey.current}`,
      kind: "custom",
      name,
      price,
      quantity,
    }]);
    setCustomName("");
    setCustomPrice("");
    setCustomQty("1");
    setError("");
  }

  function setQty(key: string, quantity: number, max?: number) {
    setCart((lines) => lines.map((line) => {
      if (line.key !== key) return line;
      const decimal = line.kind === "stock" && stockAllowsDecimal(line.stock_unit);
      const min = decimal ? 0.1 : 1;
      const bounded = max != null ? Math.min(max, Math.max(min, quantity)) : Math.max(min, quantity);
      return { ...line, quantity: Number(bounded.toFixed(decimal ? 3 : 0)) };
    }));
  }

  async function scanExact(needle: string): Promise<StockItem | null> {
    try {
      const exact = await api<{ data: StockItem[] }>(`/parts?barcode=${encodeURIComponent(needle)}&per_page=1`);
      if (exact.data[0]) return exact.data[0];
      const sku = await api<{ data: StockItem[] }>(`/parts?search=${encodeURIComponent(needle)}&per_page=100`);
      return sku.data.find((part) =>
        part.barcode?.toLowerCase() === needle.toLowerCase()
        || part.sku?.toLowerCase() === needle.toLowerCase()
        || part.name.toLowerCase() === needle.toLowerCase(),
      ) ?? null;
    } catch {
      return null;
    }
  }

  async function onScanKey(event: KeyboardEvent<HTMLInputElement>) {
    if (event.key !== "Enter") return;
    event.preventDefault();
    const needle = search.trim();
    if (!needle) return;
    const scanned = await scanExact(needle);
    const fallback = matches.find((item) =>
      item.barcode?.toLowerCase() === needle.toLowerCase()
      || item.sku?.toLowerCase() === needle.toLowerCase()
      || item.name.toLowerCase() === needle.toLowerCase(),
    );
    const match = scanned ?? fallback ?? (matches.length === 1 ? matches[0] : null);
    if (match) {
      add(match, true);
      return;
    }
    setError(t("pos.no_stock"));
  }

  async function checkout(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (cart.length === 0 || savingLock.current) return;
    savingLock.current = true;
    setSaving(true);
    setError("");
    const form = new FormData(event.currentTarget);
    try {
      const bill = await api<{ id: number }>("/bills/instant", {
        method: "POST",
        body: JSON.stringify({
          customer_name: form.get("customer_name") || null,
          customer_phone: form.get("customer_phone") || null,
          admission_date: form.get("admission_date") || localToday(),
          payment_method: form.get("payment_method") || "cash",
          payment_amount: payLater ? 0 : subtotal,
          items: cart.map((line) => (
            line.kind === "stock"
              ? { type: "part", part_id: line.partId, quantity: line.quantity }
              : { type: "labor", description: line.name, unit_price: line.price, quantity: line.quantity }
          )),
        }),
      });
      router.push(`/bills/${bill.id}`);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : t("instant.failed"));
      savingLock.current = false;
      setSaving(false);
    }
  }

  return (
    <AppShell title={t("instant.title")} eyebrow={t("instant.eyebrow")}>
      <BillingBranchBanner />
      <p className="mb-4 max-w-2xl text-sm text-[#6f746e]">{t("instant.hint")}</p>
      <div className="flex flex-col gap-5 xl:grid xl:grid-cols-[1.25fr_0.75fr]">
        <div className="space-y-4">
          <Panel className="p-4">
            <label className="relative block">
              <ScanBarcode className="absolute left-3 top-1/2 -translate-y-1/2 text-[#6f746e]" size={16} />
              <input
                ref={scanRef}
                value={search}
                onChange={(event) => {
                  setSearch(event.target.value);
                  setError("");
                }}
                onKeyDown={onScanKey}
                className={`${inputClass} pl-10 ${search ? "pr-10" : ""}`}
                placeholder={t("bill.scan_placeholder")}
                autoComplete="off"
              />
              {search && (
                <button
                  type="button"
                  onClick={() => {
                    setSearch("");
                    setMatches([]);
                    setError("");
                    scanRef.current?.focus({ preventScroll: true });
                  }}
                  className="absolute right-2 top-1/2 grid size-7 -translate-y-1/2 place-items-center text-[#6f746e] hover:text-[#20221f]"
                  aria-label={t("common.clear")}
                >
                  <X size={16} />
                </button>
              )}
            </label>
            {error && !saving && <div className="mt-3"><ErrorMessage message={error} /></div>}
            {!search.trim() && (
              <p className="mt-4 text-sm text-[#6f746e]">{t("instant.search_idle")}</p>
            )}
            {search.trim() && searching && <PageState message={t("pos.loading")} />}
            {search.trim() && !searching && (
              <div className="mt-4 grid max-h-[50vh] gap-2 overflow-y-auto sm:grid-cols-2">
                {matches.map((item) => (
                  <button
                    key={item.id}
                    type="button"
                    onClick={() => add(item)}
                    disabled={item.stock_qty <= 0}
                    className="border border-[#d7d3c8] bg-[#fbfaf6] p-3 text-left hover:border-[#167c73] disabled:opacity-40"
                  >
                    <p className="font-semibold">{item.name}</p>
                    <p className="text-xs text-[#6f746e]">
                      {[item.barcode, item.sku, item.brand, item.type].filter(Boolean).join(" · ") || t("common.stock")}
                    </p>
                    <div className="mt-2 flex justify-between gap-2 text-sm">
                      <strong className="tabular-nums">
                        {money(item.price)}
                        {item.pending_price != null && Number(item.stock_qty) - Number(item.pending_price_at_qty ?? 0) > 0.0001 && (
                          <span className="mt-0.5 block text-[10px] font-semibold text-[#167c73]">then {money(item.pending_price)}</span>
                        )}
                      </strong>
                      <span className="text-[#6f746e]">{formatStockQty(item.stock_qty, item.stock_unit)}</span>
                    </div>
                  </button>
                ))}
                {matches.length === 0 && (
                  <p className="col-span-2 p-6 text-center text-sm text-[#6f746e]">{t("pos.no_stock")}</p>
                )}
              </div>
            )}
          </Panel>

          <Panel className="p-4">
            <h2 className="text-xs font-bold uppercase text-[#6f746e]">{t("bill.custom_item")}</h2>
            <p className="mt-1 text-sm text-[#6f746e]">{t("instant.custom_hint")}</p>
            <form onSubmit={addCustom} className="mt-3 grid gap-2 sm:grid-cols-[1.4fr_0.8fr_0.55fr_auto]">
              <input
                value={customName}
                onChange={(event) => setCustomName(event.target.value)}
                className={inputClass}
                placeholder={t("bill.custom_item_placeholder")}
              />
              <input
                type="number"
                min="0"
                step="0.01"
                value={customPrice}
                onChange={(event) => setCustomPrice(event.target.value)}
                className={inputClass}
                placeholder={t("common.amount")}
              />
              <input
                type="number"
                min="1"
                step="1"
                value={customQty}
                onChange={(event) => setCustomQty(event.target.value)}
                className={inputClass}
                placeholder={t("common.qty")}
              />
              <button type="submit" className={buttonClass}>{t("bill.add")}</button>
            </form>
          </Panel>
        </div>

        <Panel className="p-5 xl:sticky xl:top-4">
          <h2 className="font-display text-2xl font-semibold uppercase">{t("common.bill")}</h2>
          <div className="mt-4 max-h-[40vh] space-y-3 overflow-y-auto">
            {cart.map((line) => {
              const layers = lineLayers(line);
              return (
              <div key={line.key} className="flex flex-wrap items-center gap-x-3 gap-y-2 border-b border-[#e2ded4] pb-2 text-sm">
                <div className="min-w-0 flex-1 basis-40">
                  <p className="truncate font-semibold">{line.name}</p>
                  {layers.map((layer, index) => (
                    <p key={index} className="tabular-nums text-[#6f746e]">
                      {money(layer.unitPrice)} × {line.kind === "stock" ? formatStockNumber(layer.quantity, line.stock_unit) : layer.quantity}
                      {line.kind === "custom" ? ` · ${t("bill.custom_item")}` : ""}
                    </p>
                  ))}
                </div>
                <div className="ml-auto flex shrink-0 items-center gap-2">
                  <QtyStepper
                    value={line.quantity}
                    min={line.kind === "stock" && stockAllowsDecimal(line.stock_unit) ? 0.1 : 1}
                    step={line.kind === "stock" && stockAllowsDecimal(line.stock_unit) ? 0.1 : 1}
                    max={line.kind === "stock" ? line.stock_qty : undefined}
                    onChange={(qty) => setQty(line.key, qty, line.kind === "stock" ? line.stock_qty : undefined)}
                  />
                  <strong className="shrink-0 whitespace-nowrap text-right text-sm tabular-nums">{money(lineAmount(line))}</strong>
                  <button type="button" className="grid size-7 shrink-0 place-items-center text-[#b84837]" onClick={() => setCart((rows) => rows.filter((row) => row.key !== line.key))} aria-label={t("common.remove")}><Trash2 size={14} /></button>
                </div>
              </div>
              );
            })}
            {cart.length === 0 && <p className="text-sm text-[#6f746e]">{t("instant.empty_cart")}</p>}
          </div>

          <div className="mt-4 flex items-baseline justify-between gap-3">
            <span className="text-[10px] font-bold uppercase text-[#6f746e]">{t("common.total")}</span>
            <p className="font-display text-3xl font-semibold tabular-nums">{money(subtotal)}</p>
          </div>

          <form onSubmit={checkout} className="mt-4 space-y-3">
            <input name="customer_name" placeholder={t("pos.customer_name")} className={inputClass} />
            <input name="customer_phone" placeholder={t("pos.phone")} className={inputClass} />
            <label className="block text-[10px] font-bold uppercase text-[#6f746e]">
              {t("common.date")}
              <input name="admission_date" type="date" defaultValue={localToday()} max={localToday()} className={`${inputClass} mt-1`} />
            </label>
            <select name="payment_method" className={inputClass} disabled={payLater}>
              <option value="cash">{t("method.cash")}</option>
              <option value="card">{t("method.card")}</option>
              <option value="bank_transfer">{t("method.bank_transfer")}</option>
            </select>
            {!payLater && (
              <label className="block text-[10px] font-bold uppercase text-[#6f746e]">
                {t("pos.cash_received")}
                <input
                  type="number"
                  min="0"
                  step="0.01"
                  value={tendered}
                  onChange={(event) => setTendered(event.target.value)}
                  className={`${inputClass} mt-1`}
                  placeholder={subtotal > 0 ? String(subtotal) : "0.00"}
                />
              </label>
            )}
            {changeDue > 0 && (
              <div className="flex justify-between bg-[#167c73]/8 px-3 py-2 text-sm font-semibold text-[#167c73]">
                <span>{t("pos.change")}</span>
                <span className="tabular-nums">{money(changeDue)}</span>
              </div>
            )}
            <label className="flex items-center gap-2 text-sm">
              <input type="checkbox" checked={payLater} onChange={(event) => setPayLater(event.target.checked)} className="size-4 accent-[#167c73]" />
              {t("pos.pay_later")}
            </label>
            {error && saving && <ErrorMessage message={error} />}
            <button disabled={saving || cart.length === 0} className={`${buttonClass} h-12 w-full text-sm sm:h-8 sm:text-[11px]`}>
              {saving ? t("pos.processing") : payLater ? t("pos.open_bill") : t("pos.complete_sale")}
            </button>
          </form>
        </Panel>
      </div>
    </AppShell>
  );
}

function PaintCounterForm() {
  const router = useRouter();
  const t = useT();
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);
  const savingLock = useRef(false);
  const [employees, setEmployees] = useState<EmployeeOption[]>([]);
  const [employeeIds, setEmployeeIds] = useState<number[]>([]);
  const [canAssignEmployees, setCanAssignEmployees] = useState(false);

  useEffect(() => {
    const features = currentFeatures();
    setCanAssignEmployees(features.includes("employees_management") || features.includes("attendance"));
  }, []);

  useEffect(() => {
    if (!canAssignEmployees) return;
    api<{ data: EmployeeOption[] }>("/employees?active_only=1&per_page=100")
      .then((result) => setEmployees(result.data))
      .catch(() => setEmployees([]));
  }, [canAssignEmployees]);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (savingLock.current) return;
    savingLock.current = true;
    setSaving(true);
    setError("");
    const form = Object.fromEntries(new FormData(event.currentTarget));
    try {
      const bill = await api<{ id: number }>("/bills/instant", {
        method: "POST",
        body: JSON.stringify({ ...form, employee_ids: employeeIds }),
      });
      router.push(`/bills/${bill.id}`);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : t("instant.failed"));
      savingLock.current = false;
      setSaving(false);
    }
  }

  return (
    <AppShell title={t("instant.title_paint")} eyebrow={t("instant.eyebrow")}>
      <div className="mx-auto max-w-3xl space-y-5">
        <div className="flex items-start gap-4 border-l-4 border-[#f5c842] bg-[#fbfaf6] p-4">
          <ClipboardCheck className="shrink-0 text-[#167c73]" />
          <div>
            <p className="font-semibold">{t("instant.heading_paint")}</p>
            <p className="text-sm text-[#6f746e]">{t("instant.hint_paint")}</p>
          </div>
        </div>

        <Panel className="p-5">
          <h2 className="font-display text-2xl font-semibold uppercase">{t("instant.customer")}</h2>
          <form onSubmit={submit} className="mt-4 grid gap-4 sm:grid-cols-2">
            <label className="block sm:col-span-2">
              <span className="mb-1 block text-[10px] font-bold uppercase text-[#6f746e]">{t("instant.customer_name")}</span>
              <input name="customer_name" className={inputClass} placeholder={t("instant.optional")} />
            </label>
            <label className="block">
              <span className="mb-1 block text-[10px] font-bold uppercase text-[#6f746e]">{t("instant.phone")}</span>
              <input name="customer_phone" type="tel" className={inputClass} placeholder={t("instant.optional")} />
            </label>
            <label className="block">
              <span className="mb-1 block text-[10px] font-bold uppercase text-[#6f746e]">{t("common.date")}</span>
              <input
                name="admission_date"
                type="date"
                defaultValue={localToday()}
                max={localToday()}
                className={inputClass}
              />
            </label>
            <div className="sm:col-span-2">
              <AddressField name="customer_address" label={t("instant.address")} />
            </div>
            {canAssignEmployees && (
              <div className="sm:col-span-2">
                <p className="mb-2 text-[10px] font-bold uppercase text-[#6f746e]">{t("instant.assign_employees")}</p>
                <EmployeePicker employees={employees} selectedIds={employeeIds} onChange={setEmployeeIds} />
              </div>
            )}
            <label className="block sm:col-span-2">
              <span className="mb-1 block text-[10px] font-bold uppercase text-[#6f746e]">{t("instant.internal_note")}</span>
              <textarea name="internal_notes" rows={3} className={inputClass} placeholder={t("instant.note_placeholder")} />
            </label>
            {error && (
              <div className="sm:col-span-2">
                <ErrorMessage message={error} />
              </div>
            )}
            <div className="sm:col-span-2">
              <button type="submit" disabled={saving} className={buttonClass}>
                <Save size={16} />
                {saving ? t("instant.opening") : t("instant.open_billing")}
              </button>
            </div>
          </form>
        </Panel>
      </div>
    </AppShell>
  );
}
