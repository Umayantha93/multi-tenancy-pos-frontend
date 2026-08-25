"use client";

import { FormEvent, useCallback, useEffect, useRef, useState } from "react";
import { Boxes, Download, PackagePlus, Pencil, Plus, Search, Upload, X } from "lucide-react";
import { AppShell } from "@/components/app-shell";
import { buttonClass, ErrorMessage, inputClass, PageState, Panel, SuccessMessage } from "@/components/ui";
import { API_URL, api, currentFeatures, currentUser, mediaUrl, money } from "@/lib/api";

type Part = {
  id: number;
  name: string;
  sku?: string;
  barcode?: string | null;
  brand: string;
  type: string;
  model?: string;
  year?: number;
  price: string;
  cost_price: string;
  stock_qty: number;
  description?: string;
  images?: string[];
  image_urls?: string[];
};

type Mode = "add" | "edit" | "restock" | null;
type Supplier = { id: number; name: string };

type ImportResult = {
  message: string;
  created: number;
  updated: number;
  expenses_created: number;
  expense_total: number;
  rows: number;
};

export default function PartsPage() {
  const [parts, setParts] = useState<Part[]>([]);
  const [search, setSearch] = useState("");
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [mode, setMode] = useState<Mode>(null);
  const [selected, setSelected] = useState<Part | null>(null);
  const [admin, setAdmin] = useState(false);
  const [suppliers, setSuppliers] = useState<Supplier[]>([]);
  const [importing, setImporting] = useState(false);
  const [downloadingTemplate, setDownloadingTemplate] = useState(false);
  const [importOpen, setImportOpen] = useState(false);
  const [importPayment, setImportPayment] = useState("paid");
  const [importDue, setImportDue] = useState("");
  const importInputRef = useRef<HTMLInputElement>(null);

  const load = useCallback((term = search) => {
    api<{ data: Part[] }>(`/parts?search=${encodeURIComponent(term)}&per_page=100`)
      .then((result) => setParts(result.data))
      .catch((caught) => setError(caught.message));
  }, [search]);

  useEffect(() => {
    const frame = requestAnimationFrame(() => {
      setAdmin(currentUser()?.role === "business_owner");
      load("");
      if (currentFeatures().includes("suppliers")) {
        api<{ data: Supplier[] }>("/suppliers?per_page=100")
          .then((result) => setSuppliers(result.data))
          .catch(() => setSuppliers([]));
      }
    });
    return () => cancelAnimationFrame(frame);
  }, [load]);

  useEffect(() => {
    if (!mode) return;
    function onKey(event: KeyboardEvent) {
      if (event.key === "Escape") setMode(null);
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [mode]);

  function openAdd() {
    setSelected(null);
    setMode("add");
    setError("");
    setNotice("");
  }

  function openEdit(part: Part) {
    if (!admin) return;
    setSelected(part);
    setMode("edit");
    setError("");
    setNotice("");
  }

  function openRestock(part: Part) {
    setSelected(part);
    setMode("restock");
    setError("");
    setNotice("");
  }

  async function downloadTemplate() {
    setDownloadingTemplate(true);
    setError("");
    setNotice("");
    try {
      const token = localStorage.getItem("garage_token");
      const response = await fetch(`${API_URL}/parts/import/template`, {
        headers: token ? { Authorization: `Bearer ${token}` } : undefined,
      });
      if (response.status === 401) {
        window.location.href = "/login";
        return;
      }
      if (!response.ok) {
        const body = await response.json().catch(() => ({ message: "Could not download template." }));
        throw new Error(body.message || "Could not download template.");
      }
      const blob = await response.blob();
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = "parts-import-template.xlsx";
      document.body.appendChild(link);
      link.click();
      link.remove();
      URL.revokeObjectURL(url);
      setNotice("Template downloaded. Fill the Parts sheet, delete both SAMPLE rows (paid + credit), then import.");
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Could not download template.");
    } finally {
      setDownloadingTemplate(false);
    }
  }

  async function importExcel(file: File) {
    setImporting(true);
    setError("");
    setNotice("");
    const formData = new FormData();
    formData.append("file", file);
    formData.append("payment_status", importPayment);
    if (importPayment === "credit" && importDue) {
      formData.append("due_date", importDue);
    }
    try {
      const result = await api<ImportResult>("/parts/import", { method: "POST", body: formData });
      setNotice(
        `${result.message} ${result.created} created, ${result.updated} updated, ${result.expenses_created} expenses (${money(result.expense_total)}). Default: ${importPayment === "credit" ? "credit (supplier owe)" : "paid (debit)"}.`,
      );
      setImportOpen(false);
      load("");
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Could not import spreadsheet.");
    } finally {
      setImporting(false);
      if (importInputRef.current) importInputRef.current.value = "";
    }
  }

  async function savePart(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = event.currentTarget;
    const formData = new FormData(form);
    const fileInput = form.querySelector<HTMLInputElement>('input[type="file"][name="images"]');
    formData.delete("images");
    if (fileInput?.files?.length) {
      Array.from(fileInput.files).slice(0, 5).forEach((file) => formData.append("images[]", file));
    }
    try {
      if (mode === "edit" && selected) {
        await api(`/parts/${selected.id}`, { method: "POST", body: formData });
      } else {
        await api("/parts", { method: "POST", body: formData });
      }
      form.reset();
      setMode(null);
      setSelected(null);
      load("");
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Could not save part.");
    }
  }

  async function restock(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!selected) return;
    const form = event.currentTarget;
    try {
      const payload = Object.fromEntries(new FormData(form));
      if (!payload.due_date || payload.payment_status !== "credit") {
        delete payload.due_date;
      }
      if (!payload.supplier_id) {
        delete payload.supplier_id;
      }
      await api(`/parts/${selected.id}/restock`, {
        method: "POST",
        body: JSON.stringify(payload),
      });
      form.reset();
      setMode(null);
      setSelected(null);
      load("");
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Could not restock part.");
    }
  }

  return (
    <AppShell
      title="Parts inventory"
      eyebrow={`${parts.length} catalog items`}
      action={admin ? (
        <div className="flex flex-wrap items-center justify-end gap-2">
          <button
            type="button"
            onClick={downloadTemplate}
            disabled={downloadingTemplate}
            className="flex h-10 items-center gap-2 border border-[#20221f] bg-white px-3 text-sm font-semibold"
          >
            <Download size={16} /><span className="hidden sm:inline">{downloadingTemplate ? "Downloading..." : "Download template"}</span>
          </button>
          <button
            type="button"
            onClick={() => setImportOpen(true)}
            disabled={importing}
            className="flex h-10 items-center gap-2 border border-[#167c73] bg-white px-3 text-sm font-semibold text-[#167c73]"
          >
            <Upload size={16} /><span className="hidden sm:inline">{importing ? "Importing..." : "Import Excel"}</span>
          </button>
          <input
            ref={importInputRef}
            type="file"
            accept=".xlsx,.xls,.csv,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet,application/vnd.ms-excel,text/csv"
            className="hidden"
            onChange={(event) => {
              const file = event.target.files?.[0];
              if (file) void importExcel(file);
            }}
          />
          <button onClick={openAdd} className="flex h-10 items-center gap-2 bg-[#f5c842] px-3 text-sm font-semibold">
            <Plus size={18} /><span className="hidden sm:inline">Add part</span>
          </button>
        </div>
      ) : undefined}
    >
      <div className="mb-5 flex max-w-3xl gap-2">
        <label className="relative flex-1">
          <Search className="absolute left-3 top-3 text-[#6f746e]" size={18} />
          <input
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            onKeyDown={(event) => event.key === "Enter" && load()}
            className={`${inputClass} pl-10`}
            placeholder="Name, SKU, barcode, brand or model"
          />
        </label>
        <button onClick={() => load()} className={buttonClass}>Search</button>
      </div>

      {error && <div className="mb-5"><ErrorMessage message={error} /></div>}
      {notice && <div className="mb-5"><SuccessMessage message={notice} /></div>}

      {parts.length === 0 && !error ? (
        <PageState message="No parts in the catalog yet." />
      ) : (
        <div className="grid items-stretch gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
          {parts.map((part) => {
            const image = mediaUrl(part.image_urls?.[0] || part.images?.[0]);
            return (
              <Panel key={part.id} className="flex h-full flex-col overflow-hidden">
                <button type="button" onClick={() => (admin ? openEdit(part) : openRestock(part))} className="block w-full flex-1 text-left">
                  <div className="relative aspect-[16/10] w-full overflow-hidden bg-[#e8e5dc]">
                    {image ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={image} alt="" className="absolute inset-0 size-full object-contain" />
                    ) : (
                      <div className="absolute inset-0 grid place-items-center">
                        <Boxes size={28} className="text-[#a7aaa4]" />
                      </div>
                    )}
                  </div>
                  <div className="p-3">
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0">
                        <p className="text-[10px] font-bold uppercase text-[#167c73]">{part.brand} · {part.type}</p>
                        <h2 className="mt-1 truncate font-display text-lg font-semibold uppercase leading-none">{part.name}</h2>
                      </div>
                      <span className={`shrink-0 px-1.5 py-0.5 text-[10px] font-bold ${part.stock_qty <= 5 ? "bg-[#b84837]/10 text-[#b84837]" : "bg-[#167c73]/10 text-[#167c73]"}`}>
                        {part.stock_qty} in stock
                      </span>
                    </div>
                    <p className="mt-2 truncate text-xs text-[#6f746e]">{part.model || "Universal"} {part.year || ""}</p>
                    {(part.barcode || part.sku) && (
                      <p className="mt-1 truncate text-xs text-[#6f746e]">
                        {part.barcode ? `Barcode: ${part.barcode}` : null}
                        {part.barcode && part.sku ? " · " : null}
                        {part.sku ? `SKU: ${part.sku}` : null}
                      </p>
                    )}
                    <p className="mt-2 font-display text-lg font-semibold">{money(part.price)}</p>
                  </div>
                </button>
                <div className="mt-auto flex border-t border-[#d7d3c8]">
                    {admin && (
                      <button type="button" onClick={() => openEdit(part)} className="flex flex-1 items-center justify-center gap-1.5 py-2 text-[10px] font-bold uppercase hover:bg-[#eeece5]">
                        <Pencil size={12} /> Edit
                      </button>
                    )}
                    <button type="button" onClick={() => openRestock(part)} className={`flex flex-1 items-center justify-center gap-1.5 py-2 text-[10px] font-bold uppercase text-[#167c73] hover:bg-[#eeece5] ${admin ? "border-l border-[#d7d3c8]" : ""}`}>
                      <PackagePlus size={12} /> Restock
                    </button>
                  </div>
              </Panel>
            );
          })}
        </div>
      )}

      {(mode === "add" || mode === "edit") && (
        <div
          className="fixed inset-0 z-50 grid place-items-center overflow-y-auto bg-black/55 p-4"
          onClick={() => setMode(null)}
        >
          <form
            onSubmit={savePart}
            onClick={(event) => event.stopPropagation()}
            className="my-8 w-full max-w-2xl bg-[#f3f0e8]"
          >
            <div className="flex items-center justify-between border-b border-[#d7d3c8] p-5">
              <h2 className="font-display text-3xl font-semibold uppercase">{mode === "edit" ? "Edit part" : "Add inventory part"}</h2>
              <button type="button" onClick={() => setMode(null)} aria-label="Close"><X /></button>
            </div>
            <div className="grid gap-4 p-5 sm:grid-cols-2">
              {[
                ["name", "Part name", selected?.name ?? ""],
                ["sku", "SKU", selected?.sku ?? ""],
                ["barcode", "Barcode", selected?.barcode ?? ""],
                ["brand", "Brand", selected?.brand ?? ""],
                ["type", "Category", selected?.type ?? ""],
                ["model", "Compatible model", selected?.model ?? ""],
                ["year", "Compatible year", selected?.year ? String(selected.year) : ""],
                ["price", "Selling price", selected?.price ?? ""],
                ["cost_price", "Cost price", selected?.cost_price ?? ""],
              ].map(([name, label, value]) => (
                <label key={name} className="text-xs font-bold uppercase">
                  {label}
                  <input
                    name={name}
                    defaultValue={value}
                    type={["year", "price", "cost_price"].includes(name) ? "number" : "text"}
                    step={name.includes("price") ? "0.01" : undefined}
                    required={!["sku", "barcode", "model", "year"].includes(name)}
                    className={`${inputClass} mt-2`}
                  />
                </label>
              ))}
              {mode === "add" && (
                <label className="text-xs font-bold uppercase">
                  Opening stock
                  <input name="stock_qty" type="number" min="0" defaultValue="0" required className={`${inputClass} mt-2`} />
                </label>
              )}
              {mode === "edit" && selected && (
                <div className="text-xs font-bold uppercase">
                  Current stock
                  <p className="mt-2 border border-[#c9c5b9] bg-white px-3 py-3 text-sm font-semibold normal-case">{selected.stock_qty} units — use Restock to add stock and record expense</p>
                </div>
              )}
              <label className="text-xs font-bold uppercase sm:col-span-2">
                Description
                <textarea name="description" defaultValue={selected?.description ?? ""} rows={3} className={`${inputClass} mt-2`} />
              </label>
              <label className="text-xs font-bold uppercase sm:col-span-2">
                Images
                <input name="images" type="file" accept="image/*" multiple className="mt-2 block w-full border border-[#c9c5b9] bg-white p-3 text-sm" />
              </label>
              {mode === "edit" && (selected?.image_urls?.length || selected?.images?.length) ? (
                <div className="flex flex-wrap gap-2 sm:col-span-2">
                  {(selected.image_urls || selected.images || []).map((image) => {
                    const src = mediaUrl(image);
                    return src ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img key={image} src={src} alt="" className="h-16 w-16 object-cover" />
                    ) : null;
                  })}
                </div>
              ) : null}
            </div>
            <div className="flex justify-end border-t border-[#d7d3c8] p-5">
              <button className={buttonClass}>{mode === "edit" ? "Save changes" : "Save part"}</button>
            </div>
          </form>
        </div>
      )}

      {mode === "restock" && selected && (
        <div
          className="fixed inset-0 z-50 grid place-items-center overflow-y-auto bg-black/55 p-4"
          onClick={() => setMode(null)}
        >
          <form
            onSubmit={restock}
            onClick={(event) => event.stopPropagation()}
            className="my-8 w-full max-w-md bg-[#f3f0e8]"
          >
            <div className="flex items-center justify-between border-b border-[#d7d3c8] p-5">
              <h2 className="font-display text-3xl font-semibold uppercase">Restock</h2>
              <button type="button" onClick={() => setMode(null)} aria-label="Close"><X /></button>
            </div>
            <div className="space-y-4 p-5">
              <p className="text-sm text-[#6f746e]">
                Adding stock for <strong>{selected.name}</strong> (now {selected.stock_qty} @ cost {selected.cost_price || "0"}).
                New unit cost is blended as a weighted average with existing stock. The purchase expense still uses this restock’s unit cost × qty. Paid hits finance now; credit stays as a payable until settled.
              </p>
              <label className="block text-xs font-bold uppercase">
                Quantity to add
                <input name="quantity" type="number" min="1" step="1" required className={`${inputClass} mt-2`} />
              </label>
              <label className="block text-xs font-bold uppercase">
                Unit cost
                <input name="unit_cost" type="number" min="0" step="0.01" defaultValue={selected.cost_price || ""} className={`${inputClass} mt-2`} />
              </label>
              {suppliers.length > 0 && (
                <label className="block text-xs font-bold uppercase">
                  Supplier (optional)
                  <select name="supplier_id" className={`${inputClass} mt-2`} defaultValue="">
                    <option value="">No supplier — same as today</option>
                    {suppliers.map((supplier) => (
                      <option key={supplier.id} value={supplier.id}>{supplier.name}</option>
                    ))}
                  </select>
                </label>
              )}
              <label className="block text-xs font-bold uppercase">
                Supplier payment
                <select name="payment_status" className={`${inputClass} mt-2`} defaultValue="paid">
                  <option value="paid">Paid now</option>
                  <option value="credit">Buy on credit</option>
                </select>
              </label>
              <label className="block text-xs font-bold uppercase">
                Supplier due date (credit only)
                <input name="due_date" type="date" className={`${inputClass} mt-2`} />
              </label>
              <label className="block text-xs font-bold uppercase">
                Expense date
                <input name="expense_date" type="date" defaultValue={new Date().toISOString().slice(0, 10)} className={`${inputClass} mt-2`} />
              </label>
            </div>
            <div className="flex justify-end border-t border-[#d7d3c8] p-5">
              <button className={buttonClass}>Add to stock</button>
            </div>
          </form>
        </div>
      )}
      {importOpen && (
        <div className="fixed inset-0 z-50 grid place-items-center bg-black/55 p-4" onClick={() => setImportOpen(false)}>
          <div className="w-full max-w-md bg-[#f3f0e8] p-5" onClick={(event) => event.stopPropagation()}>
            <h2 className="font-display text-2xl font-semibold uppercase">Import parts</h2>
            <p className="mt-2 text-sm text-[#6f746e]">
              Choose paid (debit) or credit for rows that do not set payment_status in the sheet. A credit row also needs a due date.
            </p>
            <label className="mt-4 block text-xs font-bold uppercase">
              Default payment
              <select value={importPayment} onChange={(event) => setImportPayment(event.target.value)} className={`${inputClass} mt-2`}>
                <option value="paid">Paid now (debit)</option>
                <option value="credit">On credit (supplier owe)</option>
              </select>
            </label>
            {importPayment === "credit" && (
              <label className="mt-3 block text-xs font-bold uppercase">
                Default supplier due date
                <input value={importDue} onChange={(event) => setImportDue(event.target.value)} type="date" required className={`${inputClass} mt-2`} />
              </label>
            )}
            <button
              type="button"
              disabled={importing || (importPayment === "credit" && !importDue)}
              onClick={() => importInputRef.current?.click()}
              className={`${buttonClass} mt-5 w-full`}
            >
              {importing ? "Importing..." : "Choose spreadsheet"}
            </button>
          </div>
        </div>
      )}
    </AppShell>
  );
}
