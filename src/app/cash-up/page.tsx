"use client";

import { FormEvent, useCallback, useEffect, useState } from "react";
import { AppShell } from "@/components/app-shell";
import { buttonClass, ErrorMessage, inputClass, PageState, Panel, SuccessMessage } from "@/components/ui";
import { api, currentFeatures, money } from "@/lib/api";
import { ShopFilter } from "@/components/branch-chip";
import { useT } from "@/lib/locale";

const NOTE_VALUES = [5000, 2000, 1000, 500, 100, 50, 20] as const;

type Amounts = {
  expected_cash: number;
  expected_card: number;
  expected_bank: number;
  expected_cheque: number;
};

type BankPayment = {
  id: number;
  paid_at?: string | null;
  amount: string | number;
  method: string;
  reference?: string | null;
  bill_number?: string | null;
  customer_name?: string | null;
  seen: boolean;
};

type BankExtra = {
  key: string;
  amount: string;
  reference: string;
};

type CashUpPayload = {
  date: string;
  user_id: number;
  cash_takings: number;
  opening_float: number;
  cash_count?: Record<string, number> | null;
  expected: Amounts;
  bank_payments: BankPayment[];
  bank_extras: Array<{ amount: string | number; reference?: string | null; seen: boolean }>;
  cash_up: {
    counted_card: string | number;
    counted_cheque: string | number;
    notes?: string | null;
    closed_at?: string | null;
  } | null;
  cashiers: Array<{ id: number; name: string }>;
};

function qty(value: string): number {
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : 0;
}

function whole(value: string): number {
  return Math.floor(qty(value));
}

function clock(value?: string | null): string {
  if (!value) return "";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  return date.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
}

