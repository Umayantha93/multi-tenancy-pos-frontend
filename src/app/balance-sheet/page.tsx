"use client";

import { FormEvent, useCallback, useEffect, useMemo, useState } from "react";
import { Minus, Plus, TrendingUp, X } from "lucide-react";
import { AppShell } from "@/components/app-shell";
import { buttonClass, ErrorMessage, inputClass, Panel } from "@/components/ui";
import { api, currentUser, formatDate, money } from "@/lib/api";

type AccountRow = {
  date: string;
  description: string;
  reference?: string | null;
  category: string;
  type: "income" | "expense" | "payable" | "bill";
  debit: number;
  credit: number;
  balance: number;
};

type PayableItem = {
  id: number;
  description: string;
  amount: number;
  amount_paid?: number;
  remaining?: number;
  expense_date?: string | null;
  due_date?: string | null;
  category: string;
  settlements?: Array<{ id: number; amount: number; settled_on: string | null }>;
};

type Sheet = {
  income: number;
  expenses: number;
  net_profit: number;
  expense_breakdown: Record<string, number>;
  accounts: AccountRow[];
  yearly_trend: Array<{ month: number; income: number; expenses: number; net_profit: number }>;
  period?: { month: number; year: number };
  inventory_payables?: { payables_total: number; items: PayableItem[] };
  bill_receivables?: { receivables_total: number; count: number };
};
type Part = { id: number; name: string; stock_qty: number; cost_price: string };

function roundMoney(value: number) {
  return Math.round(value * 100) / 100;
}

function entryTone(type: AccountRow["type"]) {
  if (type === "income") return "bg-[#167c73]/10 text-[#167c73]";
  if (type === "expense") return "bg-[#b84837]/10 text-[#b84837]";
  if (type === "payable") return "bg-[#b8860b]/15 text-[#735a00]";
  return "bg-[#2b6cb0]/10 text-[#2b6cb0]";
}

