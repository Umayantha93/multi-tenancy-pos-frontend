"use client";

import { FormEvent, useEffect, useState } from "react";
import Link from "next/link";
import { Boxes, Download, PackagePlus, Pencil, Plus, Upload, X } from "lucide-react";
import { AppShell } from "@/components/app-shell";
import { ErrorMessage, PageState, Panel, SuccessMessage, buttonClass, inputClass } from "@/components/ui";
import { halfQty } from "@/components/half-toggle";
import { API_URL, api, currentUser, mediaUrl, money } from "@/lib/api";
import { useBusinessProfile } from "@/lib/use-business-profile";

type Product = {
  id: number;
  name: string;
  sku: string | null;
  barcode?: string | null;
  category: string | null;
  subcategory?: string | null;
  size: string | null;
  color: string | null;
  price: string;
  cost_price?: string;
  stock_qty: number;
  image_urls?: string[];
  images?: string[];
  description?: string | null;
};

type Insights = { worth: number; income: number; profit: number; units: number };
type SizeRow = { size: string; qty: number };
type SizeStock = { apparel: SizeRow[]; jeans: SizeRow[]; footwear: SizeRow[]; other: SizeRow[] };

const SIZE_RUNS = {
  apparel: ["XS", "S", "M", "L", "XL", "XXL"],
  jeans: ["28", "30", "32", "34", "36", "38", "40", "42"],
  footwear: ["EU 39", "EU 40", "EU 41", "EU 42", "EU 43"],
  one: ["One"],
} as const;
type CatalogCategory = { id: number | null; name: string; subcategories: Array<{ id: number | null; name: string }> };
type Supplier = { id: number; name: string };

