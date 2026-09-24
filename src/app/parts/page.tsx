"use client";

import { FormEvent, useCallback, useEffect, useRef, useState } from "react";
import { Boxes, Download, Loader2, PackagePlus, Pencil, Plus, Search, TableProperties, Trash2, Upload, X } from "lucide-react";
import Link from "next/link";
import { AppShell } from "@/components/app-shell";
import { buttonClass, ConfirmModal, ErrorMessage, inputClass, PageState, Panel, SuccessMessage } from "@/components/ui";
import { API_URL, api, currentFeatures, currentUser, mediaUrl, money } from "@/lib/api";
import { useBusinessProfile } from "@/lib/use-business-profile";
import { usesStoreCounter } from "@/lib/business-profiles";
import { StickerPrintButton } from "@/components/sticker-print";
import { formatStockQty, formatStockNumber, normalizeStockUnit, stockAllowsDecimal, stockUnitLabel, type StockUnit } from "@/lib/stock-unit";

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
  stock_unit?: string | null;
  description?: string;
  images?: string[];
  image_urls?: string[];
  serialized?: boolean;
};

type Mode = "add" | "edit" | "restock" | null;
type Supplier = { id: number; name: string; is_system?: boolean };

type PartsPage = {
  data: Part[];
  current_page: number;
  last_page: number;
  total: number;
};

