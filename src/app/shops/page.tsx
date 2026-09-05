"use client";

import { FormEvent, useEffect, useState } from "react";
import { ArrowRightLeft, Store } from "lucide-react";
import { AppShell } from "@/components/app-shell";
import { ErrorMessage, PageState, Panel, SuccessMessage, buttonClass, inputClass } from "@/components/ui";
import { api, Branch, currentFeatures, money } from "@/lib/api";

type ShopSummary = {
  branch: Branch;
  open_bills: number;
  today_sales: number;
  staff_count: number;
  month_expenses: number;
};

type CatalogItem = { id: number; name: string; stock_qty: number; kind: "part" | "product" };

export default function ShopsPage() {
  const [branches, setBranches] = useState<Branch[]>([]);
  const [summaries, setSummaries] = useState<Record<number, ShopSummary>>({});
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [editing, setEditing] = useState<Branch | null>(null);
  const [items, setItems] = useState<CatalogItem[]>([]);
  const [itemKind, setItemKind] = useState<"part" | "product">("part");
  const [saving, setSaving] = useState(false);

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
      }
    });
  }, []);

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
    const kind = String(form.get("item_kind") || itemKind);
    const itemId = Number(form.get("item_id"));
    try {
      await api("/stock-transfers", {
        method: "POST",
        body: JSON.stringify({
          from_branch_id: Number(form.get("from_branch_id")),
          to_branch_id: Number(form.get("to_branch_id")),
          quantity: Number(form.get("quantity")),
          ...(kind === "product" ? { product_id: itemId } : { part_id: itemId }),
        }),
      });
      setNotice("Stock moved.");
      event.currentTarget.reset();
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Unable to transfer stock.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <AppShell title="Shops" eyebrow="Locations">
      {error && <div className="mb-4"><ErrorMessage message={error} /></div>}
      {notice && <div className="mb-4"><SuccessMessage message={notice} /></div>}
      {branches.length === 0 ? <PageState message="Loading shops..." /> : (
        <div className="grid gap-5 xl:grid-cols-[1fr_0.55fr]">
          <Panel>
            <div className="border-b border-[#d7d3c8] px-5 py-4">
              <h2 className="font-display text-2xl font-semibold uppercase">Your shops</h2>
              <p className="text-xs text-[#6f746e]">You can rename a shop. Super-admin adds new locations.</p>
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
                    <button onClick={() => setEditing(branch)} className="h-9 border border-[#cbc7bc] px-3 text-xs font-semibold hover:bg-[#f5c842]">Rename</button>
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
                    <button type="button" onClick={() => setEditing(null)} className="h-9 border border-[#cbc7bc] px-3 text-xs">Cancel</button>
                  </div>
                </form>
              </Panel>
            )}
            {branches.length > 1 && (
              <Panel className="p-5">
                <div className="flex items-center gap-2">
                  <ArrowRightLeft size={18} className="text-[#167c73]" />
                  <h2 className="font-display text-2xl font-semibold uppercase">Move stock</h2>
                </div>
                <form onSubmit={transfer} className="mt-4 space-y-3">
                  <label className="block text-sm font-semibold">From
                    <select required name="from_branch_id" className={`mt-1 ${inputClass}`}>{branches.filter((b) => b.status !== "inactive").map((b) => <option key={b.id} value={b.id}>{b.name}</option>)}</select>
                  </label>
                  <label className="block text-sm font-semibold">To
                    <select required name="to_branch_id" className={`mt-1 ${inputClass}`}>{branches.filter((b) => b.status !== "inactive").map((b) => <option key={b.id} value={b.id}>{b.name}</option>)}</select>
                  </label>
                  {items.some((item) => item.kind === "part") && items.some((item) => item.kind === "product") && (
                    <label className="block text-sm font-semibold">Item
                      <select required name="item_kind" value={itemKind} onChange={(event) => setItemKind(event.target.value as "part" | "product")} className={`mt-1 ${inputClass}`}>
                        <option value="part">Part</option>
                        <option value="product">Product</option>
                      </select>
                    </label>
                  )}
                  <label className="block text-sm font-semibold">Stock
                    <select required name="item_id" className={`mt-1 ${inputClass}`}>
                      {items.filter((item) => item.kind === itemKind).map((item) => (
                        <option key={`${item.kind}-${item.id}`} value={item.id}>{item.name}</option>
                      ))}
                    </select>
                  </label>
                  <label className="block text-sm font-semibold">Quantity<input required name="quantity" type="number" min={1} className={`mt-1 ${inputClass}`} /></label>
                  <button disabled={saving} className={`${buttonClass} w-full`}>{saving ? "Moving..." : "Transfer"}</button>
                </form>
              </Panel>
            )}
          </div>
        </div>
      )}
    </AppShell>
  );
}
