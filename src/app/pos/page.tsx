"use client";

import { FormEvent, KeyboardEvent, useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Minus, Plus, ScanBarcode, Trash2 } from "lucide-react";
import { AppShell } from "@/components/app-shell";
import { ErrorMessage, PageState, Panel, buttonClass, inputClass } from "@/components/ui";
import { api, currentFeatures, money } from "@/lib/api";
import { usesStoreCounter } from "@/lib/business-profiles";
import { useBusinessProfile } from "@/lib/use-business-profile";
import { BillingBranchBanner } from "@/components/branch-chip";

type Part = { id: number; name: string; sku?: string | null; barcode?: string | null; brand?: string; price: string; stock_qty: number };
type Product = { id: number; name: string; sku: string | null; size: string | null; color: string | null; price: string; stock_qty: number };
type WarrantyCover = "" | "12" | "24" | "custom";
type CartLine = { id: number; name: string; detail: string; price: number; stock: number; quantity: number; warrantyCover?: WarrantyCover; warrantyUntil?: string };

function toCartLine(row: Part | Product, store: boolean): CartLine {
  if (store) {
    const part = row as Part;
    return {
      id: part.id,
      name: part.name,
      detail: [part.barcode, part.sku, part.brand].filter(Boolean).join(" · ") || "Stock",
      price: Number(part.price),
      stock: part.stock_qty,
      quantity: 1,
      warrantyCover: "",
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
      .then((result) => setItems(result.data.map((row) => toCartLine(row, isStore))))
      .catch((caught) => setError(caught instanceof Error ? caught.message : "Could not load catalog."))
      .finally(() => setLoading(false));
  }, [search, isStore, profile.type, sessionReady]);

  const subtotal = useMemo(() => cart.reduce((sum, line) => sum + line.price * line.quantity, 0), [cart]);
  const discountAmount = Math.min(Math.max(0, Number(discount || 0)), subtotal);
  const total = Math.max(0, subtotal - discountAmount);
  const tenderedAmount = Number(tendered || 0);
  const changeDue = !payLater && tenderedAmount > total ? tenderedAmount - total : 0;

  function add(item: CartLine) {
    if (item.stock < 1) return;
    setCart((lines) => {
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
    setCart((lines) => lines.map((line) => line.id === id ? { ...line, quantity: next } : line));
  }

  function setWarranty(id: number, warrantyCover: WarrantyCover, warrantyUntil?: string) {
    setCart((lines) => lines.map((line) => line.id === id ? { ...line, warrantyCover, warrantyUntil: warrantyCover === "custom" ? warrantyUntil ?? line.warrantyUntil : undefined } : line));
  }

  async function scanExact(needle: string): Promise<CartLine | null> {
    if (!isStore || !needle) return null;
    try {
      const exact = await api<{ data: Part[] }>(`/parts?barcode=${encodeURIComponent(needle)}&per_page=1`);
      if (exact.data[0]) return toCartLine(exact.data[0], true);
      const sku = await api<{ data: Part[] }>(`/parts?search=${encodeURIComponent(needle)}&per_page=5`);
      const match = sku.data.find((part) =>
        part.barcode?.toLowerCase() === needle.toLowerCase()
        || part.sku?.toLowerCase() === needle.toLowerCase()
        || part.name.toLowerCase() === needle.toLowerCase()
      );
      return match ? toCartLine(match, true) : null;
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
      setError("Choose the warranty end date.");
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
              ...(canWarranty && line.warrantyCover
                ? line.warrantyCover === "custom"
                  ? { warranty_until: line.warrantyUntil || null }
                  : { warranty_months: Number(line.warrantyCover) }
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
      setError(caught instanceof Error ? caught.message : "Sale failed.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <AppShell title="New sale" eyebrow={isStore ? "Counter" : "Point of sale"}>
      <BillingBranchBanner />
      <div className="grid gap-5 xl:grid-cols-[1.25fr_0.75fr]">
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
              placeholder={isStore ? "Scan barcode or type name / SKU" : "Search catalog"}
            />
          </label>
          {error && !saving && <div className="mt-3"><ErrorMessage message={error} /></div>}
          {loading ? <PageState message="Loading catalog..." /> : (
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
                    <span className="text-[#6f746e]">{item.stock} left</span>
                  </div>
                </button>
              ))}
              {items.length === 0 && <p className="col-span-2 p-6 text-center text-sm text-[#6f746e]">No matching stock.</p>}
            </div>
          )}
        </Panel>

        <Panel className="p-5 xl:sticky xl:top-4">
          <h2 className="font-display text-2xl font-semibold uppercase">Bill</h2>
          <div className="mt-4 max-h-[40vh] space-y-3 overflow-y-auto">
            {cart.map((line) => (
              <div key={line.id} className="border-b border-[#e2ded4] pb-2 text-sm">
                <div className="flex items-center justify-between gap-2">
                  <div className="min-w-0">
                    <p className="truncate font-semibold">{line.name}</p>
                    <p className="tabular-nums text-[#6f746e]">{money(line.price)} × {line.quantity}</p>
                  </div>
                  <div className="flex items-center gap-2">
                    <button type="button" className="grid size-8 place-items-center border" onClick={() => setQty(line.id, line.quantity - 1, line.stock)}><Minus size={14} /></button>
                    <input
                      type="number"
                      min={1}
                      max={line.stock}
                      value={line.quantity}
                      onChange={(event) => setQty(line.id, Number(event.target.value), line.stock)}
                      className="h-8 w-12 border border-[#c9c5b9] bg-white text-center text-sm tabular-nums"
                    />
                    <button type="button" className="grid size-8 place-items-center border" onClick={() => setQty(line.id, line.quantity + 1, line.stock)}><Plus size={14} /></button>
                    <strong className="w-16 text-right tabular-nums">{money(line.price * line.quantity)}</strong>
                    <button type="button" className="text-[#b84837]" onClick={() => setCart((rows) => rows.filter((row) => row.id !== line.id))}><Trash2 size={16} /></button>
                  </div>
                </div>
                {canWarranty && (
                  <div className="mt-2 flex flex-wrap items-center gap-2">
                    <select
                      value={line.warrantyCover || ""}
                      onChange={(event) => setWarranty(line.id, event.target.value as WarrantyCover)}
                      className="h-8 border border-[#c9c5b9] bg-white px-2 text-[11px] font-semibold uppercase"
                    >
                      <option value="">No warranty</option>
                      <option value="12">1 year</option>
                      <option value="24">2 years</option>
                      <option value="custom">Custom until</option>
                    </select>
                    {line.warrantyCover === "custom" && (
                      <input
                        type="date"
                        value={line.warrantyUntil || ""}
                        onChange={(event) => setWarranty(line.id, "custom", event.target.value)}
                        className="h-8 border border-[#c9c5b9] bg-white px-2 text-[11px]"
                      />
                    )}
                  </div>
                )}
              </div>
            ))}
            {cart.length === 0 && <p className="text-sm text-[#6f746e]">{isStore ? "Scan or tap items to start the bill." : "Tap products to add them."}</p>}
          </div>

          {isStore && (
            <label className="mt-4 block text-[10px] font-bold uppercase text-[#6f746e]">
              Discount
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
                <span>Subtotal</span>
                <span className="tabular-nums">{money(subtotal)}</span>
              </div>
            )}
            {isStore && discountAmount > 0 && (
              <div className="flex justify-between text-[#167c73]">
                <span>Discount</span>
                <span className="tabular-nums">-{money(discountAmount)}</span>
              </div>
            )}
            <div className="flex items-baseline justify-between gap-3 pt-1">
              <span className="text-[10px] font-bold uppercase text-[#6f746e]">Total</span>
              <p className="font-display text-3xl font-semibold tabular-nums">{money(total)}</p>
            </div>
          </div>

          <form onSubmit={checkout} className="mt-4 space-y-3">
            <input name="customer_name" placeholder="Customer name (optional)" className={inputClass} />
            <input name="customer_phone" placeholder="Phone (optional)" className={inputClass} />
            <select name="payment_method" className={inputClass} disabled={payLater}>
              <option value="cash">Cash</option>
              <option value="card">Card</option>
              <option value="bank_transfer">Bank transfer</option>
            </select>
            {isStore && !payLater && (
              <label className="block text-[10px] font-bold uppercase text-[#6f746e]">
                Cash received
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
                <span>Change</span>
                <span className="tabular-nums">{money(changeDue)}</span>
              </div>
            )}
            {isStore && (
              <label className="flex items-center gap-2 text-sm">
                <input type="checkbox" checked={payLater} onChange={(event) => setPayLater(event.target.checked)} className="size-4 accent-[#167c73]" />
                Open bill — pay later
              </label>
            )}
            {error && <ErrorMessage message={error} />}
            <button disabled={saving || cart.length === 0} className={`${buttonClass} w-full`}>
              {saving ? "Processing..." : payLater ? "Open bill" : "Complete sale"}
            </button>
          </form>
        </Panel>
      </div>
    </AppShell>
  );
}