const PAGE_SIZE = 24;

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
  const [page, setPage] = useState(1);
  const [lastPage, setLastPage] = useState(1);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [mode, setMode] = useState<Mode>(null);
  const [selected, setSelected] = useState<Part | null>(null);
  const [admin, setAdmin] = useState(false);
  const [suppliers, setSuppliers] = useState<Supplier[]>([]);
  const [importing, setImporting] = useState(false);
  const [downloadingTemplate, setDownloadingTemplate] = useState(false);
  const [saving, setSaving] = useState(false);
  const [pendingDelete, setPendingDelete] = useState<Part | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [importOpen, setImportOpen] = useState(false);
  const [restockFree, setRestockFree] = useState(false);
  const [importPayment, setImportPayment] = useState("paid");
  const [importDue, setImportDue] = useState("");
  const [importSupplierId, setImportSupplierId] = useState("");
  const [canSerial, setCanSerial] = useState(false);
  const [stockUnit, setStockUnit] = useState<StockUnit>("qty");
  const importInputRef = useRef<HTMLInputElement>(null);
  const loadSeq = useRef(0);
  const profile = useBusinessProfile();
  const isPaint = profile.type === "paint";
  const isStore = usesStoreCounter(profile.type);
  const isGarage = profile.type === "garage";
  const lowStockAt = isPaint ? 250 : 5;
  const itemNoun = isPaint ? "colour" : isStore ? "item" : "part";

  const load = useCallback((term: string, pageNum: number) => {
    const params = new URLSearchParams({
      per_page: String(PAGE_SIZE),
      page: String(Math.max(1, pageNum)),
    });
    const q = term.trim();
    if (q) params.set("search", q);
    const seq = ++loadSeq.current;
    setLoading(true);
    api<PartsPage>(`/parts?${params}`)
      .then((result) => {
        if (seq !== loadSeq.current) return;
        setParts(result.data);
        setPage(result.current_page || 1);
        setLastPage(Math.max(1, result.last_page || 1));
        setTotal(result.total ?? result.data.length);
      })
      .catch((caught) => {
        if (seq !== loadSeq.current) return;
        setError(caught.message);
      })
      .finally(() => {
        if (seq === loadSeq.current) setLoading(false);
      });
  }, []);

  useEffect(() => {
    const frame = requestAnimationFrame(() => {
      setAdmin(currentUser()?.role === "business_owner");
      setCanSerial(currentFeatures().includes("serial_inventory"));
      if (currentFeatures().includes("suppliers")) {
        api<{ data: Supplier[] }>("/suppliers?per_page=100")
          .then((result) => setSuppliers(result.data))
          .catch(() => setSuppliers([]));
      }
    });
    return () => cancelAnimationFrame(frame);
  }, []);

  useEffect(() => {
    const handle = window.setTimeout(() => load(search, 1), search.trim() ? 250 : 0);
    return () => window.clearTimeout(handle);
  }, [search, load]);

  useEffect(() => {
    if (!importOpen || suppliers.length === 0) return;
    setImportSupplierId((current) => {
      if (current && suppliers.some((row) => String(row.id) === current)) return current;
      if (isGarage) {
        const walkIn = suppliers.find((row) => row.is_system);
        return String(walkIn?.id ?? suppliers[0]?.id ?? "");
      }
      return "";
    });
  }, [importOpen, suppliers, isGarage]);

  useEffect(() => {
    if (!mode) return;
    function onKey(event: KeyboardEvent) {
      if (event.key === "Escape" && !saving) setMode(null);
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [mode, saving]);

  function openAdd() {
    setSelected(null);
    setStockUnit(isPaint ? "ml" : "qty");
    setMode("add");
    setError("");
    setNotice("");
  }

  function openEdit(part: Part) {
    if (!admin) return;
    setSelected(part);
    setStockUnit(normalizeStockUnit(part.stock_unit, isPaint));
    setMode("edit");
    setError("");
    setNotice("");
  }

  function openRestock(part: Part) {
    setSelected(part);
    setStockUnit(normalizeStockUnit(part.stock_unit, isPaint));
    setRestockFree(false);
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
    if (importPayment === "credit" && !importSupplierId) {
      setError("Pick a supplier for credit imports.");
      return;
    }
    if (isGarage && suppliers.length > 0 && !importSupplierId) {
      setError("Pick a supplier. Use Walk-in / unnamed for cash buys with no named house.");
      return;
    }
    setImporting(true);
    setError("");
    setNotice("");
    const formData = new FormData();
    formData.append("file", file);
    formData.append("payment_status", importPayment);
    if (importPayment === "credit" && importDue) {
      formData.append("due_date", importDue);
    }
    if (importSupplierId) {
      formData.append("supplier_id", importSupplierId);
    }
    try {
      const result = await api<ImportResult>("/parts/import", { method: "POST", body: formData });
      const supplierName = suppliers.find((row) => String(row.id) === importSupplierId)?.name;
      setNotice(
        `${result.message} ${result.created} created, ${result.updated} updated, ${result.expenses_created} expenses (${money(result.expense_total)}). Default: ${importPayment === "credit" ? "credit (supplier owe)" : "paid (debit)"}${supplierName ? ` · ${supplierName}` : ""}.`,
      );
      setImportOpen(false);
      load(search, 1);
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
    setSaving(true);
    setError("");
    setNotice("");
    try {
      if (mode === "edit" && selected) {
        formData.set("serialized", form.querySelector<HTMLInputElement>('input[name="serialized"]')?.checked ? "1" : "0");
        await api(`/parts/${selected.id}`, { method: "POST", body: formData });
      } else {
        formData.set("serialized", form.querySelector<HTMLInputElement>('input[name="serialized"]')?.checked ? "1" : "0");
        await api("/parts", { method: "POST", body: formData });
      }
      form.reset();
      setMode(null);
      setSelected(null);
      load(search, 1);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Could not save part.");
    } finally {
      setSaving(false);
    }
  }

  async function restock(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!selected) return;
    const form = event.currentTarget;
    const payload = Object.fromEntries(new FormData(form)) as Record<string, string>;
    const serials = String(payload.serials || "")
      .split(/[\n,;]+/)
      .map((code) => code.trim())
      .filter(Boolean);
    delete payload.serials;
    if (serials.length) {
      payload.quantity = String(serials.length);
    }
    if (restockFree) {
      payload.unit_cost = "0";
      payload.payment_status = "paid";
      delete payload.due_date;
    } else if (!payload.due_date || payload.payment_status !== "credit") {
      delete payload.due_date;
    }
    if (!payload.supplier_id) {
      if (isGarage) {
        setError("Pick a supplier. Use Walk-in / unnamed for cash buys with no named house.");
        return;
      }
      delete payload.supplier_id;
    }
    setSaving(true);
    setError("");
    setNotice("");
    try {
      await api(`/parts/${selected.id}/restock`, {
        method: "POST",
        body: JSON.stringify({
          ...(serials.length ? { ...payload, serials } : payload),
          ...(restockFree ? { is_free: true } : {}),
        }),
      });
      form.reset();
      setRestockFree(false);
      setMode(null);
      setSelected(null);
      load(search, 1);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Could not restock part.");
    } finally {
      setSaving(false);
    }
  }

  function openDelete(part: Part) {
    if (!admin) return;
    setMode(null);
    setSelected(null);
    setSaving(false);
    setPendingDelete(part);
    setError("");
    setNotice("");
  }

  async function confirmDelete() {
    if (!pendingDelete) return;
    setDeleting(true);
    setError("");
    try {
      await api(`/parts/${pendingDelete.id}`, { method: "DELETE" });
      setNotice(`Deleted ${pendingDelete.name}.`);
      setPendingDelete(null);
      load(search, 1);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : `Could not delete ${itemNoun}.`);
    } finally {
      setDeleting(false);
    }
  }

  return (
    <AppShell
      title={isPaint ? "Color stock" : isStore ? "Stock" : "Inventory"}
      eyebrow={`${parts.length} catalog items${isPaint ? " · millilitres" : ""}`}
      action={admin ? (
        <div className="flex flex-wrap items-center justify-end gap-2">
          <Link
            href="/parts/bulk-restock"
            className="flex h-8 items-center gap-2 border border-[#167c73] bg-white px-2.5 text-[11px] font-semibold text-[#167c73]"
          >
            <TableProperties size={16} /><span className="hidden sm:inline">Bulk restock</span>
          </Link>
          <button
            type="button"
            onClick={downloadTemplate}
            disabled={downloadingTemplate}
            className="flex h-8 items-center gap-2 border border-[#20221f] bg-white px-2.5 text-[11px] font-semibold"
          >
            <Download size={16} /><span className="hidden sm:inline">{downloadingTemplate ? "Downloading..." : "Download template"}</span>
          </button>
          <button
            type="button"
            onClick={() => setImportOpen(true)}
            disabled={importing}
            className="flex h-8 items-center gap-2 border border-[#167c73] bg-white px-2.5 text-[11px] font-semibold text-[#167c73]"
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
          <button onClick={openAdd} className="flex h-8 items-center gap-2 bg-[#f5c842] px-2.5 text-[11px] font-semibold">
            <Plus size={18} /><span className="hidden sm:inline">{isPaint ? "Add colour" : isStore ? "Add item" : "Add item"}</span>
          </button>
        </div>
      ) : undefined}
    >
      <div className="mb-5 flex max-w-3xl flex-wrap items-end gap-2">
        <label className="relative min-w-56 flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-[#6f746e]" size={16} />
          <input
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            onKeyDown={(event) => {
              if (event.key !== "Enter") return;
              event.preventDefault();
              load(search, 1);
            }}
            className={`${inputClass} pl-10 ${search ? "pr-10" : ""}`}
            placeholder="Name, SKU, barcode, brand or model"
            aria-label="Search inventory"
          />
          {search && (
            <button
              type="button"
              onClick={() => setSearch("")}
              className="absolute right-2 top-1/2 grid size-7 -translate-y-1/2 place-items-center text-[#6f746e] hover:text-[#20221f]"
              aria-label="Clear search"
            >
              <X size={16} />
            </button>
          )}
        </label>
        <button type="button" onClick={() => load(search, 1)} className={buttonClass}>Search</button>
      </div>

      {error && <div className="mb-5"><ErrorMessage message={error} /></div>}
      {notice && <div className="mb-5"><SuccessMessage message={notice} /></div>}
      {total > 0 && (
        <p className="mb-3 text-xs text-[#6f746e]">
          {search.trim()
            ? `${total} match${total === 1 ? "" : "es"}`
            : `${total} in catalog`}
          {lastPage > 1 ? ` · page ${page} of ${lastPage}` : ""}
        </p>
      )}

      {loading && parts.length === 0 && !error ? (
        <PageState message="Loading inventory..." />
      ) : parts.length === 0 && !error ? (
        <PageState message={search.trim()
          ? "No inventory matches this search."
          : isStore ? "No stock in the catalog yet." : isPaint ? "No parts in the catalog yet." : "No inventory in the catalog yet."} />
      ) : (
        <div className="grid items-stretch gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
          {parts.map((part) => {
            const image = mediaUrl(part.image_urls?.[0] || part.images?.[0]);
            return (
              <Panel key={part.id} className="group relative flex h-full flex-col overflow-hidden">
                {admin && (
                  <button
                    type="button"
                    aria-label={`Remove ${part.name}`}
                    onClick={(event) => {
                      event.preventDefault();
                      event.stopPropagation();
                      openDelete(part);
                    }}
                    className="absolute right-2 top-2 z-20 grid size-8 place-items-center bg-[#b84837] text-white opacity-0 shadow-sm transition group-hover:opacity-100 group-focus-within:opacity-100 focus-visible:opacity-100 [@media(hover:none)]:opacity-100"
                  >
                    <X size={16} />
                  </button>
                )}
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
                      <span className={`shrink-0 px-1.5 py-0.5 text-[10px] font-bold ${part.stock_qty <= lowStockAt ? "bg-[#b84837]/10 text-[#b84837]" : "bg-[#167c73]/10 text-[#167c73]"}`}>
                        {formatStockQty(part.stock_qty, part.stock_unit, isPaint)}
                      </span>
                    </div>
                    {part.serialized ? <p className="mt-1 text-[10px] font-bold uppercase text-[#167c73]">IMEI</p> : null}
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
                    <span className="flex flex-1 border-l border-[#d7d3c8]">
                      <StickerPrintButton
                        item={part}
                        onBarcodeAssigned={(barcode) => {
                          setParts((current) => current.map((row) => (row.id === part.id ? { ...row, barcode } : row)));
                        }}
                      />
                    </span>
                  </div>
              </Panel>
            );
          })}
        </div>
      )}

      {lastPage > 1 && (
        <div className="mt-5 flex flex-wrap items-center justify-end gap-2">
          <button
            type="button"
            disabled={page <= 1 || loading}
            onClick={() => load(search, page - 1)}
            className="h-8 border border-[#c9c5b9] bg-white px-3 text-[11px] font-semibold disabled:opacity-40"
          >
            Previous
          </button>
          <button
            type="button"
            disabled={page >= lastPage || loading}
            onClick={() => load(search, page + 1)}
            className="h-8 border border-[#c9c5b9] bg-white px-3 text-[11px] font-semibold disabled:opacity-40"
          >
            Next
          </button>
        </div>
      )}

      {(mode === "add" || mode === "edit") && (
        <div
          className="fixed inset-0 z-50 grid place-items-center overflow-y-auto bg-black/55 p-4"
          onClick={() => { if (!saving) setMode(null); }}
        >
          <form
            onSubmit={savePart}
            onClick={(event) => event.stopPropagation()}
            aria-busy={saving}
            className="relative my-8 w-full max-w-2xl bg-[#f3f0e8]"
          >
            {saving && (
              <div className="absolute inset-0 z-10 grid place-items-center bg-[#f3f0e8]/80" role="status" aria-live="polite" aria-label="Saving">
                <Loader2 className="animate-spin text-[#167c73]" size={36} />
              </div>
            )}
            <div className="flex items-center justify-between border-b border-[#d7d3c8] p-5">
              <h2 className="font-display text-3xl font-semibold uppercase">{mode === "edit" ? (isPaint ? "Edit colour" : isStore ? "Edit item" : "Edit part") : (isPaint ? "Add colour / material" : isStore ? "Add stock item" : "Add inventory part")}</h2>
              <button type="button" onClick={() => setMode(null)} disabled={saving} aria-label="Close"><X /></button>
            </div>
            <div className="grid gap-4 p-5 sm:grid-cols-2">
              {[
                ["name", isPaint ? "Colour / product name" : isStore ? "Item name" : "Part name", selected?.name ?? ""],
                ["sku", isPaint ? "Paint / formula code" : "SKU", selected?.sku ?? ""],
                ["barcode", "Barcode (optional — auto if blank)", selected?.barcode ?? ""],
                ["brand", isPaint ? "Paint system brand" : "Brand", selected?.brand ?? ""],
                ["type", isPaint ? "Class" : isStore ? "Category" : "Category", selected?.type ?? ""],
                ["model", isPaint ? "Vehicle fitment (optional)" : isStore ? "Model" : "Compatible model", selected?.model ?? ""],
                ["year", isStore ? "Year" : "Compatible year", selected?.year ? String(selected.year) : ""],
                ["price", isPaint ? "Selling price per ml" : "Selling price", selected?.price ?? ""],
                ["cost_price", isPaint ? "Cost per ml" : "Cost price", selected?.cost_price ?? ""],
              ].map(([name, label, value]) => (
                <label key={name} className="text-xs font-bold uppercase">
                  {label}
                  <input
                    name={name}
                    defaultValue={value}
                    type={["year", "price", "cost_price"].includes(name) ? "number" : "text"}
                    step={name.includes("price") ? "0.01" : undefined}
                    required={!["sku", "barcode", "model", "year"].includes(name)}
                    list={name === "type" && isPaint ? "paint-material-classes" : undefined}
                    className={`${inputClass} mt-2`}
                  />
                </label>
              ))}
              {isPaint && (
                <datalist id="paint-material-classes">
                  {["Primer", "Base", "Clear", "Thinner", "Hardener", "Putty", "Tape", "Consumable"].map((option) => (
                    <option key={option} value={option} />
                  ))}
                </datalist>
              )}
              {mode === "add" && (
                <>
                  <label className="text-xs font-bold uppercase">
                    {isPaint ? "Opening stock (ML)" : "Opening stock"}
                    <input
                      key={stockUnit}
                      name="stock_qty"
                      type="number"
                      min="0"
                      step={stockAllowsDecimal(stockUnit, isPaint) ? "0.001" : "1"}
                      defaultValue="0"
                      required
                      className={`${inputClass} mt-2`}
                    />
                  </label>
                  {isGarage && (
                    <label className="text-xs font-bold uppercase">
                      Unit
                      <select
                        name="stock_unit"
                        value={stockUnit}
                        onChange={(event) => setStockUnit(normalizeStockUnit(event.target.value))}
                        className={`${inputClass} mt-2`}
                      >
                        <option value="qty">ITEM</option>
                        <option value="ml">ML</option>
                        <option value="l">L</option>
                      </select>
                    </label>
                  )}
                  {isPaint && <input type="hidden" name="stock_unit" value="ml" />}
                </>
              )}
              {mode === "edit" && selected && (
                <>
                  <label className="text-xs font-bold uppercase">
                    Current stock
                    <input
                      type="number"
                      readOnly
                      value={formatStockNumber(selected.stock_qty, selected.stock_unit, isPaint)}
                      className={`${inputClass} mt-2 bg-[#eeece5]`}
                    />
                  </label>
                  {(isGarage || isPaint) && (
                    <div className="text-xs font-bold uppercase">
                      Unit
                      <p className="mt-2 border border-[#c9c5b9] bg-[#eeece5] px-3 py-2 text-sm font-semibold normal-case">
                        {stockUnitLabel(selected.stock_unit, isPaint)}
                      </p>
                    </div>
                  )}
                  <p className="text-xs text-[#6f746e] sm:col-span-2">Use Restock to add stock and record expense.</p>
                </>
              )}
              <label className="text-xs font-bold uppercase sm:col-span-2">
                Description
                <textarea name="description" defaultValue={selected?.description ?? ""} rows={3} className={`${inputClass} mt-2`} />
              </label>
              {canSerial && (
                <label className="flex items-center gap-2 text-xs font-bold uppercase sm:col-span-2">
                  <input type="checkbox" name="serialized" defaultChecked={Boolean(selected?.serialized)} className="size-4 accent-[#167c73]" />
                  Track by IMEI / serial
                </label>
              )}
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
            <div className="flex items-center justify-between gap-3 border-t border-[#d7d3c8] p-5">
              {mode === "edit" && selected && (
                <button
                  type="button"
                  disabled={saving}
                  onClick={() => openDelete(selected)}
                  className="inline-flex h-8 items-center gap-1.5 border border-[#b84837] px-3 text-[11px] font-semibold text-[#b84837] hover:bg-[#b84837]/8 disabled:opacity-50"
                >
                  <Trash2 size={14} /> Delete
                </button>
              )}
              <button type="submit" disabled={saving} className={`${buttonClass} ml-auto`}>
                {saving && <Loader2 className="animate-spin" size={16} aria-hidden />}
                {saving ? "Saving..." : mode === "edit" ? "Save changes" : isStore ? "Save item" : "Save part"}
              </button>
            </div>
          </form>
        </div>
      )}

      {mode === "restock" && selected && (
        <div
          className="fixed inset-0 z-50 grid place-items-center overflow-y-auto bg-black/55 p-4"
          onClick={() => { if (!saving) setMode(null); }}
        >
          <form
            onSubmit={restock}
            onClick={(event) => event.stopPropagation()}
            aria-busy={saving}
            className="relative my-8 w-full max-w-md bg-[#f3f0e8]"
          >
            {saving && (
              <div className="absolute inset-0 z-10 grid place-items-center bg-[#f3f0e8]/80" role="status" aria-live="polite" aria-label="Saving">
                <Loader2 className="animate-spin text-[#167c73]" size={36} />
              </div>
            )}
            <div className="flex items-center justify-between border-b border-[#d7d3c8] p-5">
              <h2 className="font-display text-3xl font-semibold uppercase">Restock</h2>
              <button type="button" onClick={() => setMode(null)} disabled={saving} aria-label="Close"><X /></button>
            </div>
            <div className="space-y-4 p-5">
              <p className="text-sm text-[#6f746e]">
                Adding stock for <strong>{selected.name}</strong> (now {formatStockQty(selected.stock_qty, selected.stock_unit, isPaint)} @ cost {selected.cost_price || "0"}).
                {restockFree
                  ? " Free / gift stock: no purchase expense; average cost blends with unit cost 0."
                  : " New unit cost is blended as a weighted average with existing stock. The purchase expense still uses this restock’s unit cost × qty. Paid hits finance now; credit stays as a payable until settled."}
              </p>
              <label className="flex items-center gap-2 text-sm font-semibold">
                <input
                  type="checkbox"
                  checked={restockFree}
                  onChange={(event) => setRestockFree(event.target.checked)}
                  className="size-4 accent-[#167c73]"
                />
                Free / gift from supplier (no cost)
              </label>
              <label className="block text-xs font-bold uppercase">
                Quantity to add{isPaint ? " (ML)" : isGarage ? ` (${stockUnitLabel(selected.stock_unit)})` : ""}
                <input
                  name="quantity"
                  type="number"
                  min={stockAllowsDecimal(selected.stock_unit, isPaint) ? "0.001" : "1"}
                  step={stockAllowsDecimal(selected.stock_unit, isPaint) ? "0.001" : "1"}
                  required={!canSerial || !selected.serialized}
                  className={`${inputClass} mt-2`}
                />
              </label>
              {(isGarage || isPaint) && (
                <div className="text-xs font-bold uppercase">
                  Unit
                  <p className="mt-2 border border-[#c9c5b9] bg-[#eeece5] px-3 py-2 text-sm font-semibold normal-case">
                    {stockUnitLabel(selected.stock_unit, isPaint)}
                  </p>
                </div>
              )}
              {canSerial && (
                <label className="block text-xs font-bold uppercase">
                  IMEIs / serials (one per line)
                  <textarea name="serials" rows={4} required={Boolean(selected.serialized)} placeholder="356938035643809" className={`${inputClass} mt-2`} />
                </label>
              )}
              <label className="block text-xs font-bold uppercase">
                Unit cost
                <input
                  name="unit_cost"
                  type="number"
                  min="0"
                  step="0.01"
                  key={restockFree ? "free-cost" : `cost-${selected.id}`}
                  defaultValue={restockFree ? "0" : (selected.cost_price || "")}
                  disabled={restockFree}
                  className={`${inputClass} mt-2 disabled:bg-[#eeece5]`}
                />
              </label>
              <label className="block text-xs font-bold uppercase">
                Selling price
                <input name="price" type="number" min="0" step="0.01" defaultValue={selected.price || ""} className={`${inputClass} mt-2`} />
              </label>
              {suppliers.length > 0 && (
                <label className="block text-xs font-bold uppercase">
                  {isGarage ? "Supplier" : "Supplier (optional)"}
                  <select
                    name="supplier_id"
                    required={isGarage}
                    className={`${inputClass} mt-2`}
                    defaultValue={isGarage ? String(suppliers.find((row) => row.is_system)?.id ?? suppliers[0]?.id ?? "") : ""}
                  >
                    {!isGarage && <option value="">No supplier — same as today</option>}
                    {suppliers.map((supplier) => (
                      <option key={supplier.id} value={supplier.id}>{supplier.name}</option>
                    ))}
                  </select>
                </label>
              )}
              <label className="block text-xs font-bold uppercase">
                Supplier payment
                <select
                  name="payment_status"
                  className={`${inputClass} mt-2 disabled:bg-[#eeece5]`}
                  defaultValue="paid"
                  disabled={restockFree}
                  key={restockFree ? "pay-free" : "pay-normal"}
                >
                  <option value="paid">Paid now</option>
                  <option value="credit">Buy on credit</option>
                </select>
              </label>
              <label className="block text-xs font-bold uppercase">
                Supplier due date (credit only)
                <input name="due_date" type="date" disabled={restockFree} className={`${inputClass} mt-2 disabled:bg-[#eeece5]`} />
              </label>
              <label className="block text-xs font-bold uppercase">
                Expense date
                <input name="expense_date" type="date" defaultValue={new Date().toISOString().slice(0, 10)} className={`${inputClass} mt-2`} />
              </label>
            </div>
            <div className="flex justify-end border-t border-[#d7d3c8] p-5">
              <button type="submit" disabled={saving} className={buttonClass}>
                {saving && <Loader2 className="animate-spin" size={16} />}
                {saving ? "Saving..." : "Add to stock"}
              </button>
            </div>
          </form>
        </div>
      )}
      {importOpen && (
        <div className="fixed inset-0 z-50 grid place-items-center bg-black/55 p-4" onClick={() => setImportOpen(false)}>
          <div className="w-full max-w-md bg-[#f3f0e8] p-5" onClick={(event) => event.stopPropagation()}>
            <h2 className="font-display text-2xl font-semibold uppercase">Import parts</h2>
            <p className="mt-2 text-sm text-[#6f746e]">
              Name is the only required column. After stock_qty add unit: ITEM, L, or ML. Qty is a number (decimals allowed, e.g. 1.5 L). Blank brand becomes Generic, blank category becomes General. Credit also needs a due date.
            </p>
            {suppliers.length > 0 && (
              <label className="mt-4 block text-xs font-bold uppercase">
                {isGarage || importPayment === "credit" ? "Supplier" : "Supplier (optional)"}
                <select
                  value={importSupplierId}
                  onChange={(event) => setImportSupplierId(event.target.value)}
                  required={isGarage || importPayment === "credit"}
                  className={`${inputClass} mt-2`}
                >
                  {!(isGarage || importPayment === "credit") && <option value="">No supplier</option>}
                  {suppliers.map((supplier) => (
                    <option key={supplier.id} value={supplier.id}>{supplier.name}</option>
                  ))}
                </select>
              </label>
            )}
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
              disabled={
                importing
                || (importPayment === "credit" && !importDue)
                || ((isGarage || importPayment === "credit") && suppliers.length > 0 && !importSupplierId)
              }
              onClick={() => importInputRef.current?.click()}
              className={`${buttonClass} mt-5 w-full`}
            >
              {importing ? "Importing..." : "Choose spreadsheet"}
            </button>
          </div>
        </div>
      )}
      <ConfirmModal
        open={Boolean(pendingDelete)}
        title={`Delete ${itemNoun}`}
        message={
          pendingDelete
            ? `Delete “${pendingDelete.name}” from inventory? Existing bills keep the line, without this catalog item.`
            : ""
        }
        confirmLabel="Delete"
        tone="danger"
        busy={deleting}
        onCancel={() => { if (!deleting) setPendingDelete(null); }}
        onConfirm={confirmDelete}
      />
    </AppShell>
  );
}