export default function BalanceSheetPage() {
  const now = new Date();
  const [month, setMonth] = useState(now.getMonth() + 1);
  const [year, setYear] = useState(now.getFullYear());
  const [sheet, setSheet] = useState<Sheet | null>(null);
  const [error, setError] = useState("");
  const [category, setCategory] = useState("rent");
  const [parts, setParts] = useState<Part[]>([]);
  const [partId, setPartId] = useState("");
  const [paymentStatus, setPaymentStatus] = useState("paid");
  const [settlingId, setSettlingId] = useState<number | null>(null);
  const [settleItem, setSettleItem] = useState<PayableItem | null>(null);
  const [settleAmount, setSettleAmount] = useState("");
  const [selectedDay, setSelectedDay] = useState<string | null>(null);
  const businessName = currentUser()?.tenant?.business_name ?? "Business";

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
            payment_status: formData.get("payment_status") || "paid",
            due_date: formData.get("due_date") || undefined,
          }),
        });
      } else {
        await api("/expenses", { method: "POST", body: JSON.stringify(Object.fromEntries(formData)) });
      }
      form.reset();
      setCategory("rent");
      setPartId("");
      setPaymentStatus("paid");
      load();
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Could not add expense.");
    }
  }

  const selectedPart = parts.find((part) => String(part.id) === partId);
  const max = Math.max(1, ...(sheet?.yearly_trend.flatMap((item) => [item.income, item.expenses]) ?? []));
  const monthLabel = useMemo(
    () => new Date(year, month - 1).toLocaleString("en", { month: "long", year: "numeric" }),
    [month, year],
  );
  const accounts = sheet?.accounts ?? [];
  const payables = sheet?.inventory_payables?.items ?? [];
  const dailyAccounts = useMemo(() => {
    const days = new Map<string, { date: string; debit: number; credit: number; balance: number; entries: AccountRow[] }>();
    for (const row of accounts) {
      const date = row.date;
      const current = days.get(date) ?? { date, debit: 0, credit: 0, balance: 0, entries: [] };
      current.entries.push(row);
      if (row.type === "income" || row.type === "expense") {
        current.debit += row.debit;
        current.credit += row.credit;
      }
      current.balance = row.balance;
      days.set(date, current);
    }
    return [...days.values()].map((day) => ({
      ...day,
      debit: roundMoney(day.debit),
      credit: roundMoney(day.credit),
      profit: roundMoney(day.credit - day.debit),
    }));
  }, [accounts]);
  const dayDetail = dailyAccounts.find((day) => day.date === selectedDay) ?? null;

  async function settlePayable(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!settleItem) return;
    setSettlingId(settleItem.id);
    setError("");
    try {
      await api(`/expenses/${settleItem.id}/settle`, {
        method: "POST",
        body: JSON.stringify({ amount: Number(settleAmount) }),
      });
      setSettleItem(null);
      setSettleAmount("");
      load();
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Could not settle this credit purchase.");
    } finally {
      setSettlingId(null);
    }
  }

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
                        Current stock {selectedPart.stock_qty}. Total purchase amount below becomes the inventory expense when paid now.
                      </p>
                    )}
                    <label className="block text-xs font-bold uppercase">
                      Supplier payment
                      <select
                        name="payment_status"
                        value={paymentStatus}
                        onChange={(event) => setPaymentStatus(event.target.value)}
                        className={`${inputClass} mt-2`}
                      >
                        <option value="paid">Paid now</option>
                        <option value="credit">Buy on credit</option>
                      </select>
                    </label>
                    {paymentStatus === "credit" && (
                      <label className="block text-xs font-bold uppercase">
                        Supplier due date
                        <input name="due_date" type="date" required className={`${inputClass} mt-2`} />
                      </label>
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
                  {partId ? "Restock & record purchase" : "Record expense"}
                </button>
              </form>
            </Panel>
          </div>

          {(payables.length > 0 || (sheet.bill_receivables?.count ?? 0) > 0) && (
            <div className="mt-5 grid gap-5 xl:grid-cols-2">
              <Panel className="p-5">
                <h2 className="font-display text-2xl font-semibold uppercase">Inventory on credit</h2>
                <p className="mt-1 text-sm text-[#6f746e]">
                  Outstanding {money(sheet.inventory_payables?.payables_total ?? 0)}. These do not reduce profit until you pay the supplier.
                </p>
                <div className="mt-4 divide-y divide-[#e2ded4]">
                  {payables.map((item) => {
                    const remaining = item.remaining ?? item.amount;
                    const paid = item.amount_paid ?? 0;
                    return (
                      <div key={item.id} className="py-3 text-sm">
                        <div className="flex items-center gap-3">
                          <div className="min-w-0">
                            <p className="font-semibold">{item.description}</p>
                            <p className="text-xs text-[#6f746e]">
                              Due {item.due_date ? formatDate(item.due_date) : "—"} · Paid {money(paid)} of {money(item.amount)}
                            </p>
                          </div>
                          <strong className="ml-auto tabular-nums text-[#b84837]">{money(remaining)}</strong>
                          <button
                            type="button"
                            onClick={() => {
                              setSettleItem(item);
                              setSettleAmount(String(remaining));
                            }}
                            className="border border-[#167c73] px-2 py-1 text-[10px] font-bold uppercase text-[#167c73]"
                          >
                            Settle
                          </button>
                        </div>
                      </div>
                    );
                  })}
                  {payables.length === 0 && <p className="py-4 text-sm text-[#6f746e]">No supplier credit purchases open.</p>}
                </div>
              </Panel>
              <Panel className="p-5">
                <h2 className="font-display text-2xl font-semibold uppercase">Customer owe in</h2>
                <p className="mt-1 text-sm text-[#6f746e]">
                  {sheet.bill_receivables?.count ?? 0} credit bills still collecting.
                </p>
                <p className="mt-4 font-display text-3xl font-semibold text-[#b84837]">
                  {money(sheet.bill_receivables?.receivables_total ?? 0)}
                </p>
              </Panel>
            </div>
          )}

          <Panel className="mt-5 overflow-hidden">
            <div className="border-b border-[#d7d3c8] px-5 py-4">
              <p className="text-[10px] font-bold uppercase tracking-wide text-[#167c73]">{businessName}</p>
              <h2 className="mt-1 font-display text-2xl font-semibold uppercase sm:text-3xl">
                Monthly accounts summary · {monthLabel}
              </h2>
              <p className="mt-2 text-sm text-[#6f746e]">
                Daily profit and expenses for this period. Open a day to see its credits and debits.
              </p>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full min-w-[720px] border-collapse text-left text-sm">
                <thead>
                  <tr className="text-[10px] font-bold uppercase tracking-wide">
                    <th className="border border-[#d7d3c8] bg-[#dceef2] px-3 py-3 text-[#2f4f57]">Date</th>
                    <th className="border border-[#d7d3c8] bg-[#f3dfc8] px-3 py-3 text-right text-[#6a4a28]">Debit (expenses)</th>
                    <th className="border border-[#d7d3c8] bg-[#d7ebe4] px-3 py-3 text-right text-[#1f5a52]">Credit (income)</th>
                    <th className="border border-[#d7d3c8] bg-[#e8e6df] px-3 py-3 text-right text-[#4f544e]">Daily profit</th>
                    <th className="border border-[#d7d3c8] bg-[#eeece5] px-3 py-3 text-right text-[#4f544e]">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {dailyAccounts.map((day) => (
                    <tr key={day.date} className="bg-[#fbfaf6]">
                      <td className="border border-[#e2ded4] px-3 py-2.5 whitespace-nowrap font-semibold">{formatDate(day.date)}</td>
                      <td className="border border-[#e2ded4] px-3 py-2.5 text-right tabular-nums text-[#b84837]">
                        {day.debit > 0 ? money(day.debit) : "—"}
                      </td>
                      <td className="border border-[#e2ded4] px-3 py-2.5 text-right tabular-nums text-[#167c73]">
                        {day.credit > 0 ? `+${money(day.credit)}` : "—"}
                      </td>
                      <td className={`border border-[#e2ded4] px-3 py-2.5 text-right font-semibold tabular-nums ${day.profit >= 0 ? "text-[#167c73]" : "text-[#b84837]"}`}>
                        {money(day.profit)}
                      </td>
                      <td className="border border-[#e2ded4] px-3 py-2.5 text-right">
                        <button
                          type="button"
                          onClick={() => setSelectedDay(day.date)}
                          className="text-sm font-semibold text-[#167c73]"
                        >
                          View details
                        </button>
                      </td>
                    </tr>
                  ))}
                  {dailyAccounts.length === 0 && (
                    <tr>
                      <td colSpan={5} className="border border-[#e2ded4] px-5 py-10 text-center text-sm text-[#6f746e]">
                        No income or expense entries for this month yet.
                      </td>
                    </tr>
                  )}
                </tbody>
                <tfoot>
                  <tr className="bg-[#f3f0e8] text-sm font-semibold">
                    <td className="border border-[#d7d3c8] px-3 py-4 uppercase tracking-wide text-[#4f544e]">
                      Monthly totals
                    </td>
                    <td className="border border-[#d7d3c8] px-3 py-4 text-right text-[#b84837]">
                      <span className="block text-[10px] font-bold uppercase text-[#6f746e]">Total expenses (−)</span>
                      {money(sheet.expenses)}
                    </td>
                    <td className="border border-[#d7d3c8] px-3 py-4 text-right text-[#167c73]">
                      <span className="block text-[10px] font-bold uppercase text-[#6f746e]">Total revenue (+)</span>
                      {money(sheet.income)}
                    </td>
                    <td className="border border-[#d7d3c8] px-3 py-4 text-right">
                      <span className="block text-[10px] font-bold uppercase text-[#6f746e]">Monthly profit</span>
                      <span className={sheet.net_profit >= 0 ? "text-[#167c73]" : "text-[#b84837]"}>
                        {money(sheet.net_profit)}
                      </span>
                    </td>
                    <td className="border border-[#d7d3c8] px-3 py-4" />
                  </tr>
                </tfoot>
              </table>
            </div>
          </Panel>
        </>
      )}

      {dayDetail && (
        <div className="fixed inset-0 z-[80] flex items-center justify-center p-4">
          <button type="button" aria-label="Close dialog" className="absolute inset-0 bg-[#181b19]/55" onClick={() => setSelectedDay(null)} />
          <div className="relative z-10 max-h-[90vh] w-full max-w-4xl overflow-y-auto border border-[#d7d3c8] bg-[#fbfaf6]">
            <div className="flex items-start justify-between border-b border-[#e2ded4] px-5 py-4">
              <div>
                <p className="text-[10px] font-bold uppercase tracking-wide text-[#167c73]">Daily ledger</p>
                <h2 className="mt-1 font-display text-2xl font-semibold uppercase">{formatDate(dayDetail.date)}</h2>
                <p className="mt-1 text-sm text-[#6f746e]">
                  Debit {money(dayDetail.debit)} · Credit {money(dayDetail.credit)} · Profit{" "}
                  <span className={dayDetail.profit >= 0 ? "text-[#167c73]" : "text-[#b84837]"}>{money(dayDetail.profit)}</span>
                </p>
              </div>
              <button type="button" onClick={() => setSelectedDay(null)} className="grid size-9 place-items-center border border-[#d7d3c8]" aria-label="Close">
                <X size={16} />
              </button>
            </div>
            <div className="overflow-x-auto p-5">
              <table className="w-full min-w-[720px] border-collapse text-left text-sm">
                <thead>
                  <tr className="text-[10px] font-bold uppercase tracking-wide">
                    <th className="border border-[#d7d3c8] bg-[#dceef2] px-3 py-2 text-[#2f4f57]">Description</th>
                    <th className="border border-[#d7d3c8] bg-[#dceef2] px-3 py-2 text-[#2f4f57]">Reference / Bill #</th>
                    <th className="border border-[#d7d3c8] bg-[#f3dfc8] px-3 py-2 text-[#6a4a28]">Category</th>
                    <th className="border border-[#d7d3c8] bg-[#f3dfc8] px-3 py-2 text-right text-[#6a4a28]">Debit</th>
                    <th className="border border-[#d7d3c8] bg-[#d7ebe4] px-3 py-2 text-right text-[#1f5a52]">Credit</th>
                  </tr>
                </thead>
                <tbody>
                  {dayDetail.entries.map((row, index) => (
                    <tr key={`${row.reference ?? row.description}-${index}`} className="bg-white">
                      <td className="border border-[#e2ded4] px-3 py-2.5">{row.description}</td>
                      <td className="border border-[#e2ded4] px-3 py-2.5 font-medium text-[#4f544e]">{row.reference || "—"}</td>
                      <td className="border border-[#e2ded4] px-3 py-2.5">
                        <span className={`inline-block px-2 py-0.5 text-[10px] font-bold uppercase ${entryTone(row.type)}`}>
                          {row.category}
                        </span>
                      </td>
                      <td className="border border-[#e2ded4] px-3 py-2.5 text-right tabular-nums text-[#b84837]">
                        {row.debit > 0 ? money(row.debit) : "—"}
                      </td>
                      <td className="border border-[#e2ded4] px-3 py-2.5 text-right tabular-nums text-[#167c73]">
                        {row.credit > 0 ? `+${money(row.credit)}` : "—"}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {settleItem && (
        <div className="fixed inset-0 z-[80] flex items-center justify-center p-4">
          <button type="button" aria-label="Close dialog" className="absolute inset-0 bg-[#181b19]/55" onClick={() => setSettleItem(null)} />
          <form onSubmit={settlePayable} className="relative z-10 w-full max-w-md border border-[#d7d3c8] bg-[#fbfaf6] p-5">
            <p className="text-[10px] font-bold uppercase tracking-wide text-[#167c73]">Settle supplier credit</p>
            <h2 className="mt-1 font-display text-2xl font-semibold uppercase">Pay this bill in steps</h2>
            <p className="mt-2 text-sm text-[#6f746e]">{settleItem.description}</p>
            <dl className="mt-4 space-y-2 text-sm">
              <div className="flex justify-between"><dt className="text-[#6f746e]">Original</dt><dd className="font-semibold">{money(settleItem.amount)}</dd></div>
              <div className="flex justify-between"><dt className="text-[#6f746e]">Paid so far</dt><dd className="font-semibold">{money(settleItem.amount_paid ?? 0)}</dd></div>
              <div className="flex justify-between"><dt className="text-[#6f746e]">Balance</dt><dd className="font-semibold text-[#b84837]">{money(settleItem.remaining ?? settleItem.amount)}</dd></div>
            </dl>
            {(settleItem.settlements?.length ?? 0) > 0 && (
              <div className="mt-4 border-t border-[#e2ded4] pt-3">
                <p className="text-[10px] font-bold uppercase text-[#6f746e]">Earlier payments</p>
                <ul className="mt-2 space-y-1 text-xs">
                  {settleItem.settlements?.map((row) => (
                    <li key={row.id} className="flex justify-between">
                      <span>{row.settled_on ? formatDate(row.settled_on) : "—"}</span>
                      <span>{money(row.amount)}</span>
                    </li>
                  ))}
                </ul>
              </div>
            )}
            <label className="mt-4 block text-xs font-bold uppercase">
              Amount to pay now
              <input
                value={settleAmount}
                onChange={(event) => setSettleAmount(event.target.value)}
                type="number"
                min="0.01"
                max={settleItem.remaining ?? settleItem.amount}
                step="0.01"
                required
                className={`${inputClass} mt-2`}
              />
            </label>
            <div className="mt-5 flex justify-end gap-2">
              <button type="button" onClick={() => setSettleItem(null)} className="h-11 border border-[#d7d3c8] px-4 text-sm">Cancel</button>
              <button disabled={settlingId === settleItem.id} className={buttonClass}>
                {settlingId === settleItem.id ? "Saving..." : "Record payment"}
              </button>
            </div>
          </form>
        </div>
      )}
    </AppShell>
  );
}
