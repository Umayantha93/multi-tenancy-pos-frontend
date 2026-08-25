"use client";

import { FormEvent, Suspense, useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Boxes, Pencil, Search, X } from "lucide-react";
import { PlatformShell } from "@/components/platform-shell";
import { ErrorMessage, PageState, Panel, buttonClass, inputClass } from "@/components/ui";
import { api, money, Tenant } from "@/lib/api";

type TenantRow = Tenant & { owner_email?: string | null };
type TenantPage = { data: TenantRow[] };

type PartRow = {
  id: number;
  name: string;
  brand: string;
  type: string;
  sku?: string | null;
  barcode?: string | null;
  model?: string | null;
  stock_qty: number;
  price: string;
  cost_price?: string | null;
};

type ProductRow = {
  id: number;
  name: string;
  sku?: string | null;
  category?: string | null;
  stock_qty: number;
  price: string;
  cost_price?: string | null;
};

type Page<T> = { data: T[]; total: number };

type Kind = "parts" | "products";

function InventoryPageInner() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const tenantParam = searchParams.get("tenant") || "";
  const [tenants, setTenants] = useState<TenantRow[]>([]);
  const [tenantId, setTenantId] = useState(tenantParam);
  const [kind, setKind] = useState<Kind>("parts");
  const [search, setSearch] = useState("");
  const [parts, setParts] = useState<Page<PartRow> | null>(null);
  const [products, setProducts] = useState<Page<ProductRow> | null>(null);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [loading, setLoading] = useState(false);
  const [editing, setEditing] = useState<PartRow | ProductRow | null>(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    api<TenantPage>("/super-admin/tenants?per_page=100&status=")
      .then((page) => setTenants(page.data))
      .catch((caught) => setError(caught.message));
  }, []);

  useEffect(() => {
    setTenantId(tenantParam);
  }, [tenantParam]);

  useEffect(() => {
    if (!tenantId) {
      setParts(null);
      setProducts(null);
      return;
    }
    setLoading(true);
    setError("");
    const timer = setTimeout(() => {
      const params = new URLSearchParams({ per_page: "50" });
      if (search) params.set("search", search);
      const path = kind === "parts"
        ? `/super-admin/tenants/${tenantId}/inventory/parts?${params}`
        : `/super-admin/tenants/${tenantId}/inventory/products?${params}`;
      api<Page<PartRow & ProductRow>>(path)
        .then((page) => {
          if (kind === "parts") {
            setParts(page as Page<PartRow>);
            setProducts(null);
          } else {
            setProducts(page as Page<ProductRow>);
            setParts(null);
          }
        })
        .catch((caught) => setError(caught.message))
        .finally(() => setLoading(false));
    }, 250);
    return () => clearTimeout(timer);
  }, [tenantId, search, kind]);

  function selectTenant(id: string) {
    setTenantId(id);
    setEditing(null);
    const next = new URLSearchParams();
    if (id) next.set("tenant", id);
    router.replace(id ? `/super-admin/inventory?${next}` : "/super-admin/inventory");
  }

  async function save(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!tenantId || !editing) return;
    setSaving(true);
    setError("");
    setNotice("");
    const form = new FormData(event.currentTarget);
    const payload: Record<string, string | number> = {
      stock_qty: Number(form.get("stock_qty")),
      price: Number(form.get("price")),
      cost_price: form.get("cost_price") === "" ? "" : Number(form.get("cost_price")),
      note: String(form.get("note") || ""),
    };
    if (kind === "parts") {
      payload.name = String(form.get("name") || "");
      payload.brand = String(form.get("brand") || "");
    } else {
      payload.name = String(form.get("name") || "");
    }
    try {
      const path = kind === "parts"
        ? `/super-admin/tenants/${tenantId}/inventory/parts/${editing.id}`
        : `/super-admin/tenants/${tenantId}/inventory/products/${editing.id}`;
      await api(path, {
        method: "PUT",
        body: JSON.stringify({
          ...payload,
          cost_price: payload.cost_price === "" ? null : payload.cost_price,
        }),
      });
      setNotice("Inventory updated. No expense was created.");
      setEditing(null);
      const params = new URLSearchParams({ per_page: "50" });
      if (search) params.set("search", search);
      const listPath = kind === "parts"
        ? `/super-admin/tenants/${tenantId}/inventory/parts?${params}`
        : `/super-admin/tenants/${tenantId}/inventory/products?${params}`;
      const page = await api<Page<PartRow & ProductRow>>(listPath);
      if (kind === "parts") setParts(page as Page<PartRow>);
      else setProducts(page as Page<ProductRow>);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Could not save inventory.");
    } finally {
      setSaving(false);
    }
  }

  const selected = tenants.find((tenant) => String(tenant.id) === tenantId);
  const rows = kind === "parts" ? parts?.data ?? [] : products?.data ?? [];
  const total = kind === "parts" ? parts?.total ?? 0 : products?.total ?? 0;

  return (
    <PlatformShell title="Tenant inventory" eyebrow="Platform control">
      <div className="mb-4 border border-[#167c73]/25 bg-[#167c73]/8 px-4 py-3 text-sm text-[#0f5a53]">
        Correct stock counts (and catalogue fields) for a selected business. These edits do <strong>not</strong> create purchase expenses or restock payables — use tenant Restock for real buys.
      </div>

      <form onSubmit={(event) => event.preventDefault()} className="mb-5 grid gap-3 lg:grid-cols-[1.4fr_1fr_auto_auto]">
        <label>
          <span className="mb-1 block text-[10px] font-bold uppercase text-[#6f746e]">Tenant</span>
          <select value={tenantId} onChange={(event) => selectTenant(event.target.value)} className={inputClass}>
            <option value="">Select a business</option>
            {tenants.map((tenant) => (
              <option key={tenant.id} value={tenant.id}>{tenant.business_name}</option>
            ))}
          </select>
        </label>
        <label className="relative">
          <span className="mb-1 block text-[10px] font-bold uppercase text-[#6f746e]">Search</span>
          <Search size={17} className="absolute left-3 top-9 text-[#6f746e]" />
          <input
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            placeholder={kind === "parts" ? "Name, SKU, barcode, brand" : "Name, SKU, category"}
            className={`${inputClass} pl-10`}
            disabled={!tenantId}
          />
        </label>
        <label>
          <span className="mb-1 block text-[10px] font-bold uppercase text-[#6f746e]">Catalogue</span>
          <select
            value={kind}
            onChange={(event) => { setKind(event.target.value as Kind); setEditing(null); }}
            className={inputClass}
            disabled={!tenantId}
          >
            <option value="parts">Parts</option>
            <option value="products">Products</option>
          </select>
        </label>
        <div className="flex items-end">
          <div className="flex h-11 items-center gap-2 border border-[#d7d3c8] bg-white px-3 text-xs font-bold uppercase text-[#6f746e]">
            <Boxes size={16} /> {total} items
          </div>
        </div>
      </form>

      {error && <ErrorMessage message={error} />}
      {notice && <p className="mb-4 text-sm font-semibold text-[#167c73]">{notice}</p>}

      {!tenantId ? (
        <PageState message="Select a tenant to view and correct inventory." />
      ) : loading ? (
        <PageState message="Loading inventory..." />
      ) : (
        <Panel className="overflow-hidden p-0">
          <div className="border-b border-[#d7d3c8] px-5 py-4">
            <h2 className="font-display text-2xl font-semibold uppercase">{selected?.business_name}</h2>
            <p className="text-xs text-[#6f746e]">
              {total} {kind} · stock edits are platform corrections only
            </p>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full min-w-[720px] text-left text-sm">
              <thead className="bg-[#e7e4db] text-[10px] uppercase text-[#6f746e]">
                <tr>
                  <th className="px-4 py-3">Item</th>
                  <th>Stock</th>
                  <th>Cost</th>
                  <th>Sell</th>
                  <th className="pr-4 text-right">Action</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((row) => (
                  <tr key={row.id} className="border-t border-[#e2ded4]">
                    <td className="px-4 py-3">
                      <p className="font-semibold uppercase">{row.name}</p>
                      <p className="text-xs text-[#6f746e]">
                        {"brand" in row && row.brand ? `${row.brand} · ` : ""}
                        {"type" in row && row.type ? `${row.type} · ` : ""}
                        {"category" in row && row.category ? `${row.category} · ` : ""}
                        {row.sku || "No SKU"}
                      </p>
                    </td>
                    <td className="tabular-nums font-semibold">{row.stock_qty}</td>
                    <td className="tabular-nums">{money(row.cost_price)}</td>
                    <td className="tabular-nums">{money(row.price)}</td>
                    <td className="pr-4 text-right">
                      <button
                        type="button"
                        onClick={() => setEditing(row)}
                        className="inline-flex items-center gap-1 text-xs font-bold uppercase text-[#167c73] hover:underline"
                      >
                        <Pencil size={14} /> Edit
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            {rows.length === 0 && (
              <p className="p-8 text-center text-sm text-[#6f746e]">No {kind} for this tenant.</p>
            )}
          </div>
        </Panel>
      )}

      {editing && (
        <div className="fixed inset-0 z-50 grid place-items-center overflow-y-auto bg-black/55 p-4" onClick={() => setEditing(null)}>
          <form
            onSubmit={save}
            onClick={(event) => event.stopPropagation()}
            className="my-8 w-full max-w-md bg-[#f3f0e8]"
          >
            <div className="flex items-center justify-between border-b border-[#d7d3c8] p-5">
              <h2 className="font-display text-3xl font-semibold uppercase">Correct stock</h2>
              <button type="button" onClick={() => setEditing(null)} aria-label="Close"><X /></button>
            </div>
            <div className="space-y-4 p-5">
              <p className="text-sm text-[#6f746e]">
                Sets the on-hand quantity directly. Does not post to Finance / expenses.
              </p>
              <label className="block text-xs font-bold uppercase">
                Name
                <input name="name" defaultValue={editing.name} required className={`${inputClass} mt-2`} />
              </label>
              {kind === "parts" && "brand" in editing && (
                <label className="block text-xs font-bold uppercase">
                  Brand
                  <input name="brand" defaultValue={editing.brand} required className={`${inputClass} mt-2`} />
                </label>
              )}
              <label className="block text-xs font-bold uppercase">
                Stock qty
                <input name="stock_qty" type="number" min={0} step={1} required defaultValue={editing.stock_qty} className={`${inputClass} mt-2`} />
              </label>
              <div className="grid grid-cols-2 gap-3">
                <label className="block text-xs font-bold uppercase">
                  Cost price
                  <input name="cost_price" type="number" min={0} step="0.01" defaultValue={editing.cost_price ?? ""} className={`${inputClass} mt-2`} />
                </label>
                <label className="block text-xs font-bold uppercase">
                  Sell price
                  <input name="price" type="number" min={0} step="0.01" required defaultValue={editing.price} className={`${inputClass} mt-2`} />
                </label>
              </div>
              <label className="block text-xs font-bold uppercase">
                Note (audit)
                <input name="note" placeholder="Why this correction?" className={`${inputClass} mt-2`} />
              </label>
              <button disabled={saving} className={`${buttonClass} w-full`}>
                {saving ? "Saving..." : "Save without expense"}
              </button>
            </div>
          </form>
        </div>
      )}
    </PlatformShell>
  );
}

export default function SuperAdminInventoryPage() {
  return (
    <Suspense fallback={<PlatformShell title="Tenant inventory"><PageState message="Loading..." /></PlatformShell>}>
      <InventoryPageInner />
    </Suspense>
  );
}
