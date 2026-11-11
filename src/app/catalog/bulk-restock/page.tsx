"use client";

import { CSSProperties, FormEvent, Fragment, KeyboardEvent, useCallback, useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import Link from "next/link";
import { ArrowLeft, ChevronDown, ChevronRight, Loader2, Plus, ScanBarcode, Search, Trash2 } from "lucide-react";
import { AppShell } from "@/components/app-shell";
import { buttonClass, ErrorMessage, inputClass, ListPager, Panel, SuccessMessage } from "@/components/ui";
import { api, formatDate, money } from "@/lib/api";
import { useBusinessProfile } from "@/lib/use-business-profile";

type Product = {
  id: number;
  name: string;
  sku: string | null;
  barcode?: string | null;
  category: string | null;
  color: string | null;
  size: string | null;
  price: number | string;
  cost_price?: number | string | null;
  stock_qty: number;
};
type Supplier = { id: number; name: string };
type CatalogCategory = { id: number | null; name: string; subcategories: Array<{ id: number | null; name: string }> };
type Style = { key: string; label: string; products: Product[] };
type SizeScale = "apparel" | "jeans" | "footwear" | "one";
type NewGarment = {
  name: string;
  sku: string;
  barcode: string;
  category: string;
  subcategory: string;
  color: string;
  sizeScale: SizeScale | "";
  quantities: Record<string, string>;
  images: File[];
};
type Line = {
  key: string;
  query: string;
  styleKey: string;
  productId: string;
  isNew: boolean;
  quantity: string;
  quantities: Record<number, string>;
  unitCost: string;
  salePrice: string;
  newItem: NewGarment;
};
type ReceiptItem = {
  id: number;
  product_id: number | null;
  name: string;
  size: string | null;
  quantity: number;
  unit_cost: number | string;
  line_total: number;
};
type Receipt = {
  id: number;
  receipt_number: string;
  invoice_number: string | null;
  received_at: string | null;
  payment_status: string;
  due_date: string | null;
  supplier: { id: number; name: string } | null;
  total: number;
  items: ReceiptItem[];
};
type ReceiptsPage = { data: Receipt[]; current_page: number; last_page: number };
type RestockItem = { product_id: number; quantity: number; unit_cost: number | null; price: number | null };

const SIZE_RUNS: Record<SizeScale, string[]> = {
  apparel: ["XS", "S", "M", "L", "XL", "XXL"],
  jeans: ["28", "30", "32", "34", "36", "38", "40", "42"],
  footwear: ["EU 39", "EU 40", "EU 41", "EU 42", "EU 43"],
  one: ["One"],
};
const SIZE_TYPES: Array<{ id: SizeScale; label: string; hint: string }> = [
  { id: "apparel", label: "Letter sizes", hint: "S, M, L, XL" },
  { id: "jeans", label: "Number sizes", hint: "28, 30, 32" },
  { id: "footwear", label: "Shoe sizes", hint: "EU 39–43" },
  { id: "one", label: "One size", hint: "No split" },
];
const SIZE_RANK = Object.values(SIZE_RUNS);

function blankNew(name = ""): NewGarment {
  return { name, sku: "", barcode: "", category: "", subcategory: "", color: "", sizeScale: "", quantities: {}, images: [] };
}

function blankLine(): Line {
  return {
    key: `${Date.now()}-${Math.random()}`,
    query: "",
    styleKey: "",
    productId: "",
    isNew: false,
    quantity: "",
    quantities: {},
    unitCost: "",
    salePrice: "",
    newItem: blankNew(),
  };
}

function sizeRank(size: string) {
  for (let index = 0; index < SIZE_RANK.length; index += 1) {
    const at = SIZE_RANK[index].indexOf(size);
    if (at >= 0) return index * 100 + at;
  }
  return 1000;
}

function groupStyles(products: Product[]): Style[] {
  const groups = new Map<string, Product[]>();
  for (const product of products) {
    const key = [product.name, product.color || "", product.category || ""].join("||");
    const list = groups.get(key) ?? [];
    list.push(product);
    groups.set(key, list);
  }
  return [...groups.entries()].map(([key, rows]) => {
    const first = rows[0];
    return {
      key,
      label: [first.name, first.color, first.category].filter(Boolean).join(" · "),
      products: [...rows].sort((a, b) => sizeRank(a.size || "") - sizeRank(b.size || "")),
    };
  });
}

function priceText(value: number | string | null | undefined) {
  if (value === null || value === undefined || value === "") return "";
  const amount = Number(value);
  return Number.isFinite(amount) ? String(amount) : "";
}

function moneyOrNull(value: string) {
  return value === "" ? null : Number(value);
}

export default function CatalogBulkRestockPage() {
  const profile = useBusinessProfile();
  const [mounted, setMounted] = useState(false);
  const [products, setProducts] = useState<Product[]>([]);
  const [categories, setCategories] = useState<CatalogCategory[]>([]);
  const [suppliers, setSuppliers] = useState<Supplier[]>([]);
  const [lines, setLines] = useState<Line[]>([blankLine()]);
  const [payment, setPayment] = useState("paid");
  const [invoiceNumber, setInvoiceNumber] = useState("");
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [saving, setSaving] = useState(false);
  const [receipts, setReceipts] = useState<Receipt[]>([]);
  const [receiptSearch, setReceiptSearch] = useState("");
  const [receiptPage, setReceiptPage] = useState(1);
  const [receiptLastPage, setReceiptLastPage] = useState(1);
  const [receiptsLoading, setReceiptsLoading] = useState(false);
  const [openReceiptId, setOpenReceiptId] = useState<number | null>(null);
  const [activeKey, setActiveKey] = useState<string | null>(null);
  const [dropdown, setDropdown] = useState<CSSProperties | null>(null);
  const receiptSeq = useRef(0);
  const clothing = mounted && profile.type === "clothing";
  const styles = useMemo(() => groupStyles(products), [products]);

  const loadProducts = useCallback(() => {
    api<{ data: Product[] }>("/products?per_page=500")
      .then((result) => setProducts(result.data))
      .catch(() => setProducts([]));
  }, []);

  const loadReceipts = useCallback((term: string, page: number) => {
    const seq = ++receiptSeq.current;
    const params = new URLSearchParams({ per_page: "8", page: String(page) });
    if (term.trim()) params.set("search", term.trim());
    setReceiptsLoading(true);
    api<ReceiptsPage>(`/products/stock-receipts?${params}`)
      .then((result) => {
        if (seq !== receiptSeq.current) return;
        setReceipts(result.data);
        setReceiptPage(result.current_page || page);
        setReceiptLastPage(Math.max(1, result.last_page || 1));
      })
      .catch(() => {
        if (seq === receiptSeq.current) setReceipts([]);
      })
      .finally(() => {
        if (seq === receiptSeq.current) setReceiptsLoading(false);
      });
  }, []);

  useEffect(() => {
    setMounted(true);
    loadProducts();
    api<{ data: Supplier[] }>("/suppliers?per_page=100").then((result) => setSuppliers(result.data)).catch(() => setSuppliers([]));
    api<{ data: CatalogCategory[] }>("/product-categories").then((result) => setCategories(result.data)).catch(() => setCategories([]));
  }, [loadProducts]);

  useEffect(() => {
    const handle = window.setTimeout(() => loadReceipts(receiptSearch, 1), receiptSearch.trim() ? 250 : 0);
    return () => window.clearTimeout(handle);
  }, [receiptSearch, loadReceipts]);

  function update(key: string, patch: Partial<Line>) {
    setLines((current) => current.map((line) => (line.key === key ? { ...line, ...patch } : line)));
  }

  function patchNew(key: string, patch: Partial<NewGarment>) {
    setLines((current) => current.map((line) => (
      line.key === key ? { ...line, newItem: { ...line.newItem, ...patch } } : line
    )));
  }

  function setSizeQty(key: string, productId: number, quantity: string) {
    setLines((current) => current.map((line) => (
      line.key === key ? { ...line, quantities: { ...line.quantities, [productId]: quantity } } : line
    )));
  }

  function setNewQty(key: string, size: string, quantity: string) {
    setLines((current) => current.map((line) => (
      line.key === key ? { ...line, newItem: { ...line.newItem, quantities: { ...line.newItem.quantities, [size]: quantity } } } : line
    )));
  }

  function placeDropdown(input: HTMLElement) {
    const rect = input.getBoundingClientRect();
    setDropdown({ left: rect.left, top: rect.bottom + 2, width: Math.max(rect.width, 280), maxHeight: 280 });
  }

  function chooseStyle(key: string, style: Style) {
    const current = style.products.find((product) => Number(product.price) > 0) ?? style.products[0];
    update(key, {
      styleKey: style.key,
      query: style.label,
      isNew: false,
      quantities: {},
      newItem: blankNew(),
      salePrice: priceText(current?.price),
      unitCost: priceText(current?.cost_price),
    });
    setActiveKey(null);
  }

  function startNew(key: string, name: string) {
    update(key, { styleKey: "", query: name, isNew: true, quantities: {}, newItem: blankNew(name), salePrice: "", unitCost: "" });
    setActiveKey(null);
    setError("");
  }

  function clearLine(key: string) {
    update(key, { styleKey: "", productId: "", query: "", isNew: false, quantities: {}, quantity: "", unitCost: "", salePrice: "", newItem: blankNew() });
    setActiveKey(key);
  }

  function matchesFor(query: string) {
    const needle = query.trim().toLowerCase();
    if (!needle) return [];
    return styles.filter((style) => {
      const haystack = [style.label, ...style.products.flatMap((product) => [product.barcode || "", product.sku || "", product.name])].join(" ").toLowerCase();
      return haystack.includes(needle);
    }).slice(0, 8);
  }

  function onSearchKey(key: string, event: KeyboardEvent<HTMLInputElement>) {
    if (event.key !== "Enter") return;
    event.preventDefault();
    const line = lines.find((row) => row.key === key);
    const needle = line?.query.trim() ?? "";
    if (!needle) return;
    const hits = matchesFor(needle);
    const exact = hits.find((style) => style.label.toLowerCase() === needle.toLowerCase() || style.products.some((product) => product.barcode?.toLowerCase() === needle.toLowerCase()));
    if (exact) chooseStyle(key, exact);
    else if (hits.length === 1) chooseStyle(key, hits[0]);
    else startNew(key, needle);
  }

  function linePieces(line: Line, style?: Style) {
    if (line.isNew && line.newItem.sizeScale) {
      return SIZE_RUNS[line.newItem.sizeScale].reduce((sum, size) => sum + (Number(line.newItem.quantities[size]) || 0), 0);
    }
    if (style) return style.products.reduce((sum, product) => sum + (Number(line.quantities[product.id]) || 0), 0);
    return Number(line.quantity) || 0;
  }

  const clothingPieces = lines.reduce((sum, line) => sum + linePieces(line, styles.find((row) => row.key === line.styleKey)), 0);
  const clothingCost = lines.reduce((sum, line) => {
    if (line.unitCost === "") return sum;
    return sum + linePieces(line, styles.find((row) => row.key === line.styleKey)) * Number(line.unitCost);
  }, 0);

  async function createGarment(line: Line): Promise<RestockItem[]> {
    const draft = line.newItem;
    if (!draft.name.trim()) throw new Error("A new garment needs a name.");
    if (!draft.sizeScale) throw new Error(`Choose a size type for ${draft.name.trim()}.`);
    if (line.salePrice === "") throw new Error(`Enter the selling price for ${draft.name.trim()}.`);
    const sizes = SIZE_RUNS[draft.sizeScale];
    const adding = sizes.filter((size) => Number(draft.quantities[size]) > 0);
    if (adding.length === 0) throw new Error(`Enter a quantity for at least one size of ${draft.name.trim()}.`);
    const data = new FormData();
    data.set("name", draft.name.trim());
    data.set("sku", draft.sku.trim());
    data.set("barcode", draft.barcode.trim());
    data.set("category", draft.category);
    data.set("subcategory", draft.subcategory);
    data.set("color", draft.color.trim());
    data.set("price", line.salePrice);
    data.set("cost_price", line.unitCost === "" ? "0" : line.unitCost);
    data.set("size_scale", draft.sizeScale);
    for (const size of sizes) data.set(`size_quantities[${size}]`, "0");
    for (const image of draft.images) data.append("images[]", image);
    const created = await api<{ products: Product[] }>("/products", { method: "POST", body: data });
    return created.products
      .map((product) => ({
        product_id: product.id,
        quantity: Number(draft.quantities[product.size || ""] || 0),
        unit_cost: moneyOrNull(line.unitCost),
        price: moneyOrNull(line.salePrice),
      }))
      .filter((row) => row.quantity > 0);
  }

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const active = lines.filter((line) => line.isNew || line.styleKey || (line.productId && Number(line.quantity) > 0));
    if (active.length === 0) {
      setError(clothing ? "Choose a garment, or add one that is not in the list." : "Add at least one item and a quantity.");
      return;
    }
    if (clothing && active.some((line) => !line.isNew && line.styleKey && line.salePrice === "" && linePieces(line, styles.find((row) => row.key === line.styleKey)) > 0)) {
      setError("Enter the selling price for each garment.");
      return;
    }
    setSaving(true);
    setError("");
    setNotice("");
    try {
      const items: RestockItem[] = [];
      for (const line of active) {
        if (line.isNew) {
          items.push(...await createGarment(line));
          continue;
        }
        if (clothing) {
          const style = styles.find((row) => row.key === line.styleKey);
          if (!style) continue;
          items.push(...style.products
            .map((product) => ({
              product_id: product.id,
              quantity: Number(line.quantities[product.id] || 0),
              unit_cost: moneyOrNull(line.unitCost),
              price: moneyOrNull(line.salePrice),
            }))
            .filter((row) => row.quantity > 0));
          continue;
        }
        items.push({
          product_id: Number(line.productId),
          quantity: Number(line.quantity),
          unit_cost: moneyOrNull(line.unitCost),
          price: moneyOrNull(line.salePrice),
        });
      }
      if (items.length === 0) {
        setError(clothing ? "Enter a quantity for at least one size." : "Add at least one item and a quantity.");
        setSaving(false);
        return;
      }
      const result = await api<{ updated: number; receipt?: { receipt_number?: string } }>("/products/restock/bulk", {
        method: "POST",
        body: JSON.stringify({
          items,
          invoice_number: invoiceNumber.trim() || null,
          payment_status: payment,
          due_date: payment === "credit" ? form.get("due_date") : null,
          supplier_id: form.get("supplier_id") || null,
          expense_date: form.get("expense_date") || null,
        }),
      });
      const grn = result.receipt?.receipt_number;
      const noun = clothing ? "size" : "item";
      setNotice(`Saved ${grn ?? "the restock"}. ${result.updated} ${noun}${result.updated === 1 ? "" : "s"} added to stock.`);
      setLines([blankLine()]);
      setInvoiceNumber("");
      setPayment("paid");
      loadProducts();
      loadReceipts(receiptSearch, 1);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Could not restock.");
    } finally {
      setSaving(false);
    }
  }

  const cell = "h-7 w-full border border-[#c9c5b9] bg-white px-1.5 text-[11px] outline-none focus:border-[#167c73]";
  const cellNum = `${cell} w-20 tabular-nums`;

  return (
    <AppShell
      title="Bulk restock"
      eyebrow={clothing ? "Search a garment, or add it if it is not in the list" : "Add stock to several catalog items"}
      action={(
        <Link href="/catalog" className="flex h-8 items-center gap-2 border border-[#20221f] bg-white px-2.5 text-[11px] font-semibold">
          <ArrowLeft size={16} /><span className="hidden sm:inline">Catalog</span>
        </Link>
      )}
    >
      <div className="space-y-4">
        {error && <ErrorMessage message={error} />}
        {notice && <SuccessMessage message={notice} />}
        <form onSubmit={submit} className="space-y-3">
          <Panel className="p-3">
            <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-5">
              <label className="text-[9px] font-bold uppercase text-[#6f746e]">Payment
                <select value={payment} onChange={(event) => setPayment(event.target.value)} className={`${cell} mt-0.5`}>
                  <option value="paid">Paid now</option>
                  <option value="credit">Buy on credit</option>
                </select>
              </label>
              <label className="text-[9px] font-bold uppercase text-[#6f746e]">Supplier
                <select name="supplier_id" className={`${cell} mt-0.5`}>
                  <option value="">No supplier</option>
                  {suppliers.map((supplier) => <option key={supplier.id} value={supplier.id}>{supplier.name}</option>)}
                </select>
              </label>
              <label className="text-[9px] font-bold uppercase text-[#6f746e]">Invoice no.
                <input value={invoiceNumber} onChange={(event) => setInvoiceNumber(event.target.value)} placeholder="Invoice" className={`${cell} mt-0.5`} />
              </label>
              <label className="text-[9px] font-bold uppercase text-[#6f746e]">Date
                <input name="expense_date" type="date" className={`${cell} mt-0.5`} />
              </label>
              {payment === "credit" && (
                <label className="text-[9px] font-bold uppercase text-[#6f746e]">Due date
                  <input name="due_date" type="date" required className={`${cell} mt-0.5`} />
                </label>
              )}
            </div>
          </Panel>

          <Panel className="p-2">
            <div className="overflow-x-auto border border-[#d7d3c8] bg-white">
              <table className="w-full min-w-[760px] border-collapse text-left text-[11px]">
                <thead className="bg-[#eeece5] text-[9px] font-bold uppercase tracking-wide text-[#6f746e]">
                  <tr>
                    <th className="w-7 border-b border-[#d7d3c8] px-1 py-1.5">#</th>
                    <th className="min-w-[220px] border-b border-[#d7d3c8] px-1 py-1.5">Item</th>
                    <th className="border-b border-[#d7d3c8] px-1 py-1.5">{clothing ? "Sizes" : "Qty"}</th>
                    <th className="w-24 border-b border-[#d7d3c8] px-1 py-1.5">Cost</th>
                    <th className="w-24 border-b border-[#d7d3c8] px-1 py-1.5">Sell</th>
                    <th className="w-20 border-b border-[#d7d3c8] px-1 py-1.5 text-right">Total</th>
                    <th className="w-7 border-b border-[#d7d3c8] px-1 py-1.5" />
                  </tr>
                </thead>
                <tbody>
                  {lines.map((line, index) => {
                    const style = styles.find((row) => row.key === line.styleKey);
                    const hits = matchesFor(line.query);
                    const pieces = linePieces(line, style);
                    const lineCost = line.unitCost === "" ? 0 : pieces * Number(line.unitCost);
                    const ready = Boolean(style || line.isNew || line.productId);
                    const newSizes = line.newItem.sizeScale ? SIZE_RUNS[line.newItem.sizeScale] : [];
                    return (
                      <Fragment key={line.key}>
                        <tr className={line.isNew ? "bg-[#f7f3e4]" : "odd:bg-[#fbfaf6]"}>
                          <td className="px-1 py-1 tabular-nums text-[#6f746e]">{index + 1}</td>
                          <td className="px-1 py-1">
                            {clothing && line.isNew ? (
                              <div className="flex items-center justify-between gap-2">
                                <div className="min-w-0">
                                  <p className="truncate font-semibold leading-tight">{line.newItem.name || "New garment"}</p>
                                  <p className="text-[9px] font-bold uppercase text-[#8a6a12]">New garment — fill the fields below</p>
                                </div>
                                <button type="button" className="shrink-0 text-[10px] text-[#167c73] underline" onClick={() => clearLine(line.key)}>Change</button>
                              </div>
                            ) : clothing && style ? (
                              <div className="flex items-center justify-between gap-2">
                                <div className="min-w-0">
                                  <p className="truncate font-semibold leading-tight">{style.products[0]?.name}</p>
                                  <p className="truncate text-[9px] text-[#6f746e]">{[style.products[0]?.color, style.products[0]?.category].filter(Boolean).join(" · ")}</p>
                                </div>
                                <button type="button" className="shrink-0 text-[10px] text-[#167c73] underline" onClick={() => clearLine(line.key)}>Change</button>
                              </div>
                            ) : clothing ? (
                              <div className="relative">
                                <ScanBarcode className="pointer-events-none absolute left-1.5 top-1/2 -translate-y-1/2 text-[#6f746e]" size={12} />
                                <input
                                  value={line.query}
                                  onChange={(event) => {
                                    update(line.key, { query: event.target.value, styleKey: "", isNew: false });
                                    setActiveKey(line.key);
                                    placeDropdown(event.currentTarget);
                                  }}
                                  onFocus={(event) => {
                                    setActiveKey(line.key);
                                    placeDropdown(event.currentTarget);
                                  }}
                                  onKeyDown={(event) => onSearchKey(line.key, event)}
                                  placeholder="Scan barcode or type a name"
                                  autoComplete="off"
                                  className={`${cell} pl-6`}
                                />
                                {activeKey === line.key && line.query.trim() !== "" && dropdown && createPortal(
                                  <ul
                                    style={dropdown}
                                    className="fixed z-[60] overflow-auto border border-[#d7d3c8] bg-white text-[11px] shadow-lg"
                                    onMouseDown={(event) => event.preventDefault()}
                                  >
                                    {hits.map((hit) => (
                                      <li key={hit.key}>
                                        <button type="button" className="flex w-full items-center justify-between gap-2 px-2 py-1.5 text-left hover:bg-[#eeece5]" onClick={() => chooseStyle(line.key, hit)}>
                                          <span className="min-w-0 truncate font-semibold">{hit.label}</span>
                                          <span className="shrink-0 text-[9px] text-[#6f746e]">{hit.products.reduce((sum, product) => sum + Number(product.stock_qty), 0)} on hand</span>
                                        </button>
                                      </li>
                                    ))}
                                    <li className="border-t border-[#e8e4da]">
                                      <button type="button" className="w-full px-2 py-1.5 text-left font-semibold text-[#167c73] hover:bg-[#eeece5]" onClick={() => startNew(line.key, line.query.trim())}>
                                        Add “{line.query.trim()}” as a new garment
                                      </button>
                                    </li>
                                  </ul>,
                                  document.body,
                                )}
                              </div>
                            ) : (
                              <select value={line.productId} onChange={(event) => update(line.key, { productId: event.target.value })} className={cell}>
                                <option value="">Item</option>
                                {products.map((product) => (
                                  <option key={product.id} value={product.id}>{product.name}{product.size ? ` · ${product.size}` : ""} · {product.stock_qty}</option>
                                ))}
                              </select>
                            )}
                          </td>
                          <td className="px-1 py-1">
                            {clothing && style && (
                              <div className="flex flex-wrap gap-1">
                                {style.products.map((product) => (
                                  <label key={product.id} className="w-12 text-center text-[9px] font-bold uppercase text-[#6f746e]">
                                    {product.size || "One"}
                                    <span className="block font-medium normal-case">{product.stock_qty}</span>
                                    <input
                                      type="number"
                                      min="0"
                                      value={line.quantities[product.id] ?? ""}
                                      onChange={(event) => setSizeQty(line.key, product.id, event.target.value)}
                                      aria-label={`Add ${product.size || "One"}`}
                                      className={`${cell} px-1 text-center`}
                                    />
                                  </label>
                                ))}
                              </div>
                            )}
                            {clothing && line.isNew && newSizes.length > 0 && (
                              <div className="flex flex-wrap gap-1">
                                {newSizes.map((size) => (
                                  <label key={size} className="w-12 text-center text-[9px] font-bold uppercase text-[#6f746e]">
                                    {size}
                                    <input
                                      type="number"
                                      min="0"
                                      value={line.newItem.quantities[size] ?? ""}
                                      onChange={(event) => setNewQty(line.key, size, event.target.value)}
                                      aria-label={`Add ${size}`}
                                      className={`${cell} px-1 text-center`}
                                    />
                                  </label>
                                ))}
                              </div>
                            )}
                            {!clothing && (
                              <input value={line.quantity} onChange={(event) => update(line.key, { quantity: event.target.value })} type="number" min="1" placeholder="Qty" className={`${cell} w-16`} />
                            )}
                          </td>
                          <td className="px-1 py-1">
                            <input value={line.unitCost} onChange={(event) => update(line.key, { unitCost: event.target.value })} type="number" min="0" step="0.01" disabled={!ready} placeholder="Cost" className={cellNum} />
                          </td>
                          <td className="px-1 py-1">
                            <input value={line.salePrice} onChange={(event) => update(line.key, { salePrice: event.target.value })} type="number" min="0" step="0.01" disabled={!ready} placeholder="Sell" className={cellNum} />
                          </td>
                          <td className="px-1 py-1 text-right font-semibold tabular-nums">{ready && pieces > 0 && line.unitCost !== "" ? money(lineCost) : "—"}</td>
                          <td className="px-1 py-1">
                            <button type="button" onClick={() => setLines((current) => current.filter((row) => row.key !== line.key))} className="grid size-6 place-items-center text-[#b84837]" aria-label="Remove row">
                              <Trash2 size={12} />
                            </button>
                          </td>
                        </tr>
                        {clothing && line.isNew && (
                          <tr className="bg-[#f7f3e4]">
                            <td />
                            <td colSpan={6} className="px-1 py-2">
                              <div className="grid gap-2 sm:grid-cols-3 lg:grid-cols-4">
                                <label className="text-[9px] font-bold uppercase text-[#6f746e]">Name *
                                  <input value={line.newItem.name} onChange={(event) => patchNew(line.key, { name: event.target.value })} required className={`${cell} mt-0.5`} />
                                </label>
                                <label className="text-[9px] font-bold uppercase text-[#6f746e]">SKU
                                  <input value={line.newItem.sku} onChange={(event) => patchNew(line.key, { sku: event.target.value })} className={`${cell} mt-0.5`} />
                                </label>
                                <label className="text-[9px] font-bold uppercase text-[#6f746e]">Barcode
                                  <input value={line.newItem.barcode} onChange={(event) => patchNew(line.key, { barcode: event.target.value })} className={`${cell} mt-0.5`} />
                                </label>
                                <label className="text-[9px] font-bold uppercase text-[#6f746e]">Color
                                  <input value={line.newItem.color} onChange={(event) => patchNew(line.key, { color: event.target.value })} className={`${cell} mt-0.5`} />
                                </label>
                                <label className="text-[9px] font-bold uppercase text-[#6f746e]">Category
                                  <select value={line.newItem.category} onChange={(event) => patchNew(line.key, { category: event.target.value, subcategory: "" })} className={`${cell} mt-0.5`}>
                                    <option value="">Select category</option>
                                    {categories.map((category) => <option key={category.name} value={category.name}>{category.name}</option>)}
                                  </select>
                                </label>
                                <label className="text-[9px] font-bold uppercase text-[#6f746e]">Sub category
                                  <select value={line.newItem.subcategory} onChange={(event) => patchNew(line.key, { subcategory: event.target.value })} className={`${cell} mt-0.5`}>
                                    <option value="">None</option>
                                    {(categories.find((category) => category.name === line.newItem.category)?.subcategories ?? []).map((sub) => (
                                      <option key={sub.name} value={sub.name}>{sub.name}</option>
                                    ))}
                                  </select>
                                </label>
                                <label className="text-[9px] font-bold uppercase text-[#6f746e] sm:col-span-2">Images
                                  <input
                                    type="file"
                                    accept="image/*"
                                    multiple
                                    onChange={(event) => patchNew(line.key, { images: [...(event.target.files ?? [])] })}
                                    className="mt-0.5 block w-full text-[10px]"
                                  />
                                </label>
                                <div className="sm:col-span-3 lg:col-span-4">
                                  <p className="text-[9px] font-bold uppercase text-[#6f746e]">Size type</p>
                                  <div className="mt-1 flex flex-wrap gap-1">
                                    {SIZE_TYPES.map((type) => (
                                      <button
                                        key={type.id}
                                        type="button"
                                        onClick={() => patchNew(line.key, { sizeScale: type.id, quantities: {} })}
                                        className={`border px-2 py-1 text-left ${line.newItem.sizeScale === type.id ? "border-[#167c73] bg-[#167c73] text-white" : "border-[#c9c5b9] bg-white"}`}
                                      >
                                        <span className="block text-[10px] font-bold uppercase">{type.label}</span>
                                        <span className={`block text-[9px] ${line.newItem.sizeScale === type.id ? "text-white/80" : "text-[#6f746e]"}`}>{type.hint}</span>
                                      </button>
                                    ))}
                                  </div>
                                </div>
                              </div>
                            </td>
                          </tr>
                        )}
                      </Fragment>
                    );
                  })}
                </tbody>
              </table>
            </div>
            <div className="mt-2 flex flex-wrap items-center justify-between gap-3">
              <button type="button" onClick={() => setLines((current) => [...current, blankLine()])} className="flex items-center gap-1 text-xs font-semibold text-[#167c73]">
                <Plus size={14} /> {clothing ? "Add garment" : "Add line"}
              </button>
              <div className="flex items-center gap-4">
                {clothing && (
                  <div className="text-right">
                    <p className="text-[9px] font-bold uppercase text-[#6f746e]">{clothingPieces} piece{clothingPieces === 1 ? "" : "s"}</p>
                    <p className="font-display text-xl font-semibold tabular-nums leading-tight">{money(clothingCost)}</p>
                  </div>
                )}
                <button disabled={saving} className={buttonClass}>{saving ? "Saving..." : "Save GRN"}</button>
              </div>
            </div>
          </Panel>
        </form>

        <Panel className="p-4">
          <div className="flex flex-wrap items-end justify-between gap-3">
            <div>
              <h2 className="font-display text-lg font-semibold uppercase">Previous GRNs</h2>
              <p className="mt-0.5 text-[11px] text-[#6f746e]">Every restock you save stays here, newest first.</p>
            </div>
            <label className="relative w-full max-w-xs">
              <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 text-[#6f746e]" size={14} />
              <input
                value={receiptSearch}
                onChange={(event) => setReceiptSearch(event.target.value)}
                className={`${inputClass} pl-8`}
                placeholder="Invoice, GRN, garment or supplier"
              />
            </label>
          </div>
          <div className="mt-3 divide-y divide-[#e8e4da] border border-[#d7d3c8] bg-white">
            {receipts.map((receipt) => {
              const open = openReceiptId === receipt.id;
              const pieces = receipt.items.reduce((sum, item) => sum + Number(item.quantity), 0);
              return (
                <div key={receipt.id}>
                  <button
                    type="button"
                    onClick={() => setOpenReceiptId(open ? null : receipt.id)}
                    className="flex w-full items-center gap-2 px-3 py-2.5 text-left text-[11px] hover:bg-[#fbfaf6]"
                  >
                    {open ? <ChevronDown size={14} className="shrink-0" /> : <ChevronRight size={14} className="shrink-0" />}
                    <span className="min-w-0 flex-1">
                      <span className="block truncate font-semibold">{receipt.receipt_number}</span>
                      <span className="block truncate text-[10px] text-[#6f746e]">
                        {[receipt.invoice_number && `Invoice ${receipt.invoice_number}`, receipt.supplier?.name, formatDate(receipt.received_at), `${pieces} piece${pieces === 1 ? "" : "s"}`]
                          .filter(Boolean)
                          .join(" · ")}
                      </span>
                    </span>
                    <span className={`shrink-0 px-1.5 py-0.5 text-[9px] font-bold uppercase ${receipt.payment_status === "credit" ? "bg-[#2b6cb0]/15 text-[#2b6cb0]" : "bg-[#167c73]/10 text-[#167c73]"}`}>
                      {receipt.payment_status === "credit" ? "Credit" : "Paid"}
                    </span>
                    <span className="w-24 shrink-0 text-right font-semibold tabular-nums">{money(receipt.total)}</span>
                  </button>
                  {open && (
                    <table className="w-full border-t border-[#e8e4da] bg-[#fbfaf6] text-[11px]">
                      <tbody>
                        {receipt.items.map((item) => (
                          <tr key={item.id} className="border-b border-[#efece4] last:border-b-0">
                            <td className="py-1.5 pl-8 pr-2">
                              {item.name}
                              {item.size && <span className="ml-1 text-[10px] text-[#6f746e]">{item.size}</span>}
                            </td>
                            <td className="px-2 py-1.5 text-right tabular-nums">{item.quantity}</td>
                            <td className="px-2 py-1.5 text-right tabular-nums">× {money(item.unit_cost)}</td>
                            <td className="w-24 px-2 py-1.5 text-right font-semibold tabular-nums">{money(item.line_total)}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  )}
                </div>
              );
            })}
            {!receiptsLoading && receipts.length === 0 && (
              <p className="px-3 py-6 text-center text-[11px] text-[#6f746e]">
                {receiptSearch.trim() ? "No GRNs match that search." : "Saved restocks will be listed here."}
              </p>
            )}
            {receiptsLoading && (
              <p className="flex items-center justify-center gap-2 px-2 py-3 text-[11px] text-[#6f746e]">
                <Loader2 className="animate-spin" size={14} /> Loading…
              </p>
            )}
          </div>
          <ListPager page={receiptPage} lastPage={receiptLastPage} disabled={receiptsLoading} onPage={(next) => loadReceipts(receiptSearch, next)} />
        </Panel>
      </div>
    </AppShell>
  );
}
