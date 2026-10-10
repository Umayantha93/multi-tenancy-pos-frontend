"use client";

import { FormEvent, useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { AppShell } from "@/components/app-shell";
import { buttonClass, ErrorMessage, inputClass, PageState, Panel, SuccessMessage } from "@/components/ui";
import { api } from "@/lib/api";

type CatalogCategory = { id: number | null; name: string; subcategories: Array<{ id: number | null; name: string }> };

export default function PartCategoriesPage() {
  const [catalog, setCatalog] = useState<CatalogCategory[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [newCategory, setNewCategory] = useState("");
  const [newSubcategory, setNewSubcategory] = useState<Record<string, string>>({});

  const loadCatalog = useCallback(() => {
    setLoading(true);
    api<{ data: CatalogCategory[] }>("/part-categories")
      .then((result) => setCatalog(result.data))
      .catch((caught) => setError(caught instanceof Error ? caught.message : "Could not load categories."))
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    loadCatalog();
  }, [loadCatalog]);

  const savedCategories = catalog.filter((row) => row.id != null);

  async function addCategory(event: FormEvent) {
    event.preventDefault();
    const name = newCategory.trim();
    if (!name) return;
    setError("");
    try {
      await api("/part-categories", { method: "POST", body: JSON.stringify({ name }) });
      setNewCategory("");
      setNotice(`Added category ${name}.`);
      loadCatalog();
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Could not add that category.");
    }
  }

  async function addSubcategory(category: CatalogCategory, event: FormEvent) {
    event.preventDefault();
    const name = (newSubcategory[category.name] || "").trim();
    if (!name || category.id == null) return;
    setError("");
    try {
      await api(`/part-categories/${category.id}/subcategories`, { method: "POST", body: JSON.stringify({ name }) });
      setNewSubcategory((current) => ({ ...current, [category.name]: "" }));
      setNotice(`Added ${name} under ${category.name}.`);
      loadCatalog();
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Could not add that sub category.");
    }
  }

  return (
    <AppShell
      title="Categories"
      eyebrow="Categories and sub categories for inventory"
      action={(
        <Link href="/parts" className="flex h-8 items-center gap-2 border border-[#20221f] bg-white px-2.5 text-[11px] font-semibold">
          <ArrowLeft size={16} /><span className="hidden sm:inline">Inventory</span>
        </Link>
      )}
    >
      {error && <div className="mb-5"><ErrorMessage message={error} /></div>}
      {notice && <div className="mb-5"><SuccessMessage message={notice} /></div>}
      <Panel className="p-4">
        <h2 className="font-display text-xl font-semibold uppercase">Add a category</h2>
        <p className="mt-1 text-sm text-[#6f746e]">Add a category, then add sub categories under it. They show when you add, edit, or bulk restock an item.</p>
        <form onSubmit={addCategory} className="mt-3 flex max-w-lg flex-wrap gap-2">
          <input value={newCategory} onChange={(event) => setNewCategory(event.target.value)} placeholder="New category" className={`${inputClass} min-w-48 flex-1`} />
          <button type="submit" className={buttonClass}>Add category</button>
        </form>
        {loading && savedCategories.length === 0 ? (
          <div className="mt-4"><PageState message="Loading categories..." /></div>
        ) : (
          <div className="mt-4 grid gap-3 md:grid-cols-2">
            {savedCategories.map((category) => (
              <div key={category.id ?? category.name} className="border border-[#d7d3c8] bg-white p-3">
                <p className="text-sm font-semibold">{category.name}</p>
                <p className="mt-1 text-xs text-[#6f746e]">
                  {category.subcategories.length > 0 ? category.subcategories.map((sub) => sub.name).join(", ") : "No sub categories yet."}
                </p>
                <form onSubmit={(event) => void addSubcategory(category, event)} className="mt-2 flex gap-2">
                  <input
                    value={newSubcategory[category.name] || ""}
                    onChange={(event) => setNewSubcategory((current) => ({ ...current, [category.name]: event.target.value }))}
                    placeholder="New sub category"
                    className={`${inputClass} min-w-0 flex-1`}
                  />
                  <button type="submit" className="h-8 border border-[#167c73] px-2 text-[11px] font-semibold text-[#167c73]">Add</button>
                </form>
              </div>
            ))}
            {savedCategories.length === 0 && <p className="text-sm text-[#6f746e]">No categories yet.</p>}
          </div>
        )}
      </Panel>
    </AppShell>
  );
}