export default function CatalogPage() {
  const profile = useBusinessProfile();
  const clothing = profile.type === "clothing";
  const [insights, setInsights] = useState<Insights | null>(null);
  const [sizeStock, setSizeStock] = useState<SizeStock | null>(null);
  const [sizeScale, setSizeScale] = useState<keyof typeof SIZE_RUNS>("apparel");
  const [sizeQty, setSizeQty] = useState<Record<string, string>>({});
  const [products, setProducts] = useState<Product[]>([]);
  const [categories, setCategories] = useState<CatalogCategory[]>([]);
  const [suppliers, setSuppliers] = useState<Supplier[]>([]);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [loading, setLoading] = useState(true);
  const [mode, setMode] = useState<"add" | "edit" | "restock" | "import" | null>(null);
  const [selected, setSelected] = useState<Product | null>(null);
  const [categoryDraft, setCategoryDraft] = useState("");
  const [subcategoryDraft, setSubcategoryDraft] = useState("");
  const [saving, setSaving] = useState(false);
  const [importPayment, setImportPayment] = useState("paid");
  const [importDue, setImportDue] = useState("");
  const [importSupplierId, setImportSupplierId] = useState("");
  const [half, setHalf] = useState(false);

  function load() {
    setLoading(true);
    api<{ data: Product[] }>("/products?per_page=500")
      .then((result) => setProducts(result.data))
      .catch((caught) => setError(caught instanceof Error ? caught.message : "Could not load the catalog."))
      .finally(() => setLoading(false));
    api<{ data: CatalogCategory[] }>("/product-categories")
      .then((result) => setCategories(result.data))
      .catch(() => setCategories([]));
  }

  useEffect(load, []);

  useEffect(() => {
    setHalf(Boolean(currentUser()?.tenant?.half_view));
  }, []);

  useEffect(() => {
    if (!clothing) return;
    api<Insights>("/clothing/insights").then(setInsights).catch(() => setInsights(null));
    api<SizeStock>("/products/size-stock").then(setSizeStock).catch(() => setSizeStock(null));
  }, [clothing]);

  useEffect(() => {
    api<{ data: Supplier[] }>("/suppliers?per_page=100").then((result) => setSuppliers(result.data)).catch(() => setSuppliers([]));
  }, []);

  const categoryOptions = categories.map((row) => row.name);
  const subcategoryOptions = categories.find((row) => row.name === categoryDraft)?.subcategories.map((row) => row.name) ?? [];

  function openAdd() {
    setSelected(null);
    setCategoryDraft("");
    setSubcategoryDraft("");
    setMode("add");
    setError("");
  }

  function openEdit(product: Product) {
    setSelected(product);
    setCategoryDraft(product.category ?? "");
    setSubcategoryDraft(product.subcategory ?? "");
    setMode("edit");
    setError("");
  }

  async function saveItem(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSaving(true);
    setError("");
    const form = event.currentTarget;
    const data = new FormData(form);
    data.set("category", categoryDraft);
    data.set("subcategory", subcategoryDraft);
    if (clothing && mode === "add") {
      data.delete("size");
      data.delete("stock_qty");
      data.set("size_scale", sizeScale);
      for (const size of SIZE_RUNS[sizeScale]) {
        data.set(`size_quantities[${size}]`, sizeQty[size] || "0");
      }
    }
    try {
      if (mode === "edit" && selected) {
        await api(`/products/${selected.id}`, { method: "POST", body: data });
        setNotice("Item updated.");
      } else {
        await api("/products", { method: "POST", body: data });
        setNotice("Item added.");
      }
      setMode(null);
      load();
      if (clothing) api<SizeStock>("/products/size-stock").then(setSizeStock).catch(() => undefined);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Could not save the item.");
    } finally {
      setSaving(false);
    }
  }

  async function restock(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!selected) return;
    setSaving(true);
    setError("");
    const data = Object.fromEntries(new FormData(event.currentTarget));
    try {
      await api(`/products/${selected.id}/restock`, {
        method: "POST",
        body: JSON.stringify({
          quantity: Number(data.quantity),
          unit_cost: data.unit_cost === "" ? null : Number(data.unit_cost),
          payment_status: data.payment_status,
          due_date: data.payment_status === "credit" ? data.due_date : null,
          supplier_id: data.supplier_id || null,
        }),
      });
      setNotice("Stock added.");
      setMode(null);
      load();
      if (clothing) api<SizeStock>("/products/size-stock").then(setSizeStock).catch(() => undefined);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Could not restock.");
    } finally {
      setSaving(false);
    }
  }

  async function downloadTemplate() {
    setError("");
    try {
      const token = localStorage.getItem("garage_token");
      const response = await fetch(`${API_URL}/products/import/template`, {
        headers: { Authorization: token ? `Bearer ${token}` : "", Accept: "application/json" },
      });
      if (!response.ok) throw new Error("Could not download the template.");
      const blob = await response.blob();
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = "catalog-import-template.xlsx";
      link.click();
      URL.revokeObjectURL(url);
      setNotice("Template downloaded. Delete the SAMPLE row, then import.");
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Could not download the template.");
    }
  }

  async function importFile(file: File) {
    if (importPayment === "credit" && !importSupplierId) {
      setError("Pick a supplier for a credit import.");
      return;
    }
    setSaving(true);
    setError("");
    const data = new FormData();
    data.set("file", file);
    data.set("payment_status", importPayment);
    if (importPayment === "credit") data.set("due_date", importDue);
    if (importSupplierId) data.set("supplier_id", importSupplierId);
    try {
      const result = await api<{ created: number; restocked: number }>("/products/import", { method: "POST", body: data });
      setNotice(`Imported ${result.created} new item${result.created === 1 ? "" : "s"}${result.restocked ? `, restocked ${result.restocked}` : ""}.`);
      setMode(null);
      load();
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Could not import the file.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <AppShell
      title="Catalog"
      eyebrow="Clothing stock"
      action={(
        <div className="flex flex-wrap items-center gap-2">
          <Link href="/catalog/categories" className="flex h-8 items-center gap-2 border border-[#20221f] bg-white px-2.5 text-[11px] font-semibold">
            <Boxes size={16} /><span className="hidden sm:inline">Categories</span>
          </Link>
          <button type="button" onClick={() => void downloadTemplate()} className="flex h-8 items-center gap-2 border border-[#20221f] bg-white px-2.5 text-[11px] font-semibold">
            <Download size={16} /><span className="hidden sm:inline">Download template</span>
          </button>
          <button type="button" onClick={() => setMode("import")} className="flex h-8 items-center gap-2 border border-[#167c73] bg-white px-2.5 text-[11px] font-semibold text-[#167c73]">
            <Upload size={16} /><span className="hidden sm:inline">Import Excel</span>
          </button>
          <Link href="/catalog/bulk-restock" className="flex h-8 items-center gap-2 border border-[#20221f] bg-white px-2.5 text-[11px] font-semibold">
            <PackagePlus size={16} /><span className="hidden sm:inline">Bulk restock</span>
          </Link>
          <button type="button" onClick={openAdd} className="flex h-8 items-center gap-2 bg-[#f5c842] px-2.5 text-[11px] font-semibold">
            <Plus size={16} /><span className="hidden sm:inline">Add item</span>
          </button>
        </div>
      )}
    >
      {error && <div className="mb-5"><ErrorMessage message={error} /></div>}
      {notice && <div className="mb-5"><SuccessMessage message={notice} /></div>}
      {clothing && insights && (
        <div className="mb-5 grid gap-3 sm:grid-cols-3">
          {[
            ["Worth", insights.worth, "Units on hand × selling price"],
            ["Income", insights.income, "Units on hand × cost"],
            ["Profit", insights.profit, "Worth minus the cost of that stock"],
          ].map(([label, value, hint]) => (
            <Panel key={String(label)} className="p-5">
              <p className="text-[10px] font-bold uppercase text-[#6f746e]">{label}</p>
              <p className="mt-2 font-display text-3xl font-semibold">{money(Number(value))}</p>
              <p className="mt-1 text-xs text-[#6f746e]">{hint}</p>
            </Panel>
          ))}
        </div>
      )}

      {clothing && sizeStock && (
        <div className="mb-5 grid gap-3 lg:grid-cols-2">
          <SizeBoard title="Apparel sizes" hint="XS, S, M, L, XL, XXL on hand" rows={sizeStock.apparel} />
          <SizeBoard title="Jeans sizes" hint="Waist 28, 30, 32, 34, 36, 38, 40, 42 on hand" rows={sizeStock.jeans} />
          {sizeStock.footwear.some((row) => row.qty > 0) && <SizeBoard title="Footwear sizes" hint="Pairs on hand" rows={sizeStock.footwear} />}
          {sizeStock.other.length > 0 && <SizeBoard title="Other sizes" hint="Sizes outside the standard runs" rows={sizeStock.other} />}
        </div>
      )}

      {loading ? <PageState message="Loading catalog..." /> : products.length === 0 ? (
        <PageState message="No items in the catalog yet." />
      ) : (
        <div className="grid items-stretch gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
          {(clothing ? groupStyles(products) : products.map((product) => ({ key: String(product.id), products: [product] }))).map((style) => {
            const product = style.products[0];
            const pictured = style.products.find((row) => row.image_urls?.[0] || row.images?.[0]) ?? product;
            const image = mediaUrl(pictured.image_urls?.[0] || pictured.images?.[0]);
            return (
              <Panel key={style.key} className="flex h-full flex-col overflow-hidden">
                <div className="relative aspect-[16/10] w-full overflow-hidden bg-[#e8e5dc]">
                  {image ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={image} alt="" className="absolute inset-0 size-full object-contain" />
                  ) : (
                    <div className="absolute inset-0 grid place-items-center"><Boxes size={28} className="text-[#a7aaa4]" /></div>
                  )}
                </div>
                <div className="flex-1 p-3">
                  <p className="text-[10px] font-bold uppercase text-[#167c73]">{[product.category, product.subcategory].filter(Boolean).join(" · ") || "Uncategorised"}</p>
                  <h2 className="mt-1 truncate font-display text-lg font-semibold uppercase leading-none">{product.name}</h2>
                  <p className="mt-2 text-xs text-[#6f746e]">{product.color || product.sku || "—"}</p>
                  <div className="mt-2 flex flex-wrap gap-1">
                    {style.products.map((row) => {
                      const qty = half ? halfQty(row.stock_qty) : Number(row.stock_qty);
                      return (
                        <button key={row.id} type="button" onClick={() => openEdit(row)} className={`px-1.5 py-0.5 text-[10px] font-bold ${qty < 10 ? "bg-[#b84837]/10 text-[#b84837]" : "bg-[#167c73]/10 text-[#167c73]"}`}>
                          {row.size || "One"} {qty}
                        </button>
                      );
                    })}
                  </div>
                  <div className="mt-2 flex items-center justify-between">
                    <p className="font-display text-lg font-semibold">{money(product.price)}</p>
                    <span className="text-[10px] font-bold uppercase text-[#6f746e]">{style.products.reduce((sum, row) => sum + (half ? halfQty(row.stock_qty) : Number(row.stock_qty)), 0)} total</span>
                  </div>
                </div>
                <div className="mt-auto flex border-t border-[#d7d3c8]">
                  <button type="button" onClick={() => openEdit(product)} className="flex flex-1 items-center justify-center gap-1.5 py-2 text-[10px] font-bold uppercase hover:bg-[#eeece5]">
                    <Pencil size={12} /> Edit
                  </button>
                  <button type="button" onClick={() => { setSelected(product); setMode("restock"); }} className="flex flex-1 items-center justify-center gap-1.5 border-l border-[#d7d3c8] py-2 text-[10px] font-bold uppercase text-[#167c73] hover:bg-[#eeece5]">
                    <PackagePlus size={12} /> Restock
                  </button>
                </div>
              </Panel>
            );
          })}
        </div>
      )}

      {(mode === "add" || mode === "edit") && (
        <div className="fixed inset-0 z-50 grid place-items-center overflow-y-auto bg-black/55 p-4">
          <form onSubmit={saveItem} className="my-8 w-full max-w-2xl bg-[#f3f0e8]">
            <div className="flex items-center justify-between border-b border-[#d7d3c8] p-5">
              <h2 className="font-display text-3xl font-semibold uppercase">{mode === "edit" ? "Edit item" : "Add item"}</h2>
              <button type="button" onClick={() => setMode(null)} aria-label="Close"><X /></button>
            </div>
            <div className="grid gap-4 p-5 sm:grid-cols-2">
              <label className="text-xs font-bold uppercase sm:col-span-2">Name
                <input name="name" required defaultValue={selected?.name ?? ""} className={`${inputClass} mt-2`} />
              </label>
              <label className="text-xs font-bold uppercase">SKU
                <input name="sku" defaultValue={selected?.sku ?? ""} className={`${inputClass} mt-2`} />
              </label>
              <label className="text-xs font-bold uppercase">Barcode
                <input name="barcode" defaultValue={selected?.barcode ?? ""} className={`${inputClass} mt-2`} />
              </label>
              <label className="text-xs font-bold uppercase">Category
                <select value={categoryDraft} onChange={(event) => { setCategoryDraft(event.target.value); setSubcategoryDraft(""); }} className={`${inputClass} mt-2`}>
                  <option value="">Select category</option>
                  {categoryOptions.map((name) => <option key={name} value={name}>{name}</option>)}
                </select>
              </label>
              <label className="text-xs font-bold uppercase">Sub category
                <select value={subcategoryDraft} onChange={(event) => setSubcategoryDraft(event.target.value)} className={`${inputClass} mt-2`}>
                  <option value="">None</option>
                  {subcategoryOptions.map((name) => <option key={name} value={name}>{name}</option>)}
                </select>
              </label>
              {clothing && mode === "add" ? (
                <div className="sm:col-span-2">
                  <label className="text-xs font-bold uppercase">Size run
                    <select value={sizeScale} onChange={(event) => setSizeScale(event.target.value as keyof typeof SIZE_RUNS)} className={`${inputClass} mt-2`}>
                      <option value="apparel">Apparel — XS, S, M, L, XL, XXL</option>
                      <option value="jeans">Jeans — 28, 30, 32, 34, 36, 38, 40, 42</option>
                      <option value="footwear">Footwear — EU 39 to 43</option>
                      <option value="one">One size</option>
                    </select>
                  </label>
                  <div className="mt-3 grid grid-cols-4 gap-2 sm:grid-cols-8">
                    {SIZE_RUNS[sizeScale].map((size) => (
                      <label key={size} className="text-[10px] font-bold uppercase">
                        {size}
                        <input
                          type="number"
                          min="0"
                          value={sizeQty[size] ?? ""}
                          onChange={(event) => setSizeQty((current) => ({ ...current, [size]: event.target.value }))}
                          placeholder="0"
                          className={`${inputClass} mt-1 px-2`}
                        />
                      </label>
                    ))}
                  </div>
                </div>
              ) : (
              <label className="text-xs font-bold uppercase">Size
                <input name="size" defaultValue={selected?.size ?? ""} className={`${inputClass} mt-2`} />
              </label>
              )}
              <label className="text-xs font-bold uppercase">Color
                <input name="color" defaultValue={selected?.color ?? ""} className={`${inputClass} mt-2`} />
              </label>
              <label className="text-xs font-bold uppercase">Selling price
                <input name="price" required type="number" min="0" step="0.01" defaultValue={selected?.price ?? ""} className={`${inputClass} mt-2`} />
              </label>
              <label className="text-xs font-bold uppercase">Cost
                <input name="cost_price" type="number" min="0" step="0.01" defaultValue={selected?.cost_price ?? ""} className={`${inputClass} mt-2`} />
              </label>
              {mode === "add" && !clothing && (
                <label className="text-xs font-bold uppercase sm:col-span-2">Opening stock
                  <input name="stock_qty" type="number" min="0" defaultValue="0" className={`${inputClass} mt-2`} />
                </label>
              )}
              <label className="text-xs font-bold uppercase sm:col-span-2">Images
                <input name="images[]" type="file" accept="image/*" multiple className="mt-2 block w-full border border-[#c9c5b9] bg-white p-3 text-sm" />
              </label>
              {(() => {
                const src = mediaUrl(selected?.image_urls?.[0]);
                return src ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={src} alt="" className="h-20 w-20 object-contain border border-[#d7d3c8] bg-white" />
                ) : null;
              })()}
            </div>
            <div className="flex justify-end gap-2 border-t border-[#d7d3c8] p-5">
              <button type="button" onClick={() => setMode(null)} className="h-10 border border-[#c9c5b9] bg-white px-4 text-sm font-semibold">Cancel</button>
              <button disabled={saving} className={buttonClass}>{saving ? "Saving..." : "Save item"}</button>
            </div>
          </form>
        </div>
      )}

      {mode === "restock" && selected && (
        <div className="fixed inset-0 z-50 grid place-items-center bg-black/55 p-4">
          <form onSubmit={restock} className="w-full max-w-md bg-[#f3f0e8] p-5">
            <div className="flex items-center justify-between">
              <h2 className="font-display text-2xl font-semibold uppercase">Restock {selected.name}</h2>
              <button type="button" onClick={() => setMode(null)} aria-label="Close"><X /></button>
            </div>
            <div className="mt-4 grid gap-3">
              <input name="quantity" required type="number" min="1" placeholder="Quantity" className={inputClass} />
              <input name="unit_cost" type="number" min="0" step="0.01" placeholder="Unit cost" className={inputClass} />
              <select name="payment_status" defaultValue="paid" className={inputClass}>
                <option value="paid">Paid now</option>
                <option value="credit">Buy on credit</option>
              </select>
              <input name="due_date" type="date" className={inputClass} />
              <select name="supplier_id" defaultValue="" className={inputClass}>
                <option value="">No supplier</option>
                {suppliers.map((supplier) => <option key={supplier.id} value={supplier.id}>{supplier.name}</option>)}
              </select>
              <button disabled={saving} className={buttonClass}>{saving ? "Saving..." : "Add stock"}</button>
            </div>
          </form>
        </div>
      )}

      {mode === "import" && (
        <div className="fixed inset-0 z-50 grid place-items-center bg-black/55 p-4">
          <div className="w-full max-w-md bg-[#f3f0e8] p-5">
            <div className="flex items-center justify-between">
              <h2 className="font-display text-2xl font-semibold uppercase">Import Excel</h2>
              <button type="button" onClick={() => setMode(null)} aria-label="Close"><X /></button>
            </div>
            <p className="mt-2 text-sm text-[#6f746e]">Download the template, delete the SAMPLE row, then choose the filled file.</p>
            <div className="mt-4 grid gap-3">
              <select value={importPayment} onChange={(event) => setImportPayment(event.target.value)} className={inputClass}>
                <option value="paid">Paid now</option>
                <option value="credit">Buy on credit</option>
              </select>
              {importPayment === "credit" && <input type="date" value={importDue} onChange={(event) => setImportDue(event.target.value)} className={inputClass} />}
              <select value={importSupplierId} onChange={(event) => setImportSupplierId(event.target.value)} className={inputClass}>
                <option value="">Supplier</option>
                {suppliers.map((supplier) => <option key={supplier.id} value={supplier.id}>{supplier.name}</option>)}
              </select>
              <input
                type="file"
                accept=".xlsx,.xls,.csv"
                disabled={saving}
                onChange={(event) => {
                  const file = event.target.files?.[0];
                  if (file) void importFile(file);
                }}
                className="block w-full border border-[#c9c5b9] bg-white p-3 text-sm"
              />
            </div>
          </div>
        </div>
      )}
    </AppShell>
  );
}

