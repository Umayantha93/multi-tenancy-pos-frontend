"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { AppShell } from "@/components/app-shell";
import { ErrorMessage, inputClass, PageState, Panel } from "@/components/ui";
import { api, formatDate, money, SessionPayload, storeSession } from "@/lib/api";
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

type MonthRow = {
  id: number;
  name: string;
  position?: string | null;
  salary: number | string;
  salary_ready?: boolean;
  repair_counted: number | string;
  service_counted: number | string;
  labor_pool: number | string;
  excess: number | string;
  commission: number | string;
  has_commission: boolean;
  job_count: number;
};

type MonthReport = {
  type: string;
  year: number;
  month: number;
  rules: {
    excess_percent: number;
    service_share_percent: number;
    repair_share_percent: number;
  };
  commission_total: number | string;
  employees: MonthRow[];
};

type DayLine = {
  description: string;
  section: string;
  labor_amount: number | string;
  share_percent: number;
  counted: number | string;
};

type DayJob = {
  bill_id: number;
  bill_number: string;
  number_plate?: string | null;
  job_kind?: string | null;
  team: string[];
  counted: number | string;
  lines: DayLine[];
};

type DayGroup = {
  date: string;
  labor_pool: number | string;
  jobs: DayJob[];
};

type DayReport = MonthRow & {
  days: DayGroup[];
};

function currentMonth() {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
}

export default function CommissionsPage() {
  const t = useT();
  const [scheme, setScheme] = useState<string | null>(null);

  useEffect(() => {
    api<SessionPayload>("/user")
      .then((result) => {
        const token = localStorage.getItem("garage_token");
        if (token) {
          storeSession(token, result.user, result.features, {
            branches: result.branches,
            active_branch: result.active_branch,
          });
        }
        setScheme(result.user.tenant?.commission_type || "labor_excess");
      })
      .catch(() => setScheme("labor_excess"));
  }, []);

  if (!scheme) {
    return (
      <AppShell title={t("commission_board.title")} eyebrow={t("commission_board.month_eyebrow")}>
        <PageState message={t("commission_board.loading")} />
      </AppShell>
    );
  }

  if (scheme === "line_percent") return <LinePercentBoard />;
  return <LaborExcessBoard />;
}

