"use client";

import { FormEvent, useEffect, useState } from "react";
import Link from "next/link";
import { ArrowLeft, Plus, Trash2 } from "lucide-react";
import { AppShell } from "@/components/app-shell";
import { buttonClass, ErrorMessage, inputClass, Panel, SuccessMessage } from "@/components/ui";
import { api } from "@/lib/api";

type Product = { id: number; name: string; sku: string | null; size: string | null; stock_qty: number };
type Supplier = { id: number; name: string };
type Line = { key: string; productId: string; quantity: string; unitCost: string };

export default function CatalogBulkRestockPage() {
  const [products, setProducts] = useState<Product[]>([]);
  const [suppliers, setSuppliers] = useState<Supplier[]>([]);
  const [lines, setLines] = useState<Line[]>([{ key: "1", productId: "", quantity: "", unitCost: "" }]);
  const [payment, setPayment] = useState("paid");
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    api<{ data: Product[] }>("/products?per_page=500").then((result) => setProducts(result.data)).catch(() => setProducts([]));
    api<{ data: Supplier[] }>("/suppliers?per_page=100").then((result) => setSuppliers(result.data)).catch(() => setSuppliers([]));
  }, []);

  function update(key: string, patch: Partial<Line>) {
    setLines((current) => current.map((line) => (line.key === key ? { ...line, ...patch } : line)));
  }

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const items = lines
      .filter((line) => line.productId && Number(line.quantity) > 0)
      .map((line) => ({
        product_id: Number(line.productId),
        quantity: Number(line.quantity),
        unit_cost: line.unitCost === "" ? null : Number(line.unitCost),
      }));
    if (items.length === 0) {
      setError("Add at least one item and a quantity.");
      return;
    }
    setSaving(true);
    setError("");
    setNotice("");
    try {
      const result = await api<{ updated: number }>("/products/restock/bulk", {
        method: "POST",
        body: JSON.stringify({
          items,
          payment_status: payment,
          due_date: payment === "credit" ? form.get("due_date") : null,
          supplier_id: form.get("supplier_id") || null,
          expense_date: form.get("expense_date") || null,
        }),
      });
      setNotice(`Restocked ${result.updated} item${result.updated === 1 ? "" : "s"}.`);
      setLines([{ key: String(Date.now()), productId: "", quantity: "", unitCost: "" }]);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Could not restock.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <AppShell
      title="Bulk restock"
      eyebrow="Add stock to several catalog items"
      action={(
        <Link href="/catalog" className="flex h-8 items-center gap-2 border border-[#20221f] bg-white px-2.5 text-[11px] font-semibold">
          <ArrowLeft size={16} /><span className="hidden sm:inline">Catalog</span>
        </Link>
      )}
    >
      {error && <div className="mb-5"><ErrorMessage message={error} /></div>}
      {notice && <div className="mb-5"><SuccessMessage message={notice} /></div>}
      <form onSubmit={submit}>
        <Panel className="p-5">
          <div className="grid gap-3 sm:grid-cols-4">
            <label className="text-xs font-bold uppercase">Payment
              <select value={payment} onChange={(event) => setPayment(event.target.value)} className={`${inputClass} mt-2`}>
                <option value="paid">Paid now</option>
                <option value="credit">Buy on credit</option>
              </select>
            </label>
            <label className="text-xs font-bold uppercase">Supplier
              <select name="supplier_id" className={`${inputClass} mt-2`}>
                <option value="">No supplier</option>
                {suppliers.map((supplier) => <option key={supplier.id} value={supplier.id}>{supplier.name}</option>)}
              </select>
            </label>
            <label className="text-xs font-bold uppercase">Date
              <input name="expense_date" type="date" className={`${inputClass} mt-2`} />
            </label>
            {payment === "credit" && (
              <label className="text-xs font-bold uppercase">Due date
                <input name="due_date" type="date" required className={`${inputClass} mt-2`} />
              </label>
            )}
          </div>
          <div className="mt-5 space-y-2">
            {lines.map((line) => (
              <div key={line.key} className="grid gap-2 sm:grid-cols-[1.4fr_0.5fr_0.6fr_auto]">
                <select value={line.productId} onChange={(event) => update(line.key, { productId: event.target.value })} className={inputClass}>
                  <option value="">Item</option>
                  {products.map((product) => (
                    <option key={product.id} value={product.id}>
                      {product.name}{product.size ? ` · ${product.size}` : ""} · {product.stock_qty} on hand
                    </option>
                  ))}
                </select>
                <input value={line.quantity} onChange={(event) => update(line.key, { quantity: event.target.value })} type="number" min="1" placeholder="Qty" className={inputClass} />
                <input value={line.unitCost} onChange={(event) => update(line.key, { unitCost: event.target.value })} type="number" min="0" step="0.01" placeholder="Unit cost" className={inputClass} />
                <button type="button" onClick={() => setLines((current) => current.filter((row) => row.key !== line.key))} className="grid h-10 w-10 place-items-center border border-[#c9c5b9]" aria-label="Remove line">
                  <Trash2 size={14} />
                </button>
              </div>
            ))}
          </div>
          <div className="mt-4 flex flex-wrap gap-2">
            <button type="button" onClick={() => setLines((current) => [...current, { key: String(Date.now()), productId: "", quantity: "", unitCost: "" }])} className="flex h-10 items-center gap-2 border border-[#20221f] bg-white px-3 text-sm font-semibold">
              <Plus size={14} /> Add line
            </button>
            <button disabled={saving} className={buttonClass}>{saving ? "Saving..." : "Restock"}</button>
          </div>
        </Panel>
      </form>
    </AppShell>
  );
}