export default function CashUpPage() {
  const t = useT();
  const [sessionReady, setSessionReady] = useState(false);
  const [allowed, setAllowed] = useState(false);
  const [date, setDate] = useState(() => new Date().toISOString().slice(0, 10));
  const [userId, setUserId] = useState("");
  const [shopFilter, setShopFilter] = useState("");
  const [data, setData] = useState<CashUpPayload | null>(null);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [floatAmount, setFloatAmount] = useState("0");
  const [notes, setNotes] = useState<Record<string, string>>({});
  const [coins, setCoins] = useState("");
  const [seen, setSeen] = useState<Record<number, boolean>>({});
  const [extras, setExtras] = useState<BankExtra[]>([]);
  const [card, setCard] = useState("");
  const [cheque, setCheque] = useState("");
  const [comment, setComment] = useState("");

  useEffect(() => {
    setSessionReady(true);
    setAllowed(currentFeatures().includes("cash_up"));
  }, []);

  const load = useCallback(() => {
    if (!allowed) return;
    setLoading(true);
    setError("");
    const params = new URLSearchParams({ date });
    if (userId) params.set("user_id", userId);
    if (shopFilter) params.set("branch_id", shopFilter);
    api<CashUpPayload>(`/cash-up?${params}`)
      .then((result) => {
        setData(result);
        if (!userId) setUserId(String(result.user_id));
        const count = result.cash_count ?? {};
        setFloatAmount(String(result.opening_float ?? 0));
        setNotes(Object.fromEntries(NOTE_VALUES.map((value) => [String(value), count[String(value)] ? String(count[String(value)]) : ""])));
        setCoins(count.coins ? String(count.coins) : "");
        setSeen(Object.fromEntries(result.bank_payments.map((payment) => [payment.id, payment.seen])));
        setExtras(result.bank_extras.map((extra, index) => ({
          key: `saved-${index}`,
          amount: String(extra.amount ?? ""),
          reference: extra.reference ?? "",
        })));
        setCard(result.cash_up ? String(result.cash_up.counted_card ?? "") : "");
        setCheque(result.cash_up ? String(result.cash_up.counted_cheque ?? "") : "");
        setComment(result.cash_up?.notes ?? "");
      })
      .catch((caught) => setError(caught instanceof Error ? caught.message : t("cash_up.load_failed")))
      .finally(() => setLoading(false));
  }, [allowed, date, userId, shopFilter, t]);

  useEffect(() => {
    if (!sessionReady || !allowed) return;
    load();
  }, [sessionReady, allowed, load]);

  const countedCash = NOTE_VALUES.reduce((sum, value) => sum + value * whole(notes[String(value)] ?? ""), 0) + qty(coins);
  const expectedCash = Number(data?.cash_takings ?? 0) + qty(floatAmount);
  const countedBank = (data?.bank_payments ?? []).reduce((sum, payment) => sum + (seen[payment.id] ? Number(payment.amount) : 0), 0)
    + extras.reduce((sum, extra) => sum + qty(extra.amount), 0);
  const expectedBank = Number(data?.expected.expected_bank ?? 0);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!data) return;
    setSaving(true);
    setError("");
    setNotice("");
    const cashCount: Record<string, number> = { coins: qty(coins) };
    for (const value of NOTE_VALUES) cashCount[String(value)] = whole(notes[String(value)] ?? "");
    try {
      const result = await api<CashUpPayload>("/cash-up", {
        method: "POST",
        body: JSON.stringify({
          date,
          user_id: Number(userId) || undefined,
          opening_float: qty(floatAmount),
          cash_count: cashCount,
          bank_lines: [
            ...data.bank_payments.map((payment) => ({ payment_id: payment.id, seen: Boolean(seen[payment.id]) })),
            ...extras.filter((extra) => qty(extra.amount) > 0).map((extra) => ({
              amount: qty(extra.amount),
              reference: extra.reference || null,
              seen: true,
            })),
          ],
          counted_card: qty(card),
          counted_cheque: qty(cheque),
          notes: comment || null,
        }),
      });
      setData(result);
      setNotice(t("cash_up.saved"));
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : t("cash_up.save_failed"));
    } finally {
      setSaving(false);
    }
  }

  function diffClass(diff: number): string {
    if (diff === 0) return "";
    return diff < 0 ? "text-[#b84837]" : "text-[#167c73]";
  }

  return (
    <AppShell title={sessionReady ? t("cash_up.title") : "Cash-up"} eyebrow={sessionReady ? t("cash_up.eyebrow") : "Day end"}>
      {sessionReady && !allowed ? (
        <Panel className="p-5"><p className="text-sm text-[#6f746e]">{t("cash_up.locked")}</p></Panel>
      ) : (
        <>
          <p className="mb-5 max-w-2xl text-sm text-[#6f746e]">{t("cash_up.intro")}</p>
          <div className="mb-5 flex flex-wrap items-end gap-3">
            <ShopFilter value={shopFilter} onChange={setShopFilter} />
            <label className="text-xs font-bold uppercase">
              {t("common.date")}
              <input type="date" value={date} onChange={(event) => setDate(event.target.value)} className={`${inputClass} mt-2`} />
            </label>
            {data && data.cashiers.length > 1 && (
              <label className="text-xs font-bold uppercase">
                {t("cash_up.cashier")}
                <select value={userId} onChange={(event) => setUserId(event.target.value)} className={`${inputClass} mt-2`}>
                  {data.cashiers.map((cashier) => (
                    <option key={cashier.id} value={cashier.id}>{cashier.name}</option>
                  ))}
                </select>
              </label>
            )}
          </div>
          {error && <div className="mb-5"><ErrorMessage message={error} /></div>}
          {notice && <div className="mb-5"><SuccessMessage message={notice} /></div>}
          {!sessionReady || loading || !data ? <PageState message={t("cash_up.loading")} /> : (
            <form onSubmit={submit} className="grid gap-4">
              <Panel className="p-5">
                <label className="block max-w-xs text-xs font-bold uppercase">
                  {t("cash_up.opening_float")}
                  <input type="number" min="0" step="0.01" value={floatAmount} onChange={(event) => setFloatAmount(event.target.value)} className={`${inputClass} mt-2`} />
                </label>
                <p className="mt-2 text-xs text-[#6f746e]">{t("cash_up.float_hint")}</p>
              </Panel>

              <Panel className="overflow-hidden">
                <div className="border-b border-[#d7d3c8] px-5 py-4">
                  <h2 className="font-display text-2xl font-semibold uppercase">{t("cash_up.cash")}</h2>
                </div>
                <table className="w-full text-left text-sm">
                  <thead className="bg-[#eeece5] text-[10px] uppercase text-[#6f746e]">
                    <tr>
                      <th className="px-5 py-3">{t("cash_up.denomination")}</th>
                      <th>{t("common.qty")}</th>
                      <th className="px-5 py-3 text-right">{t("common.amount")}</th>
                    </tr>
                  </thead>
                  <tbody>
                    {NOTE_VALUES.map((value) => {
                      const count = whole(notes[String(value)] ?? "");
                      return (
                        <tr key={value} className="border-t border-[#e2ded4]">
                          <td className="px-5 py-3 font-semibold tabular-nums">{money(value)}</td>
                          <td>
                            <input
                              type="number"
                              min="0"
                              step="1"
                              value={notes[String(value)] ?? ""}
                              onChange={(event) => setNotes((current) => ({ ...current, [String(value)]: event.target.value }))}
                              className={`${inputClass} max-w-28`}
                            />
                          </td>
                          <td className="px-5 py-3 text-right tabular-nums">{money(value * count)}</td>
                        </tr>
                      );
                    })}
                    <tr className="border-t border-[#e2ded4]">
                      <td className="px-5 py-3 font-semibold">{t("cash_up.coins")}</td>
                      <td />
                      <td className="px-5 py-3 text-right">
                        <input type="number" min="0" step="0.01" value={coins} onChange={(event) => setCoins(event.target.value)} className={`${inputClass} ml-auto max-w-36`} />
                      </td>
                    </tr>
                  </tbody>
                </table>
                <div className="grid gap-2 border-t border-[#d7d3c8] px-5 py-4 text-sm sm:grid-cols-3">
                  <p><span className="text-[#6f746e]">{t("cash_up.expected")}</span> <strong className="tabular-nums">{money(expectedCash)}</strong></p>
                  <p><span className="text-[#6f746e]">{t("cash_up.counted")}</span> <strong className="tabular-nums">{money(countedCash)}</strong></p>
                  <p className={diffClass(countedCash - expectedCash)}><span className="text-[#6f746e]">{t("cash_up.difference")}</span> <strong className="tabular-nums">{money(countedCash - expectedCash)}</strong></p>
                </div>
                <p className="px-5 pb-4 text-xs text-[#6f746e]">{t("cash_up.takings")} {money(data.cash_takings)} + {t("cash_up.opening_float")} {money(qty(floatAmount))}</p>
              </Panel>

              <Panel className="overflow-hidden">
                <div className="border-b border-[#d7d3c8] px-5 py-4">
                  <h2 className="font-display text-2xl font-semibold uppercase">{t("cash_up.transfers")}</h2>
                </div>
                {data.bank_payments.length === 0 ? (
                  <p className="px-5 py-4 text-sm text-[#6f746e]">{t("cash_up.no_transfers")}</p>
                ) : (
                  <ul className="divide-y divide-[#e2ded4]">
                    {data.bank_payments.map((payment) => (
                      <li key={payment.id} className="flex flex-wrap items-center gap-3 px-5 py-3 text-sm">
                        <label className="flex min-w-40 flex-1 items-start gap-3">
                          <input
                            type="checkbox"
                            checked={Boolean(seen[payment.id])}
                            onChange={(event) => setSeen((current) => ({ ...current, [payment.id]: event.target.checked }))}
                            className="mt-1"
                          />
                          <span>
                            <strong>{payment.customer_name || payment.bill_number || t("cash_up.bank")}</strong>
                            <span className="mt-0.5 block text-xs text-[#6f746e]">
                              {[clock(payment.paid_at), payment.bill_number, payment.reference].filter(Boolean).join(" · ")}
                            </span>
                          </span>
                        </label>
                        <strong className="tabular-nums">{money(payment.amount)}</strong>
                      </li>
                    ))}
                  </ul>
                )}
                <div className="space-y-3 border-t border-[#d7d3c8] px-5 py-4">
                  <p className="text-xs font-bold uppercase">{t("cash_up.extra")}</p>
                  {extras.map((extra) => (
                    <div key={extra.key} className="flex flex-wrap items-center gap-2">
                      <input
                        type="number"
                        min="0"
                        step="0.01"
                        value={extra.amount}
                        onChange={(event) => setExtras((current) => current.map((row) => row.key === extra.key ? { ...row, amount: event.target.value } : row))}
                        placeholder={t("common.amount")}
                        className={`${inputClass} w-32`}
                      />
                      <input
                        value={extra.reference}
                        onChange={(event) => setExtras((current) => current.map((row) => row.key === extra.key ? { ...row, reference: event.target.value } : row))}
                        placeholder={t("bill.reference")}
                        className={`${inputClass} min-w-40 flex-1`}
                      />
                      <button type="button" onClick={() => setExtras((current) => current.filter((row) => row.key !== extra.key))} className="text-xs font-bold uppercase text-[#b84837]">
                        {t("cash_up.remove")}
                      </button>
                    </div>
                  ))}
                  <button
                    type="button"
                    onClick={() => setExtras((current) => [...current, { key: `new-${Date.now()}`, amount: "", reference: "" }])}
                    className="text-xs font-bold uppercase text-[#167c73]"
                  >
                    {t("cash_up.add_extra")}
                  </button>
                </div>
                <div className="grid gap-2 border-t border-[#d7d3c8] px-5 py-4 text-sm sm:grid-cols-3">
                  <p><span className="text-[#6f746e]">{t("cash_up.expected")}</span> <strong className="tabular-nums">{money(expectedBank)}</strong></p>
                  <p><span className="text-[#6f746e]">{t("cash_up.counted")}</span> <strong className="tabular-nums">{money(countedBank)}</strong></p>
                  <p className={diffClass(countedBank - expectedBank)}><span className="text-[#6f746e]">{t("cash_up.difference")}</span> <strong className="tabular-nums">{money(countedBank - expectedBank)}</strong></p>
                </div>
              </Panel>

              <Panel className="overflow-hidden">
                <table className="w-full text-left text-sm">
                  <thead className="bg-[#eeece5] text-[10px] uppercase text-[#6f746e]">
                    <tr>
                      <th className="px-5 py-3">{t("cash_up.channel")}</th>
                      <th>{t("cash_up.expected")}</th>
                      <th>{t("cash_up.counted")}</th>
                      <th className="px-5 py-3">{t("cash_up.difference")}</th>
                    </tr>
                  </thead>
                  <tbody>
                    {(["card", "cheque"] as const).map((channel) => {
                      const expected = Number(data.expected[channel === "card" ? "expected_card" : "expected_cheque"] ?? 0);
                      const counted = qty(channel === "card" ? card : cheque);
                      const diff = counted - expected;
                      return (
                        <tr key={channel} className="border-t border-[#e2ded4]">
                          <td className="px-5 py-3 font-semibold uppercase">{t(`cash_up.${channel}`)}</td>
                          <td className="tabular-nums">{money(expected)}</td>
                          <td>
                            <input
                              type="number"
                              min="0"
                              step="0.01"
                              value={channel === "card" ? card : cheque}
                              onChange={(event) => (channel === "card" ? setCard : setCheque)(event.target.value)}
                              className={`${inputClass} max-w-36`}
                            />
                          </td>
                          <td className={`px-5 py-3 tabular-nums ${diffClass(diff)}`}>{money(diff)}</td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </Panel>

              <Panel className="p-5">
                <label className="text-xs font-bold uppercase">
                  {t("cash_up.notes")}
                  <input value={comment} onChange={(event) => setComment(event.target.value)} className={`${inputClass} mt-2`} />
                </label>
                {data.cash_up?.closed_at && (
                  <p className="mt-3 text-xs text-[#6f746e]">{t("cash_up.closed_at")}: {data.cash_up.closed_at}</p>
                )}
                <div className="mt-4">
                  <button disabled={saving} className={buttonClass}>{saving ? t("common.saving") : t("cash_up.save")}</button>
                </div>
              </Panel>
            </form>
          )}
        </>
      )}
    </AppShell>
  );
}
