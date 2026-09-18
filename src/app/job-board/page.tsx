"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { AppShell } from "@/components/app-shell";
import { ErrorMessage, inputClass, PageState, Panel } from "@/components/ui";
import { api, currentFeatures } from "@/lib/api";
import { useT } from "@/lib/locale";

const COLUMNS = ["waiting", "diagnosis", "waiting_parts", "in_progress", "qc", "ready"] as const;

type Job = {
  id: number;
  bill_number: string;
  floor_status?: string | null;
  notes?: string | null;
  customer?: { name: string } | null;
  vehicle?: { number_plate: string } | null;
  employees?: Array<{ id: number; name: string }>;
};
type Technician = { id: number; name: string };
type Board = { columns: Record<string, Job[]>; technicians: Technician[] };

export default function JobBoardPage() {
  const t = useT();
  const [sessionReady, setSessionReady] = useState(false);
  const [allowed, setAllowed] = useState(false);
  const [board, setBoard] = useState<Board | null>(null);
  const [employeeId, setEmployeeId] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);
  const [moving, setMoving] = useState<number | null>(null);

  const load = useCallback(() => {
    if (!allowed) return;
    setLoading(true);
    setError("");
    const query = employeeId ? `?employee_id=${employeeId}` : "";
    api<Board>(`/job-board${query}`)
      .then(setBoard)
      .catch((caught) => setError(caught instanceof Error ? caught.message : t("job_board.load_failed")))
      .finally(() => setLoading(false));
  }, [allowed, employeeId, t]);

  useEffect(() => {
    setAllowed(currentFeatures().includes("job_board"));
    setSessionReady(true);
  }, []);

  useEffect(() => { load(); }, [load]);

  async function move(job: Job, floor_status: string) {
    if (floor_status === (job.floor_status || "waiting")) return;
    setMoving(job.id);
    setError("");
    try {
      await api(`/bills/${job.id}/floor-status`, { method: "PUT", body: JSON.stringify({ floor_status }) });
      load();
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : t("job_board.move_failed"));
    } finally {
      setMoving(null);
    }
  }

  return (
    <AppShell
      title={t("job_board.title")}
      eyebrow={t("job_board.eyebrow")}
      action={sessionReady && allowed ? (
        <select value={employeeId} onChange={(event) => setEmployeeId(event.target.value)} className={inputClass}>
          <option value="">{t("job_board.all_techs")}</option>
          {(board?.technicians ?? []).map((tech) => <option key={tech.id} value={tech.id}>{tech.name}</option>)}
        </select>
      ) : undefined}
    >
      {!sessionReady ? <PageState message={t("job_board.loading")} /> : !allowed ? (
        <PageState message={t("job_board.locked")} />
      ) : (
      <>
      <p className="mb-5 max-w-2xl text-sm text-[#6f746e]">{t("job_board.intro")}</p>
      {error && <ErrorMessage message={error} />}
      {loading && !board ? <PageState message={t("job_board.loading")} /> : (
        <div className="flex gap-3 overflow-x-auto pb-4">
          {COLUMNS.map((column) => (
            <Panel key={column} className="w-64 shrink-0">
              <div className="border-b border-[#d7d3c8] px-3 py-3">
                <p className="text-[10px] font-bold uppercase text-[#6f746e]">{t(`job_board.${column}`)}</p>
                <p className="font-display text-xl font-semibold">{board?.columns[column]?.length ?? 0}</p>
              </div>
              <div className="space-y-2 p-2">
                {(board?.columns[column] ?? []).map((job) => (
                  <div key={job.id} className="border border-[#e2ded4] bg-white p-3">
                    <Link href={`/bills/${job.id}`} className="font-semibold hover:text-[#167c73]">{job.bill_number}</Link>
                    <p className="text-sm text-[#6f746e]">{job.vehicle?.number_plate ?? job.notes ?? "—"}</p>
                    <p className="text-xs text-[#6f746e]">{job.customer?.name ?? t("common.walk_in")}</p>
                    {job.employees && job.employees.length > 0 && (
                      <p className="mt-1 text-[11px] text-[#167c73]">{job.employees.map((row) => row.name).join(", ")}</p>
                    )}
                    <select
                      value={job.floor_status || "waiting"}
                      disabled={moving === job.id}
                      onChange={(event) => move(job, event.target.value)}
                      className={`${inputClass} mt-2 text-xs`}
                    >
                      {COLUMNS.map((status) => (
                        <option key={status} value={status}>{t(`job_board.${status}`)}</option>
                      ))}
                    </select>
                  </div>
                ))}
                {(board?.columns[column] ?? []).length === 0 && (
                  <p className="px-2 py-6 text-center text-xs text-[#6f746e]">{t("job_board.empty")}</p>
                )}
              </div>
            </Panel>
          ))}
        </div>
      )}
      </>
      )}
    </AppShell>
  );
}
