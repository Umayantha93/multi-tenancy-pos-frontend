"use client";

import { FormEvent, useCallback, useEffect, useState } from "react";
import { Minus, Plus, TrendingUp } from "lucide-react";
import { AppShell } from "@/components/app-shell";
import { buttonClass, ErrorMessage, inputClass, Panel } from "@/components/ui";
import { api, money } from "@/lib/api";

type Sheet = {
  income: number;
  expenses: number;
  net_profit: number;
  expense_breakdown: Record<string, number>;
  yearly_trend: Array<{ month: number; income: number; expenses: number; net_profit: number }>;
};
type Part = { id: number; name: string; stock_qty: number; cost_price: string };

export default function BalanceSheetPage() {
  const now = new Date();
  const [month, setMonth] = useState(now.getMonth() + 1);
  const [year, setYear] = useState(now.getFullYear());
  const [sheet, setSheet] = useState<Sheet | null>(null);
  const [error, setError] = useState("");
  const [category, setCategory] = useState("rent");
  const [parts, setParts] = useState<Part[]>([]);
  const [partId, setPartId] = useState("");

  const load = useCallback(() => {
    api<Sheet>(`/balance-sheet?month=${month}&year=${year}`).then(setSheet).catch((caught) => setError(caught.message));
  }, [month, year]);

  useEffect(() => { load(); }, [load]);

  useEffect(() => {
    if (category !== "inventory") return;
    api<{ data: Part[] }>("/parts?per_page=100")
      .then((result) => setParts(result.data))
      .catch(() => setParts([]));
  }, [category]);

  async function expense(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = event.currentTarget;
    const formData = new FormData(form);
    const selectedCategory = String(formData.get("category") || category);

    try {
      if (selectedCategory === "inventory" && partId) {
        const quantity = Number(formData.get("quantity") || 0);
        const unitCost = formData.get("amount") ? Number(formData.get("amount")) / Math.max(quantity, 1) : undefined;
        await api(`/parts/${partId}/restock`, {
          method: "POST",
          body: JSON.stringify({
            quantity,
            unit_cost: unitCost,
            expense_date: formData.get("expense_date"),
          }),
        });
      } else {
        await api("/expenses", { method: "POST", body: JSON.stringify(Object.fromEntries(formData)) });
      }
      form.reset();
      setCategory("rent");
      setPartId("");
      load();
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Could not add expense.");
    }
  }

  const selectedPart = parts.find((part) => String(part.id) === partId);
  const max = Math.max(1, ...(sheet?.yearly_trend.flatMap((item) => [item.income, item.expenses]) ?? []));

  return (
    <AppShell title="Finance" eyebrow="Income, expenses & profit">
      <div className="mb-5 flex flex-wrap items-end gap-3">
        <label className="text-xs font-bold uppercase">
          Month
          <select value={month} onChange={(event) => setMonth(Number(event.target.value))} className={`${inputClass} mt-2 w-40`}>
            {Array.from({ length: 12 }, (_, index) => (
              <option key={index + 1} value={index + 1}>{new Date(2026, index).toLocaleString("en", { month: "long" })}</option>
            ))}
          </select>
        </label>
        <label className="text-xs font-bold uppercase">
          Year
          <input value={year} onChange={(event) => setYear(Number(event.target.value))} className={`${inputClass} mt-2 w-28`} type="number" />
        </label>
        <button onClick={load} className={buttonClass}>Apply period</button>
      </div>

      {error && <div className="mb-5"><ErrorMessage message={error} /></div>}

      {sheet && (
        <>
          <div className="grid gap-3 sm:grid-cols-3">
            <Panel className="p-5"><Plus className="text-[#167c73]" /><p className="mt-6 text-xs font-bold uppercase text-[#6f746e]">Income</p><p className="font-display text-3xl font-semibold">{money(sheet.income)}</p></Panel>
            <Panel className="p-5"><Minus className="text-[#b84837]" /><p className="mt-6 text-xs font-bold uppercase text-[#6f746e]">Expenses</p><p className="font-display text-3xl font-semibold">{money(sheet.expenses)}</p></Panel>
            <Panel className="bg-[#242723] p-5 text-white"><TrendingUp className="text-[#f5c842]" /><p className="mt-6 text-xs font-bold uppercase text-white/50">Net profit</p><p className="font-display text-3xl font-semibold">{money(sheet.net_profit)}</p></Panel>
          </div>

          <div className="mt-5 grid gap-5 xl:grid-cols-[1.4fr_0.8fr]">
            <Panel className="p-5">
              <h2 className="font-display text-2xl font-semibold uppercase">Yearly cash trend</h2>
              <div className="mt-6 flex h-56 items-end gap-2 border-b border-[#c9c5b9]">
                {sheet.yearly_trend.map((item) => (
                  <div key={item.month} className="flex h-full flex-1 items-end justify-center gap-px">
                    <span className="w-2 bg-[#167c73]" style={{ height: `${Math.max(2, item.income / max * 100)}%` }} title={`Income ${money(item.income)}`} />
                    <span className="w-2 bg-[#b84837]" style={{ height: `${Math.max(2, item.expenses / max * 100)}%` }} title={`Expenses ${money(item.expenses)}`} />
                  </div>
                ))}
              </div>
              <div className="mt-2 grid grid-cols-12 text-center text-[9px] text-[#6f746e]">
                {sheet.yearly_trend.map((item) => (
                  <span key={item.month}>{new Date(2026, item.month - 1).toLocaleString("en", { month: "short" })[0]}</span>
                ))}
              </div>
            </Panel>

            <Panel>
              <div className="border-b border-[#d7d3c8] p-5">
                <h2 className="font-display text-2xl font-semibold uppercase">Add expense</h2>
              </div>
              <form onSubmit={expense} className="space-y-4 p-5">
                <label className="block text-xs font-bold uppercase">
                  Category
                  <select
                    name="category"
                    value={category}
                    onChange={(event) => { setCategory(event.target.value); setPartId(""); }}
                    className={`${inputClass} mt-2`}
                  >
                    <option value="rent">Rent</option>
                    <option value="utilities">Utilities</option>
                    <option value="inventory">Inventory purchase</option>
                    <option value="maintenance">Maintenance</option>
                    <option value="misc">Miscellaneous</option>
                  </select>
                </label>

                {category === "inventory" && (
                  <>
                    <label className="block text-xs font-bold uppercase">
                      Existing part (optional)
                      <select value={partId} onChange={(event) => setPartId(event.target.value)} className={`${inputClass} mt-2`}>
                        <option value="">Expense only — no stock change</option>
                        {parts.map((part) => (
                          <option key={part.id} value={part.id}>{part.name} · stock {part.stock_qty}</option>
                        ))}
                      </select>
                    </label>
                    {partId && (
                      <label className="block text-xs font-bold uppercase">
                        Quantity to add
                        <input name="quantity" type="number" min="1" step="1" required defaultValue="1" className={`${inputClass} mt-2`} />
                      </label>
                    )}
                    {selectedPart && (
                      <p className="text-xs text-[#167c73]">
                        Current stock {selectedPart.stock_qty}. Total purchase amount below becomes the inventory expense.
                      </p>
                    )}
                  </>
                )}

                <label className="block text-xs font-bold uppercase">
                  Description
                  <input
                    name="description"
                    required={!partId}
                    disabled={Boolean(partId)}
                    placeholder={partId ? "Auto: stock purchase line" : undefined}
                    className={`${inputClass} mt-2`}
                  />
                </label>
                <label className="block text-xs font-bold uppercase">
                  {partId ? "Total purchase amount" : "Amount"}
                  <input name="amount" required type="number" min="0.01" step="0.01" className={`${inputClass} mt-2`} />
                </label>
                <label className="block text-xs font-bold uppercase">
                  Date
                  <input name="expense_date" required type="date" defaultValue={now.toISOString().slice(0, 10)} className={`${inputClass} mt-2`} />
                </label>
                <button className={`${buttonClass} w-full`}>
                  {partId ? "Restock & record expense" : "Record expense"}
                </button>
              </form>
            </Panel>
          </div>
        </>
      )}
    </AppShell>
  );
}