function SizeBoard({ title, hint, rows }: { title: string; hint: string; rows: SizeRow[] }) {
  return (
    <Panel className="p-4">
      <p className="text-xs font-bold uppercase">{title}</p>
      <p className="mt-1 text-xs text-[#6f746e]">{hint}</p>
      <div className="mt-3 flex flex-wrap gap-2">
        {rows.map((row) => (
          <div key={row.size} className="min-w-14 border border-[#d7d3c8] bg-white px-2 py-1.5 text-center">
            <p className="text-[10px] font-bold uppercase text-[#6f746e]">{row.size}</p>
            <p className={`font-display text-xl font-semibold ${row.qty < 10 ? "text-[#b84837]" : ""}`}>{row.qty}</p>
          </div>
        ))}
      </div>
    </Panel>
  );
}

function groupStyles(products: Product[]) {
  const groups = new Map<string, Product[]>();
  for (const product of products) {
    const key = [product.name, product.color || "", product.category || ""].join("||");
    const list = groups.get(key) ?? [];
    list.push(product);
    groups.set(key, list);
  }
  const rank = (size: string) => {
    const lists = [SIZE_RUNS.apparel, SIZE_RUNS.jeans, SIZE_RUNS.footwear, SIZE_RUNS.one];
    for (let index = 0; index < lists.length; index += 1) {
      const at = lists[index].indexOf(size as never);
      if (at >= 0) return index * 100 + at;
    }
    return 1000;
  };
  return [...groups.entries()].map(([key, rows]) => ({
    key,
    products: [...rows].sort((a, b) => rank(a.size || "") - rank(b.size || "")),
  }));
}
