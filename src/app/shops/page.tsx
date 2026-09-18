"use client";

import Link from "next/link";
import { FormEvent, useEffect, useMemo, useState } from "react";
import { ArrowRightLeft, Plus, Printer, Store, Trash2 } from "lucide-react";
import { AppShell } from "@/components/app-shell";
import { ErrorMessage, PageState, Panel, SuccessMessage, buttonClass, inputClass } from "@/components/ui";
import { api, Branch, currentFeatures, currentUser, formatDate, money } from "@/lib/api";

type ShopSummary = {
  branch: Branch;
  open_bills: number;
  today_sales: number;
  staff_count: number;
  month_expenses: number;
};

type CatalogItem = { id: number; name: string; stock_qty: number; kind: "part" | "product" };
type TransferLine = { kind: "part" | "product"; item_id: string; quantity: string };
type TransferItem = {
  id: number;
  quantity: number;
  part?: { id: number; name: string; sku?: string | null } | null;
  product?: { id: number; name: string; sku?: string | null } | null;
};
type Transfer = {
  id: number;
  transfer_number?: string | null;
  status: string;
  notes?: string | null;
  created_at: string;
  received_at?: string | null;
  from_branch?: { id: number; name: string };
  to_branch?: { id: number; name: string };
  items?: TransferItem[];
};

