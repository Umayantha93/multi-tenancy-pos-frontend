"use client";

import { FormEvent, useCallback, useEffect, useState } from "react";
import { AppShell } from "@/components/app-shell";
import { buttonClass, ErrorMessage, inputClass, PageState, Panel, SuccessMessage } from "@/components/ui";
import { api, currentFeatures, money } from "@/lib/api";
import { ShopFilter } from "@/components/branch-chip";
import { useT } from "@/lib/locale";

type Amounts = {
  expected_cash: number;
  expected_card: number;
  expected_bank: number;
  expected_cheque: number;
};

type CashUpPayload = {
  date: string;
  user_id: number;
  expected: Amounts;
  cash_up: {
    counted_cash: string | number;
    counted_card: string | number;
    counted_bank: string | number;
    counted_cheque: string | number;
    notes?: string | null;
    closed_at?: string | null;
  } | null;
  difference: { cash: number; card: number; bank: number; cheque: number } | null;
  cashiers: Array<{ id: number; name: string }>;
};

const CHANNELS = [
  ["cash", "expected_cash", "counted_cash"],
  ["card", "expected_card", "counted_card"],
  ["bank", "expected_bank", "counted_bank"],
  ["cheque", "expected_cheque", "counted_cheque"],
] as const;

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
      })
      .catch((caught) => setError(caught instanceof Error ? caught.message : t("cash_up.load_failed")))
      .finally(() => setLoading(false));
  }, [allowed, date, userId, shopFilter, t]);

  useEffect(() => {
    if (!sessionReady || !allowed) return;
    load();
  }, [sessionReady, allowed, load]);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSaving(true);
    setError("");
    setNotice("");
    const form = Object.fromEntries(new FormData(event.currentTarget).entries());
    try {
      const result = await api<CashUpPayload>("/cash-up", {
        method: "POST",
        body: JSON.stringify({
          date,
          user_id: Number(userId || form.user_id || 0) || undefined,
          counted_cash: Number(form.counted_cash || 0),
          counted_card: Number(form.counted_card || 0),
          counted_bank: Number(form.counted_bank || 0),
          counted_cheque: Number(form.counted_cheque || 0),
          notes: form.notes || null,
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
            <Panel className="p-5">
              <form onSubmit={submit} className="grid gap-4">
                <div className="overflow-x-auto">
                  <table className="w-full min-w-[520px] text-left text-sm">
                    <thead className="bg-[#eeece5] text-[10px] uppercase text-[#6f746e]">
                      <tr>
                        <th className="px-4 py-3">{t("cash_up.channel")}</th>
                        <th>{t("cash_up.expected")}</th>
                        <th>{t("cash_up.counted")}</th>
                        <th>{t("cash_up.difference")}</th>
                      </tr>
                    </thead>
                    <tbody>
                      {CHANNELS.map(([label, expectedKey, countedKey]) => {
                        const expected = Number(data.expected[expectedKey] ?? 0);
                        const counted = data.cash_up ? Number(data.cash_up[countedKey]) : expected;
                        const diff = counted - expected;
                        return (
                          <tr key={label} className="border-t border-[#e2ded4]">
                            <td className="px-4 py-3 font-semibold uppercase">{t(`cash_up.${label}`)}</td>
                            <td>{money(expected)}</td>
                            <td>
                              <input
                                name={countedKey}
                                type="number"
                                min="0"
                                step="0.01"
                                defaultValue={counted}
                                key={`${data.date}-${data.user_id}-${countedKey}-${data.cash_up?.closed_at || "open"}`}
                                className={`${inputClass} max-w-36`}
                              />
                            </td>
                            <td className={diff === 0 ? "" : diff < 0 ? "text-[#b84837]" : "text-[#167c73]"}>
                              {money(diff)}
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
                <label className="text-xs font-bold uppercase">
                  {t("cash_up.notes")}
                  <input name="notes" defaultValue={data.cash_up?.notes ?? ""} className={`${inputClass} mt-2`} />
                </label>
                {data.cash_up?.closed_at && (
                  <p className="text-xs text-[#6f746e]">{t("cash_up.closed_at")}: {data.cash_up.closed_at}</p>
                )}
                <div>
                  <button disabled={saving} className={buttonClass}>{saving ? t("common.saving") : t("cash_up.save")}</button>
                </div>
              </form>
            </Panel>
          )}
        </>
      )}
    </AppShell>
  );
}
