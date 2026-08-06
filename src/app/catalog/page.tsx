"use client";

import { FormEvent, useEffect, useState } from "react";
import { Plus } from "lucide-react";
import { AppShell } from "@/components/app-shell";
import { ErrorMessage, PageState, Panel, buttonClass, inputClass } from "@/components/ui";
import { api, money } from "@/lib/api";

type Product = {
  id: number;
  name: string;
  sku: string | null;
  category: string | null;
  size: string | null;
  color: string | null;
  price: string;
  stock_qty: number;
};

export default function CatalogPage() {
  const [products, setProducts] = useState<Product[]>([]);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);

  function load() {
    setLoading(true);
    api<{ data: Product[] }>("/products?per_page=100")
      .then((result) => setProducts(result.data))
      .catch((caught) => setError(caught.message))
      .finally(() => setLoading(false));
  }

  useEffect(load, []);

  async function create(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");
    const form = event.currentTarget;
    const data = new FormData(form);
    try {
      await api("/products", {
        method: "POST",
        body: JSON.stringify({
          name: data.get("name"),
          sku: data.get("sku") || null,
          category: data.get("category") || null,
          size: data.get("size") || null,
          color: data.get("color") || null,
          price: Number(data.get("price")),
          cost_price: Number(data.get("cost_price") || 0),
          stock_qty: Number(data.get("stock_qty") || 0),
        }),
      });
      form.reset();
      load();
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Unable to save product.");
    }
  }

  return (
    <AppShell title="Catalog" eyebrow="Clothing stock">
      <div className="grid gap-5 xl:grid-cols-[0.85fr_1.15fr]">
        <Panel className="p-5">
          <h2 className="font-display text-2xl font-semibold uppercase">Add product</h2>
          <form onSubmit={create} className="mt-4 grid gap-3 sm:grid-cols-2">
            <input name="name" required placeholder="Name" className={`sm:col-span-2 ${inputClass}`} />
            <input name="sku" placeholder="SKU" className={inputClass} />
            <input name="category" placeholder="Category" className={inputClass} />
            <input name="size" placeholder="Size" className={inputClass} />
            <input name="color" placeholder="Color" className={inputClass} />
            <input name="price" required type="number" min="0" step="0.01" placeholder="Price" className={inputClass} />
            <input name="cost_price" type="number" min="0" step="0.01" placeholder="Cost" className={inputClass} />
            <input name="stock_qty" type="number" min="0" placeholder="Stock qty" className={`sm:col-span-2 ${inputClass}`} />
            <button className={`${buttonClass} sm:col-span-2`}><Plus size={16} /> Save product</button>
          </form>
        </Panel>
        <Panel>
          {error && <div className="p-4"><ErrorMessage message={error} /></div>}
          {loading ? <PageState message="Loading catalog..." /> : (
            <div className="overflow-x-auto">
              <table className="w-full min-w-[640px] text-left text-sm">
                <thead className="bg-[#eeece5] text-[10px] uppercase text-[#6f746e]">
                  <tr><th className="px-5 py-3">Product</th><th>Size</th><th>Color</th><th>Stock</th><th className="pr-5 text-right">Price</th></tr>
                </thead>
                <tbody>
                  {products.map((product) => (
                    <tr key={product.id} className="border-t border-[#e2ded4]">
                      <td className="px-5 py-3 font-semibold">{product.name}<div className="text-xs font-normal text-[#6f746e]">{product.sku || product.category || ""}</div></td>
                      <td>{product.size || "—"}</td>
                      <td>{product.color || "—"}</td>
                      <td>{product.stock_qty}</td>
                      <td className="pr-5 text-right font-semibold">{money(product.price)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
              {products.length === 0 && <p className="p-8 text-center text-sm text-[#6f746e]">No products yet.</p>}
            </div>
          )}
        </Panel>
      </div>
    </AppShell>
  );
}
