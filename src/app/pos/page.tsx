"use client";

import { FormEvent, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { Minus, Plus, Trash2 } from "lucide-react";
import { AppShell } from "@/components/app-shell";
import { ErrorMessage, PageState, Panel, buttonClass, inputClass } from "@/components/ui";
import { api, money } from "@/lib/api";

type Product = { id: number; name: string; sku: string | null; size: string | null; color: string | null; price: string; stock_qty: number };
type CartLine = { product: Product; quantity: number };

export default function PosPage() {
  const router = useRouter();
  const [products, setProducts] = useState<Product[]>([]);
  const [cart, setCart] = useState<CartLine[]>([]);
  const [search, setSearch] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    setLoading(true);
    api<{ data: Product[] }>(`/products?active_only=1&search=${encodeURIComponent(search)}&per_page=50`)
      .then((result) => setProducts(result.data))
      .catch((caught) => setError(caught.message))
      .finally(() => setLoading(false));
  }, [search]);

  const total = useMemo(() => cart.reduce((sum, line) => sum + Number(line.product.price) * line.quantity, 0), [cart]);

  function add(product: Product) {
    setCart((lines) => {
      const existing = lines.find((line) => line.product.id === product.id);
      if (existing) {
        return lines.map((line) => line.product.id === product.id ? { ...line, quantity: line.quantity + 1 } : line);
      }
      return [...lines, { product, quantity: 1 }];
    });
  }

  async function checkout(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (cart.length === 0) return;
    setSaving(true);
    setError("");
    const form = new FormData(event.currentTarget);
    try {
      const sale = await api<{ bill: { id: number } }>("/retail-sales", {
        method: "POST",
        body: JSON.stringify({
          customer_name: form.get("customer_name") || null,
          customer_phone: form.get("customer_phone") || null,
          payment_method: form.get("payment_method") || "cash",
          payment_amount: total,
          items: cart.map((line) => ({ product_id: line.product.id, quantity: line.quantity })),
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
    <AppShell title="New sale" eyebrow="Point of sale">
      <div className="grid gap-5 xl:grid-cols-[1.2fr_0.8fr]">
        <Panel className="p-4">
          <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search catalog" className={`mb-4 ${inputClass}`} />
          {error && !saving && <div className="mb-3"><ErrorMessage message={error} /></div>}
          {loading ? <PageState message="Loading catalog..." /> : (
            <div className="grid gap-2 sm:grid-cols-2">
              {products.map((product) => (
                <button key={product.id} type="button" onClick={() => add(product)} disabled={product.stock_qty < 1} className="border border-[#d7d3c8] p-3 text-left hover:border-[#167c73] disabled:opacity-40">
                  <p className="font-semibold">{product.name}</p>
                  <p className="text-xs text-[#6f746e]">{[product.size, product.color].filter(Boolean).join(" · ") || product.sku || "Item"}</p>
                  <div className="mt-2 flex justify-between text-sm"><strong>{money(product.price)}</strong><span>{product.stock_qty} left</span></div>
                </button>
              ))}
              {products.length === 0 && <p className="col-span-2 p-6 text-center text-sm text-[#6f746e]">No products match.</p>}
            </div>
          )}
        </Panel>
        <Panel className="p-5">
          <h2 className="font-display text-2xl font-semibold uppercase">Cart</h2>
          <div className="mt-4 space-y-3">
            {cart.map((line) => (
              <div key={line.product.id} className="flex items-center justify-between gap-2 border-b border-[#e2ded4] pb-2 text-sm">
                <div className="min-w-0">
                  <p className="truncate font-semibold">{line.product.name}</p>
                  <p className="text-[#6f746e]">{money(line.product.price)}</p>
                </div>
                <div className="flex items-center gap-2">
                  <button type="button" className="grid size-8 place-items-center border" onClick={() => setCart((rows) => rows.map((r) => r.product.id === line.product.id ? { ...r, quantity: Math.max(1, r.quantity - 1) } : r))}><Minus size={14} /></button>
                  <span className="w-6 text-center font-semibold">{line.quantity}</span>
                  <button type="button" className="grid size-8 place-items-center border" onClick={() => setCart((rows) => rows.map((r) => r.product.id === line.product.id ? { ...r, quantity: r.quantity + 1 } : r))}><Plus size={14} /></button>
                  <button type="button" className="text-[#b84837]" onClick={() => setCart((rows) => rows.filter((r) => r.product.id !== line.product.id))}><Trash2 size={16} /></button>
                </div>
              </div>
            ))}
            {cart.length === 0 && <p className="text-sm text-[#6f746e]">Tap products to add them.</p>}
          </div>
          <p className="mt-4 font-display text-3xl font-semibold">{money(total)}</p>
          <form onSubmit={checkout} className="mt-4 space-y-3">
            <input name="customer_name" placeholder="Customer name (optional)" className={inputClass} />
            <input name="customer_phone" placeholder="Phone (optional)" className={inputClass} />
            <select name="payment_method" className={inputClass}>
              <option value="cash">Cash</option>
              <option value="card">Card</option>
              <option value="transfer">Transfer</option>
            </select>
            {error && saving === false && cart.length > 0 && null}
            {error && <ErrorMessage message={error} />}
            <button disabled={saving || cart.length === 0} className={`${buttonClass} w-full`}>{saving ? "Processing..." : "Complete sale"}</button>
          </form>
        </Panel>
      </div>
    </AppShell>
  );
}