function LaborExcessBoard() {
  const t = useT();
  const [month, setMonth] = useState(currentMonth);
  const [report, setReport] = useState<MonthReport | null>(null);
  const [selected, setSelected] = useState<MonthRow | null>(null);
  const [days, setDays] = useState<DayReport | null>(null);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);
  const [loadingDays, setLoadingDays] = useState(false);

  const load = useCallback(() => {
    setLoading(true);
    setSelected(null);
    setDays(null);
    api<MonthReport>(`/commissions/month?month=${month}`)
      .then((result) => {
        setReport(result);
        setError("");
      })
      .catch((caught) => setError(caught instanceof Error ? caught.message : t("commission_board.load_failed")))
      .finally(() => setLoading(false));
  }, [month, t]);

  useEffect(() => { load(); }, [load]);

  const openDays = (row: MonthRow) => {
    setSelected(row);
    setDays(null);
    setLoadingDays(true);
    api<DayReport>(`/commissions/month/${row.id}?month=${month}`)
      .then((result) => {
        setDays(result);
        setError("");
      })
      .catch((caught) => setError(caught instanceof Error ? caught.message : t("commission_board.load_failed")))
      .finally(() => setLoadingDays(false));
  };

  const rules = report?.rules ?? { excess_percent: 10, service_share_percent: 50, repair_share_percent: 100 };
  const person = days ?? selected;

  return (
    <AppShell title={t("commission_board.title")} eyebrow={t("commission_board.month_eyebrow")}>
      <div className="mb-5 flex flex-wrap items-end justify-between gap-3">
        <p className="max-w-3xl text-sm text-[#6f746e]">{t("commission_board.month_intro")}</p>
        <label className="text-xs font-bold uppercase">
          {t("commission_board.month")}
          <input type="month" value={month} onChange={(event) => setMonth(event.target.value)} className={`${inputClass} mt-2 w-44`} />
        </label>
      </div>
      {error && <div className="mb-5"><ErrorMessage message={error} /></div>}
      {selected ? (
        <div>
          <button type="button" onClick={() => { setSelected(null); setDays(null); }} className="mb-4 text-xs font-bold uppercase text-[#167c73]">
            {t("commission_board.back_to_month")}
          </button>
          <Panel className="mb-4 p-4">
            <h2 className="font-display text-2xl font-semibold uppercase">{person?.name}</h2>
            {person?.position && <p className="text-xs font-semibold uppercase text-[#6f746e]">{person.position}</p>}
            <p className="mt-2 max-w-2xl text-sm text-[#6f746e]">{t("commission_board.days_intro")}</p>
            <dl className="mt-4 grid gap-3 sm:grid-cols-4">
              <div>
                <dt className="text-[10px] font-bold uppercase text-[#6f746e]">{t("commission_board.salary")}</dt>
                <dd className="font-display text-xl font-semibold">{person?.salary_ready === false ? t("commission_board.enter_attendance") : money(person?.salary || 0)}</dd>
              </div>
              <div>
                <dt className="text-[10px] font-bold uppercase text-[#6f746e]">{t("commission_board.labor_counted")}</dt>
                <dd className="font-display text-xl font-semibold">{money(person?.labor_pool || 0)}</dd>
              </div>
              <div>
                <dt className="text-[10px] font-bold uppercase text-[#6f746e]">{t("commission_board.above_salary")}</dt>
                <dd className="font-display text-xl font-semibold">{money(person?.excess || 0)}</dd>
              </div>
              <div>
                <dt className="text-[10px] font-bold uppercase text-[#6f746e]">{t("commission_board.monthly_commission")}</dt>
                <dd className="font-display text-xl font-semibold">
                  {person?.has_commission ? money(person.commission) : t("commission_board.no_commission")}
                </dd>
              </div>
            </dl>
          </Panel>
          {loadingDays && !days ? (
            <PageState message={t("commission_board.loading")} />
          ) : (days?.days.length ?? 0) === 0 ? (
            <Panel className="p-5 text-sm text-[#6f746e]">{t("commission_board.days_empty")}</Panel>
          ) : (
            <div className="grid gap-3">
              {days?.days.map((day) => (
                <Panel key={day.date} className="p-4">
                  <div className="flex flex-wrap items-end justify-between gap-2">
                    <h3 className="font-display text-xl font-semibold">{formatDate(day.date)}</h3>
                    <p className="text-sm font-semibold tabular-nums">{money(day.labor_pool)}</p>
                  </div>
                  <ul className="mt-3 divide-y divide-[#e2ded4] border-t border-[#e2ded4]">
                    {day.jobs.map((job) => (
                      <li key={job.bill_id} className="py-3 text-sm">
                        <div className="flex flex-wrap items-start justify-between gap-3">
                          <div>
                            <Link href={`/bills/${job.bill_id}`} className="font-semibold text-[#167c73]">{job.bill_number}</Link>
                            <p className="text-xs text-[#6f746e]">
                              {[job.number_plate, job.job_kind].filter(Boolean).join(" · ")}
                            </p>
                            <p className="mt-1 text-xs">
                              <span className="font-bold uppercase text-[#6f746e]">{t("commission_board.team")}</span>
                              {" "}{job.team.join(", ")}
                            </p>
                          </div>
                          <p className="font-semibold tabular-nums">{money(job.counted)}</p>
                        </div>
                        <ul className="mt-2 space-y-1">
                          {job.lines.map((line, index) => (
                            <li key={`${job.bill_id}-${index}`} className="flex flex-wrap justify-between gap-2 text-xs text-[#6f746e]">
                              <span>{line.description}</span>
                              <span className="tabular-nums">
                                {money(line.labor_amount)} · {line.share_percent}% · {money(line.counted)}
                              </span>
                            </li>
                          ))}
                        </ul>
                      </li>
                    ))}
                  </ul>
                </Panel>
              ))}
            </div>
          )}
        </div>
      ) : (
        <>
          <Panel className="mb-5 p-4">
            <p className="text-xs font-bold uppercase text-[#6f746e]">{t("commission_board.commission_to_pay")}</p>
            <p className="mt-1 font-display text-3xl font-semibold">{money(report?.commission_total || 0)}</p>
          </Panel>
          {loading && !report ? (
            <PageState message={t("commission_board.loading")} />
          ) : (report?.employees.length ?? 0) === 0 ? (
            <Panel className="p-5 text-sm text-[#6f746e]">{t("commission_board.month_empty")}</Panel>
          ) : (
            <Panel className="overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full min-w-[980px] text-left text-sm">
                  <thead className="bg-[#242723] text-[10px] uppercase text-white/60">
                    <tr>
                      <th className="px-5 py-3">{t("commission_board.team_member")}</th>
                      <th>{t("commission_board.salary")}</th>
                      <th>{t("commission_board.repair_counted", { percent: rules.repair_share_percent })}</th>
                      <th>{t("commission_board.service_counted", { percent: rules.service_share_percent })}</th>
                      <th>{t("commission_board.labor_counted")}</th>
                      <th>{t("commission_board.above_salary")}</th>
                      <th>{t("commission_board.paid_jobs")}</th>
                      <th className="pr-5 text-right">{t("commission_board.monthly_commission")}</th>
                      <th />
                    </tr>
                  </thead>
                  <tbody>
                    {report?.employees.map((row) => (
                      <tr key={row.id} className="border-t border-[#e2ded4]">
                        <td className="px-5 py-4 font-semibold">
                          {row.name}
                          {row.position && <p className="text-xs font-normal text-[#6f746e]">{row.position}</p>}
                        </td>
                        <td className="tabular-nums">{row.salary_ready === false ? t("commission_board.enter_attendance") : money(row.salary)}</td>
                        <td className="tabular-nums">{money(row.repair_counted)}</td>
                        <td className="tabular-nums">{money(row.service_counted)}</td>
                        <td className="tabular-nums">{money(row.labor_pool)}</td>
                        <td className="tabular-nums">{money(row.excess)}</td>
                        <td>{row.job_count}</td>
                        <td className="pr-5 text-right font-semibold">
                          {row.has_commission ? money(row.commission) : t("commission_board.no_commission")}
                        </td>
                        <td className="pr-4 text-right">
                          <button type="button" onClick={() => openDays(row)} className="text-xs font-bold uppercase text-[#167c73]">
                            {t("commission_board.daily_jobs")}
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </Panel>
          )}
        </>
      )}
    </AppShell>
  );
}

function LinePercentBoard() {
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