export default function ShopsPage() {
  const [branches, setBranches] = useState<Branch[]>([]);
  const [summaries, setSummaries] = useState<Record<number, ShopSummary>>({});
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [editing, setEditing] = useState<Branch | null>(null);
  const [items, setItems] = useState<CatalogItem[]>([]);
  const [itemKind, setItemKind] = useState<"part" | "product">("part");
  const [saving, setSaving] = useState(false);
  const [lines, setLines] = useState<TransferLine[]>([{ kind: "part", item_id: "", quantity: "1" }]);
  const [transfers, setTransfers] = useState<Transfer[]>([]);
  const isOwner = currentUser()?.role === "business_owner";

  async function load() {
    try {
      const result = await api<{ data: Branch[] }>("/branches");
      setBranches(result.data);
      const next: Record<number, ShopSummary> = {};
      await Promise.all(result.data.map(async (branch) => {
        try {
          next[branch.id] = await api<ShopSummary>(`/branches/${branch.id}`);
        } catch {
          /* Shop summary is optional. */
        }
      }));
      setSummaries(next);
      const history = await api<{ data: Transfer[] }>("/stock-transfers?per_page=20");
      setTransfers(history.data);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Unable to load shops.");
    }
  }

  useEffect(() => {
    load();
    const features = currentFeatures();
    const catalog: CatalogItem[] = [];
    const requests: Promise<void>[] = [];
    if (features.includes("parts_inventory")) {
      requests.push(
        api<{ data: Array<{ id: number; name: string; stock_qty: number }> }>("/parts?per_page=100")
          .then((result) => { catalog.push(...result.data.map((part) => ({ ...part, kind: "part" as const }))); })
          .catch(() => undefined),
      );
    }
    if (features.includes("product_catalog")) {
      requests.push(
        api<{ data: Array<{ id: number; name: string; stock_qty: number }> }>("/products?per_page=100")
          .then((result) => { catalog.push(...result.data.map((product) => ({ ...product, kind: "product" as const }))); })
          .catch(() => undefined),
      );
    }
    Promise.all(requests).then(() => {
      setItems(catalog);
      if (!catalog.some((item) => item.kind === "part") && catalog.some((item) => item.kind === "product")) {
        setItemKind("product");
        setLines([{ kind: "product", item_id: "", quantity: "1" }]);
      }
    });
  }, []);

  const kindOptions = useMemo(() => items.filter((item) => item.kind === itemKind), [items, itemKind]);

  async function rename(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!editing) return;
    setSaving(true);
    setError("");
    const form = new FormData(event.currentTarget);
    try {
      await api(`/branches/${editing.id}`, {
        method: "PUT",
        body: JSON.stringify({
          name: form.get("name"),
          address: form.get("address") || null,
          phone: form.get("phone") || null,
        }),
      });
      setNotice("Shop updated.");
      setEditing(null);
      load();
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Unable to rename shop.");
    } finally {
      setSaving(false);
    }
  }

  async function transfer(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSaving(true);
    setError("");
    const form = new FormData(event.currentTarget);
    const payloadItems = lines
      .filter((line) => line.item_id && Number(line.quantity) > 0)
      .map((line) => ({
        ...(line.kind === "product" ? { product_id: Number(line.item_id) } : { part_id: Number(line.item_id) }),
        quantity: Number(line.quantity),
      }));
    try {
      await api("/stock-transfers", {
        method: "POST",
        body: JSON.stringify({
          from_branch_id: Number(form.get("from_branch_id")),
          to_branch_id: Number(form.get("to_branch_id")),
          notes: form.get("notes") || null,
          items: payloadItems,
        }),
      });
      setNotice("Transfer note created. Receive it at the destination shop.");
      event.currentTarget.reset();
      setLines([{ kind: itemKind, item_id: "", quantity: "1" }]);
      load();
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Unable to transfer stock.");
    } finally {
      setSaving(false);
    }
  }

  async function receive(id: number) {
    setSaving(true);
    setError("");
    try {
      await api(`/stock-transfers/${id}/receive`, { method: "POST" });
      setNotice("Stock received.");
      load();
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Unable to receive transfer.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <AppShell title="Shops" eyebrow="Locations">
      {error && <div className="mb-4"><ErrorMessage message={error} /></div>}
      {notice && <div className="mb-4"><SuccessMessage message={notice} /></div>}
      {branches.length === 0 ? <PageState message="Loading shops..." /> : (
        <div className="grid gap-5 xl:grid-cols-[1fr_0.7fr]">
          <Panel>
            <div className="border-b border-[#d7d3c8] px-5 py-4">
              <h2 className="font-display text-2xl font-semibold uppercase">Your shops</h2>
              <p className="text-xs text-[#6f746e]">{isOwner ? "You can rename a shop. Super-admin adds new locations." : "Receive stock sent to this shop."}</p>
            </div>
            <div className="divide-y divide-[#dedad0]">
              {branches.map((branch) => {
                const summary = summaries[branch.id];
                return (
                  <div key={branch.id} className="flex flex-wrap items-center gap-4 px-5 py-4">
                    <span className="grid size-10 place-items-center bg-[#e7e4db]"><Store size={18} /></span>
                    <div className="min-w-44 flex-1">
                      <strong className="block text-sm">{branch.name}</strong>
                      <span className="text-xs text-[#6f746e]">{branch.code}{branch.address ? ` · ${branch.address}` : ""}{branch.status === "inactive" ? " · inactive" : ""}</span>
                    </div>
                    {summary && (
                      <div className="flex gap-4 text-xs text-[#6f746e]">
                        <span>{summary.open_bills} open</span>
                        <span>{money(summary.today_sales)} today</span>
                        <span>{summary.staff_count} staff</span>
                      </div>
                    )}
                    {isOwner && <button onClick={() => setEditing(branch)} className="h-8 border border-[#cbc7bc] px-3 text-xs font-semibold hover:bg-[#f5c842]">Rename</button>}
                  </div>
                );
              })}
            </div>
          </Panel>
          <div className="space-y-5">
            {editing && (
              <Panel className="p-5">
                <h2 className="font-display text-2xl font-semibold uppercase">Rename {editing.name}</h2>
                <form onSubmit={rename} className="mt-4 space-y-3">
                  <label className="block text-sm font-semibold">Name<input required name="name" defaultValue={editing.name} className={`mt-1 ${inputClass}`} /></label>
                  <label className="block text-sm font-semibold">Address<input name="address" defaultValue={editing.address ?? ""} className={`mt-1 ${inputClass}`} /></label>
                  <label className="block text-sm font-semibold">Phone<input name="phone" defaultValue={editing.phone ?? ""} className={`mt-1 ${inputClass}`} /></label>
                  <div className="flex gap-2">
                    <button disabled={saving} className={buttonClass}>{saving ? "Saving..." : "Save"}</button>
                    <button type="button" onClick={() => setEditing(null)} className="h-8 border border-[#cbc7bc] px-3 text-xs">Cancel</button>
                  </div>
                </form>
              </Panel>
            )}
            {branches.length > 1 && isOwner && (
              <Panel className="p-5">
                <div className="flex items-center gap-2">
                  <ArrowRightLeft size={18} className="text-[#167c73]" />
                  <h2 className="font-display text-2xl font-semibold uppercase">Transfer note</h2>
                </div>
                <form onSubmit={transfer} className="mt-4 space-y-3">
                  <label className="block text-sm font-semibold">From
                    <select required name="from_branch_id" className={`mt-1 ${inputClass}`}>{branches.filter((b) => b.status !== "inactive").map((b) => <option key={b.id} value={b.id}>{b.name}</option>)}</select>
                  </label>
                  <label className="block text-sm font-semibold">To
                    <select required name="to_branch_id" className={`mt-1 ${inputClass}`}>{branches.filter((b) => b.status !== "inactive").map((b) => <option key={b.id} value={b.id}>{b.name}</option>)}</select>
                  </label>
                  {items.some((item) => item.kind === "part") && items.some((item) => item.kind === "product") && (
                    <label className="block text-sm font-semibold">Catalog
                      <select value={itemKind} onChange={(event) => setItemKind(event.target.value as "part" | "product")} className={`mt-1 ${inputClass}`}>
                        <option value="part">Part</option>
                        <option value="product">Product</option>
                      </select>
                    </label>
                  )}
                  <div className="space-y-2">
                    {lines.map((line, index) => (
                      <div key={index} className="grid grid-cols-[1fr_5rem_auto] gap-2">
                        <select
                          required
                          value={line.item_id}
                          onChange={(event) => setLines((rows) => rows.map((row, rowIndex) => rowIndex === index ? { ...row, kind: itemKind, item_id: event.target.value } : row))}
                          className={inputClass}
                        >
                          <option value="">Stock</option>
                          {kindOptions.map((item) => (
                            <option key={`${item.kind}-${item.id}`} value={item.id}>{item.name}</option>
                          ))}
                        </select>
                        <input
                          required
                          type="number"
                          min={1}
                          value={line.quantity}
                          onChange={(event) => setLines((rows) => rows.map((row, rowIndex) => rowIndex === index ? { ...row, quantity: event.target.value } : row))}
                          className={inputClass}
                        />
                        {lines.length > 1 && (
                          <button type="button" onClick={() => setLines((rows) => rows.filter((_, rowIndex) => rowIndex !== index))} className="grid size-8 place-items-center text-[#b84837]" aria-label="Remove line">
                            <Trash2 size={14} />
                          </button>
                        )}
                      </div>
                    ))}
                    <button type="button" onClick={() => setLines((rows) => [...rows, { kind: itemKind, item_id: "", quantity: "1" }])} className="inline-flex h-8 items-center gap-1 text-xs font-semibold text-[#167c73]">
                      <Plus size={14} /> Add line
                    </button>
                  </div>
                  <label className="block text-sm font-semibold">Note<input name="notes" className={`mt-1 ${inputClass}`} /></label>
                  <button disabled={saving} className={`${buttonClass} w-full`}>{saving ? "Saving..." : "Create transfer"}</button>
                </form>
              </Panel>
            )}
            <Panel>
              <div className="border-b border-[#d7d3c8] px-5 py-4">
                <h2 className="font-display text-2xl font-semibold uppercase">Transfer history</h2>
              </div>
              <div className="divide-y divide-[#e2ded4]">
                {transfers.map((transferRow) => (
                  <div key={transferRow.id} className="flex flex-wrap items-center gap-3 px-5 py-3 text-sm">
                    <div className="min-w-0 flex-1">
                      <p className="font-semibold">{transferRow.transfer_number || `TRF-${transferRow.id}`}</p>
                      <p className="text-xs text-[#6f746e]">
                        {transferRow.from_branch?.name} → {transferRow.to_branch?.name} · {formatDate(transferRow.created_at)} · {transferRow.status}
                      </p>
                    </div>
                    {transferRow.status === "pending" && (
                      <button type="button" disabled={saving} onClick={() => receive(transferRow.id)} className="h-8 border border-[#167c73] px-3 text-xs font-semibold text-[#167c73]">Receive</button>
                    )}
                    <Link href={`/shops/transfers/${transferRow.id}`} className="grid size-8 place-items-center border border-[#cbc7bc]" aria-label="Print transfer">
                      <Printer size={14} />
                    </Link>
                  </div>
                ))}
                {transfers.length === 0 && <p className="p-5 text-sm text-[#6f746e]">No transfers yet.</p>}
              </div>
            </Panel>
          </div>
        </div>
      )}
    </AppShell>
  );
}
