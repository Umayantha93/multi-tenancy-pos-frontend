"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { AppShell } from "@/components/app-shell";
import { ErrorMessage, inputClass, PageState, Panel } from "@/components/ui";
import { api, money } from "@/lib/api";
import { useT } from "@/lib/locale";

type CommissionJob = {
  bill_id: number;
  bill_number: string;
  amount: number | string;
  deducted: boolean;
  lines: string[];
};

type CommissionPerson = {
  id: number;
  name: string;
  commission_percent?: number | string | null;
  might_receive: number | string;
  deducted: number | string;
  pending: number | string;
  jobs: CommissionJob[];
};

type Board = {
  date: string;
  might_total: number | string;
  employees: CommissionPerson[];
};

export default function CommissionsPage() {
  const t = useT();
  const [date, setDate] = useState(new Date().toISOString().slice(0, 10));
  const [board, setBoard] = useState<Board | null>(null);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);

  const load = useCallback(() => {
    setLoading(true);
    api<Board>(`/commissions/day?date=${date}`)
      .then((result) => {
        setBoard(result);
        setError("");
      })
      .catch((caught) => setError(caught instanceof Error ? caught.message : t("commission_board.load_failed")))
      .finally(() => setLoading(false));
  }, [date, t]);

  useEffect(() => { load(); }, [load]);

  return (
    <AppShell title={t("commission_board.title")} eyebrow={t("commission_board.eyebrow")}>
      <div className="mb-5 flex flex-wrap items-end justify-between gap-3">
        <p className="max-w-xl text-sm text-[#6f746e]">{t("commission_board.intro")}</p>
        <label className="text-xs font-bold uppercase">
          {t("common.date")}
          <input type="date" value={date} onChange={(event) => setDate(event.target.value)} className={`${inputClass} mt-2 w-40`} />
        </label>
      </div>
      {error && <div className="mb-5"><ErrorMessage message={error} /></div>}
      <Panel className="mb-5 p-4">
        <p className="text-xs font-bold uppercase text-[#6f746e]">{t("commission_board.might_receive")}</p>
        <p className="mt-1 font-display text-3xl font-semibold">{money(board?.might_total || 0)}</p>
      </Panel>
      {loading && !board ? (
        <PageState message={t("commission_board.loading")} />
      ) : (board?.employees.length ?? 0) === 0 ? (
        <Panel className="p-5 text-sm text-[#6f746e]">{t("commission_board.empty")}</Panel>
      ) : (
        <div className="grid gap-3">
          {board?.employees.map((employee) => (
            <Panel key={employee.id} className="p-4">
              <div className="flex flex-wrap items-end justify-between gap-3">
                <div>
                  <h2 className="font-display text-2xl font-semibold uppercase">{employee.name}</h2>
                  <p className="text-xs font-semibold uppercase text-[#6f746e]">
                    {t("commission_board.percent", { percent: Number(employee.commission_percent || 0) })}
                  </p>
                </div>
                <div className="text-right">
                  <p className="text-[10px] font-bold uppercase text-[#6f746e]">{t("commission_board.might_receive")}</p>
                  <p className="font-display text-2xl font-semibold">{money(employee.might_receive)}</p>
                  <p className="text-xs text-[#6f746e]">
                    {Number(employee.deducted) > 0 ? `${t("commission_board.deducted")} ${money(employee.deducted)}` : t("commission_board.still_on_card")}
                    {Number(employee.deducted) > 0 && Number(employee.pending) > 0 ? ` · ${t("commission_board.still_on_card")} ${money(employee.pending)}` : ""}
                  </p>
                </div>
              </div>
              <ul className="mt-3 divide-y divide-[#e2ded4] border-t border-[#e2ded4]">
                {employee.jobs.map((job) => (
                  <li key={job.bill_id} className="flex flex-wrap items-start justify-between gap-3 py-2 text-sm">
                    <div>
                      <Link href={`/bills/${job.bill_id}`} className="font-semibold text-[#167c73]">{job.bill_number}</Link>
                      <p className="text-[#6f746e]">{job.lines.join(", ")}</p>
                    </div>
                    <div className="text-right">
                      <p className="font-semibold tabular-nums">{money(job.amount)}</p>
                      <p className="text-[10px] font-bold uppercase text-[#6f746e]">
                        {job.deducted ? t("commission_board.deducted") : t("commission_board.still_on_card")}
                      </p>
                    </div>
                  </li>
                ))}
              </ul>
            </Panel>
          ))}
        </div>
      )}
    </AppShell>
  );
}
