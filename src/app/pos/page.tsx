"use client";

import { FormEvent, KeyboardEvent, useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { ScanBarcode, Trash2 } from "lucide-react";
import { AppShell } from "@/components/app-shell";
import { ErrorMessage, PageState, Panel, QtyStepper, buttonClass, inputClass } from "@/components/ui";
import { api, currentFeatures, money } from "@/lib/api";
import { usesStoreCounter } from "@/lib/business-profiles";
import { useBusinessProfile } from "@/lib/use-business-profile";
import { BillingBranchBanner } from "@/components/branch-chip";
import { useT } from "@/lib/locale";

type Part = { id: number; name: string; sku?: string | null; barcode?: string | null; brand?: string; price: string; stock_qty: number; serialized?: boolean };
type Product = { id: number; name: string; sku: string | null; size: string | null; color: string | null; price: string; stock_qty: number };
type WarrantyCover = "" | "months" | "years" | "custom";
type CartLine = { id: number; name: string; detail: string; price: number; stock: number; quantity: number; warrantyCover?: WarrantyCover; warrantyAmount?: number; warrantyUntil?: string; serialized?: boolean; serials?: string[] };

function toCartLine(row: Part | Product, store: boolean, stockLabel = "Stock", serials?: string[]): CartLine {
  if (store) {
    const part = row as Part;
    return {
      id: part.id,
      name: part.name,
      detail: [part.barcode, part.sku, part.brand].filter(Boolean).join(" · ") || stockLabel,
      price: Number(part.price),
      stock: part.stock_qty,
      quantity: serials?.length || 1,
      warrantyCover: "",
      serialized: Boolean(part.serialized),
      serials,
    };
  }
  const product = row as Product;
  return {
    id: product.id,
    name: product.name,
    detail: [product.size, product.color].filter(Boolean).join(" · ") || product.sku || "Item",
    price: Number(product.price),
    stock: product.stock_qty,
    quantity: 1,
  };
}

export default function PosPage() {
  const router = useRouter();
  const profile = useBusinessProfile();
  const t = useT();
  const isStore = usesStoreCounter(profile.type);
  const [sessionReady, setSessionReady] = useState(false);
  const [items, setItems] = useState<CartLine[]>([]);
  const [cart, setCart] = useState<CartLine[]>([]);
  const [search, setSearch] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [discount, setDiscount] = useState("");
  const [payLater, setPayLater] = useState(false);
  const [tendered, setTendered] = useState("");
  const scanRef = useRef<HTMLInputElement>(null);
  const canWarranty = sessionReady && isStore && currentFeatures().includes("warranties");
  const canSerial = sessionReady && isStore && currentFeatures().includes("serial_inventory");

  useEffect(() => {
    setSessionReady(true);
  }, []);

  useEffect(() => {
    if (!sessionReady) return;
    if (profile.type === "garage") {
      setLoading(false);
      return;
    }
    setLoading(true);
    const query = encodeURIComponent(search);
    const request = isStore
      ? api<{ data: Part[] }>(`/parts?search=${query}&per_page=40`)
      : api<{ data: Product[] }>(`/products?active_only=1&search=${query}&per_page=50`);

    request
      .then((result) => setItems(result.data.map((row) => toCartLine(row, isStore, t("common.stock")))))
      .catch((caught) => setError(caught instanceof Error ? caught.message : t("pos.catalog_failed")))
      .finally(() => setLoading(false));
  }, [search, isStore, profile.type, sessionReady]);

  const subtotal = useMemo(() => cart.reduce((sum, line) => sum + line.price * line.quantity, 0), [cart]);
  const discountAmount = Math.min(Math.max(0, Number(discount || 0)), subtotal);
  const total = Math.max(0, subtotal - discountAmount);
  const tenderedAmount = Number(tendered || 0);
  const changeDue = !payLater && tenderedAmount > total ? tenderedAmount - total : 0;

  function add(item: CartLine) {
    if (item.serialized && (!item.serials || item.serials.length === 0)) {
      setError(t("serials.need_imei"));
      return;
    }
    if (item.stock < 1) return;
    setCart((lines) => {
      if (item.serials?.length) {
        const existing = lines.find((line) => line.id === item.id);
        const incoming = item.serials.map((code) => code.toUpperCase());
        if (existing) {
          const have = new Set((existing.serials ?? []).map((code) => code.toUpperCase()));
          const extra = incoming.filter((code) => !have.has(code));
          if (extra.length === 0) return lines;
          const serials = [...(existing.serials ?? []), ...extra];
          return lines.map((line) => line.id === item.id ? { ...line, serials, quantity: serials.length } : line);
        }
        return [...lines, { ...item, serials: incoming, quantity: incoming.length }];
      }
      const existing = lines.find((line) => line.id === item.id);
      if (existing) {
        if (existing.quantity >= item.stock) return lines;
        return lines.map((line) => line.id === item.id ? { ...line, quantity: line.quantity + 1 } : line);
      }
      return [...lines, { ...item, quantity: 1 }];
    });
    setError("");
  }

  function setQty(id: number, quantity: number, stock: number) {
    const next = Math.max(1, Math.min(stock, quantity));
    setCart((lines) => lines.map((line) => line.id === id && !line.serials?.length ? { ...line, quantity: next } : line));
  }

  function setWarranty(id: number, patch: Partial<Pick<CartLine, "warrantyCover" | "warrantyAmount" | "warrantyUntil">>) {
    setCart((lines) => lines.map((line) => line.id === id ? { ...line, ...patch } : line));
  }

  async function scanExact(needle: string): Promise<CartLine | null> {
    if (!isStore || !needle) return null;
    if (canSerial) {
      try {
        const row = await api<{ serial: string; status: string; part: Part }>(`/serials/lookup?q=${encodeURIComponent(needle)}`);
        if (row.status !== "in_stock") {
          setError(t("serials.already_sold"));
          return null;
        }
        return toCartLine(row.part, true, t("common.stock"), [row.serial]);
      } catch {
        // Not an IMEI — fall through to barcode / SKU.
      }
    }
    try {
      const exact = await api<{ data: Part[] }>(`/parts?barcode=${encodeURIComponent(needle)}&per_page=1`);
      if (exact.data[0]) return toCartLine(exact.data[0], true, t("common.stock"));
      const sku = await api<{ data: Part[] }>(`/parts?search=${encodeURIComponent(needle)}&per_page=5`);
      const match = sku.data.find((part) =>
        part.barcode?.toLowerCase() === needle.toLowerCase()
        || part.sku?.toLowerCase() === needle.toLowerCase()
        || part.name.toLowerCase() === needle.toLowerCase()
      );
      return match ? toCartLine(match, true, t("common.stock")) : null;
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
    const fallback = items.find((item) =>
      item.detail.toLowerCase().split(" · ").includes(needle.toLowerCase()) || item.name.toLowerCase() === needle.toLowerCase()
    );
    add(scanned ?? fallback ?? items[0]);
    setSearch("");
    scanRef.current?.select();
  }

  async function checkout(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (cart.length === 0) return;
    if (canWarranty && cart.some((line) => line.warrantyCover === "custom" && !line.warrantyUntil)) {
      setError(t("warranty.choose_end"));
      return;
    }
    if (canWarranty && cart.some((line) => (line.warrantyCover === "months" || line.warrantyCover === "years") && !Number(line.warrantyAmount))) {
      setError(t("warranty.enter_length"));
      return;
    }
    if (canSerial && cart.some((line) => line.serialized && !line.serials?.length)) {
      setError(t("serials.need_imei"));
      return;
    }
    setSaving(true);
    setError("");
    const form = new FormData(event.currentTarget);
    try {
      if (isStore) {
        const sale = await api<{ bill: { id: number } }>("/part-sales", {
          method: "POST",
          body: JSON.stringify({
            customer_name: form.get("customer_name") || null,
            customer_phone: form.get("customer_phone") || null,
            payment_method: form.get("payment_method") || "cash",
            payment_amount: payLater ? 0 : total,
            discount: discountAmount || null,
            items: cart.map((line) => ({
              part_id: line.id,
              quantity: line.quantity,
              ...(line.serials?.length ? { serials: line.serials } : {}),
              ...(canWarranty && line.warrantyCover
                ? line.warrantyCover === "custom"
                  ? { warranty_until: line.warrantyUntil || null }
                  : { warranty_months: line.warrantyCover === "years" ? Number(line.warrantyAmount) * 12 : Number(line.warrantyAmount) }
                : {}),
            })),
          }),
        });
        router.push(`/bills/${sale.bill.id}`);
        return;
      }
      const sale = await api<{ bill: { id: number } }>("/retail-sales", {
        method: "POST",
        body: JSON.stringify({
          customer_name: form.get("customer_name") || null,
          customer_phone: form.get("customer_phone") || null,
          payment_method: form.get("payment_method") || "cash",
          payment_amount: total,
          items: cart.map((line) => ({ product_id: line.id, quantity: line.quantity })),
        }),
      });
      router.push(`/bills/${sale.bill.id}`);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : t("pos.sale_failed"));
    } finally {
      setSaving(false);
    }
  }

  return (
    <AppShell title={t("pos.title")} eyebrow={isStore ? t("pos.eyebrow_store") : t("pos.eyebrow")}>
      <BillingBranchBanner />
      <div className="flex flex-col-reverse gap-5 xl:grid xl:grid-cols-[1.25fr_0.75fr]">
        <Panel className="p-4">
          <label className="relative block">
            <ScanBarcode className="absolute left-3 top-1/2 -translate-y-1/2 text-[#6f746e]" size={16} />
            <input
              ref={scanRef}
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              onKeyDown={onScanKey}
              autoFocus
              className={`${inputClass} pl-10`}
              placeholder={isStore ? t("pos.scan_placeholder") : t("pos.search_placeholder")}
            />
          </label>
          {error && !saving && <div className="mt-3"><ErrorMessage message={error} /></div>}
          {loading ? <PageState message={t("pos.loading")} /> : (
            <div className="mt-4 grid gap-2 sm:grid-cols-2">
              {items.map((item) => (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => add(item)}
                  disabled={item.stock < 1}
                  className="border border-[#d7d3c8] bg-[#fbfaf6] p-3 text-left hover:border-[#167c73] disabled:opacity-40"
                >
                  <p className="font-semibold">{item.name}</p>
                  <p className="text-xs text-[#6f746e]">{item.detail}</p>
                  <div className="mt-2 flex justify-between text-sm">
                    <strong className="tabular-nums">{money(item.price)}</strong>
                    <span className="text-[#6f746e]">{t("common.left", { count: item.stock })}</span>
                  </div>
                </button>
              ))}
              {items.length === 0 && <p className="col-span-2 p-6 text-center text-sm text-[#6f746e]">{t("pos.no_stock")}</p>}
            </div>
          )}
        </Panel>

        <Panel className="p-5 xl:sticky xl:top-4">
          <h2 className="font-display text-2xl font-semibold uppercase">{t("common.bill")}</h2>
          <div className="mt-4 max-h-[40vh] space-y-3 overflow-y-auto">
            {cart.map((line) => (
              <div key={line.id} className="border-b border-[#e2ded4] pb-2 text-sm">
                <div className="flex flex-wrap items-center gap-x-3 gap-y-2">
                  <div className="min-w-0 flex-1 basis-40">
                    <p className="truncate font-semibold">{line.name}</p>
                    <p className="tabular-nums text-[#6f746e]">{money(line.price)} × {line.quantity}</p>
                    {line.serials?.length ? <p className="mt-1 truncate text-[11px] text-[#6f746e]">{line.serials.join(" · ")}</p> : null}
                  </div>
                  <div className="ml-auto flex shrink-0 items-center gap-2">
                    {!line.serials?.length && (
                      <QtyStepper value={line.quantity} max={line.stock} onChange={(qty) => setQty(line.id, qty, line.stock)} />
                    )}
                    <strong className="shrink-0 whitespace-nowrap text-right text-sm tabular-nums">{money(line.price * line.quantity)}</strong>
                    <button type="button" className="grid size-7 shrink-0 place-items-center text-[#b84837]" onClick={() => setCart((rows) => rows.filter((row) => row.id !== line.id))} aria-label={t("common.remove")}><Trash2 size={14} /></button>
                  </div>
                </div>
                {canWarranty && (
                  <div className="mt-2 flex flex-wrap items-center gap-2">
                    <select
                      value={line.warrantyCover || ""}
                      onChange={(event) => setWarranty(line.id, { warrantyCover: event.target.value as WarrantyCover, warrantyAmount: line.warrantyAmount || 1 })}
                      className="h-8 border border-[#c9c5b9] bg-white px-2 text-[11px] font-semibold uppercase"
                    >
                      <option value="">{t("warranty.no_warranty")}</option>
                      <option value="months">{t("common.months")}</option>
                      <option value="years">{t("common.years")}</option>
                      <option value="custom">{t("warranty.custom_until")}</option>
                    </select>
                    {(line.warrantyCover === "months" || line.warrantyCover === "years") && (
                      <input
                        type="number"
                        min="1"
                        max={line.warrantyCover === "years" ? 10 : 120}
                        value={line.warrantyAmount || 1}
                        onChange={(event) => setWarranty(line.id, { warrantyAmount: Number(event.target.value) })}
                        className="h-8 w-16 border border-[#c9c5b9] bg-white px-2 text-[11px] tabular-nums"
                        aria-label={t("warranty.length_aria")}
                      />
                    )}
                    {line.warrantyCover === "custom" && (
                      <input
                        type="date"
                        value={line.warrantyUntil || ""}
                        onChange={(event) => setWarranty(line.id, { warrantyCover: "custom", warrantyUntil: event.target.value })}
                        className="h-8 border border-[#c9c5b9] bg-white px-2 text-[11px]"
                      />
                    )}
                  </div>
                )}
              </div>
            ))}
            {cart.length === 0 && <p className="text-sm text-[#6f746e]">{isStore ? t("pos.empty_store") : t("pos.empty")}</p>}
          </div>

          {isStore && (
            <label className="mt-4 block text-[10px] font-bold uppercase text-[#6f746e]">
              {t("common.discount")}
              <input
                type="number"
                min="0"
                step="0.01"
                value={discount}
                onChange={(event) => setDiscount(event.target.value)}
                className={`${inputClass} mt-1`}
                placeholder="0.00"
              />
            </label>
          )}

          <div className="mt-4 space-y-1 text-sm">
            {isStore && (
              <div className="flex justify-between text-[#6f746e]">
                <span>{t("common.subtotal")}</span>
                <span className="tabular-nums">{money(subtotal)}</span>
              </div>
            )}
            {isStore && discountAmount > 0 && (
              <div className="flex justify-between text-[#167c73]">
                <span>{t("common.discount")}</span>
                <span className="tabular-nums">-{money(discountAmount)}</span>
              </div>
            )}
            <div className="flex items-baseline justify-between gap-3 pt-1">
              <span className="text-[10px] font-bold uppercase text-[#6f746e]">{t("common.total")}</span>
              <p className="font-display text-3xl font-semibold tabular-nums">{money(total)}</p>
            </div>
          </div>

          <form onSubmit={checkout} className="mt-4 space-y-3">
            <input name="customer_name" placeholder={t("pos.customer_name")} className={inputClass} />
            <input name="customer_phone" placeholder={t("pos.phone")} className={inputClass} />
            <select name="payment_method" className={inputClass} disabled={payLater}>
              <option value="cash">{t("method.cash")}</option>
              <option value="card">{t("method.card")}</option>
              <option value="bank_transfer">{t("method.bank_transfer")}</option>
            </select>
            {isStore && !payLater && (
              <label className="block text-[10px] font-bold uppercase text-[#6f746e]">
                {t("pos.cash_received")}
                <input
                  type="number"
                  min="0"
                  step="0.01"
                  value={tendered}
                  onChange={(event) => setTendered(event.target.value)}
                  className={`${inputClass} mt-1`}
                  placeholder={total > 0 ? String(total) : "0.00"}
                />
              </label>
            )}
            {isStore && changeDue > 0 && (
              <div className="flex justify-between bg-[#167c73]/8 px-3 py-2 text-sm font-semibold text-[#167c73]">
                <span>{t("pos.change")}</span>
                <span className="tabular-nums">{money(changeDue)}</span>
              </div>
            )}
            {isStore && (
              <label className="flex items-center gap-2 text-sm">
                <input type="checkbox" checked={payLater} onChange={(event) => setPayLater(event.target.checked)} className="size-4 accent-[#167c73]" />
                {t("pos.pay_later")}
              </label>
            )}
            {error && <ErrorMessage message={error} />}
            <button disabled={saving || cart.length === 0} className={`${buttonClass} h-12 w-full text-sm sm:h-8 sm:text-[11px]`}>
              {saving ? t("pos.processing") : payLater ? t("pos.open_bill") : t("pos.complete_sale")}
            </button>
          </form>
        </Panel>
      </div>
    </AppShell>
  );
}
