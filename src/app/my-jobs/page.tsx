"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { ArrowRight } from "lucide-react";
import { AppShell } from "@/components/app-shell";
import { ErrorMessage, PageState, Panel } from "@/components/ui";
import { api, currentUser, formatDate, money } from "@/lib/api";
import { billStatusClass, billStatusLabel } from "@/lib/bill-stamp";
import { useBusinessProfile } from "@/lib/use-business-profile";

type Job = {
  id: number;
  bill_number: string;
  admission_date: string;
  status: string;
  balance_due: string;
  customer?: { name: string } | null;
  vehicle?: { number_plate: string } | null;
  notes?: string | null;
};

export default function MyJobsPage() {
  const profile = useBusinessProfile();
  const [jobs, setJobs] = useState<Job[]>([]);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);
  const linked = Boolean(currentUser()?.employee_id);

  useEffect(() => {
    if (!currentUser()?.employee_id) {
      setLoading(false);
      return;
    }
    api<{ data: Job[] }>("/bills?assigned_to_me=1&open_only=1&per_page=50")
      .then((result) => setJobs(result.data))
      .catch((caught) => setError(caught.message))
      .finally(() => setLoading(false));
  }, []);

  return (
    <AppShell title="My jobs" eyebrow="Assigned to you">
      {error && <ErrorMessage message={error} />}
      {!linked ? (
        <PageState message="This login is not linked to a team member. Ask the owner to attach your employee record." />
      ) : loading ? (
        <PageState message="Loading your jobs..." />
      ) : jobs.length === 0 ? (
        <PageState message="No open jobs assigned to you." />
      ) : (
        <div className="grid gap-3 md:hidden">
          {jobs.map((job) => (
            <Link key={job.id} href={`/bills/${job.id}`}>
              <Panel className="p-4">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <p className="font-semibold">{job.bill_number}</p>
                    <p className="text-sm text-[#6f746e]">{job.customer?.name ?? "Walk-in"} · {job.vehicle?.number_plate ?? job.notes ?? profile.billingSingular}</p>
                    <p className="mt-1 text-xs text-[#6f746e]">{formatDate(job.admission_date)}</p>
                  </div>
                  <span className={`px-2 py-1 text-[10px] font-bold uppercase ${billStatusClass(job.status)}`}>{billStatusLabel(job.status)}</span>
                </div>
                <p className="mt-3 text-right font-semibold">{money(job.balance_due)}</p>
              </Panel>
            </Link>
          ))}
        </div>
      )}
      {!loading && linked && jobs.length > 0 && (
        <Panel className="hidden md:block">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead className="bg-[#eeece5] text-[10px] uppercase text-[#6f746e]">
                <tr>
                  <th className="px-5 py-3">Ref</th>
                  <th>Customer</th>
                  <th>Detail</th>
                  <th>Status</th>
                  <th className="pr-5 text-right">Due</th>
                  <th />
                </tr>
              </thead>
              <tbody>
                {jobs.map((job) => (
                  <tr key={job.id} className="border-t border-[#e2ded4]">
                    <td className="px-5 py-4 font-semibold">{job.bill_number}</td>
                    <td>{job.customer?.name ?? "Walk-in"}</td>
                    <td>{job.vehicle?.number_plate ?? job.notes ?? "—"}</td>
                    <td><span className={`px-2 py-1 text-[10px] font-bold uppercase ${billStatusClass(job.status)}`}>{billStatusLabel(job.status)}</span></td>
                    <td className="pr-5 text-right font-semibold">{money(job.balance_due)}</td>
                    <td>
                      <Link href={`/bills/${job.id}`} className="text-[#167c73]" aria-label={`Open ${job.bill_number}`}><ArrowRight size={18} /></Link>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Panel>
      )}
    </AppShell>
  );
}
