"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import { API_URL } from "@/lib/api";
import { ProgressBar, progressPercent } from "@/components/job-progress";
import { useT } from "@/lib/locale";

type ProgressPhoto = { id: number };
type ProgressStep = { key: string; label: string; state: "done" | "current" | "upcoming"; photos: ProgressPhoto[] };
type SharedProgress = {
  current_step: string;
  complete: boolean;
  share_token: string;
  bill_number: string;
  customer_name?: string | null;
  vehicle_number?: string | null;
  business_name?: string | null;
  steps: ProgressStep[];
  labor?: Array<{ id: number; description: string }>;
};

function tokenFrom(value: string | string[] | undefined) {
  const raw = Array.isArray(value) ? value[0] : value;
  return String(raw ?? "").trim().replace(/[^a-zA-Z0-9]/g, "");
}

export default function SharedJobProgressPage() {
  const t = useT();
  const params = useParams<{ token: string }>();
  const token = tokenFrom(params.token);
  const [progress, setProgress] = useState<SharedProgress | null>(null);
  const [error, setError] = useState("");

  useEffect(() => {
    if (!token) {
      setError(t("progress.unavailable"));
      return;
    }
    let cancelled = false;
    fetch(`${API_URL}/bills/shared/${encodeURIComponent(token)}/progress`)
      .then(async (response) => {
        if (!response.ok) throw new Error(t("progress.unavailable"));
        return response.json() as Promise<SharedProgress>;
      })
      .then((data) => {
        if (!cancelled) setProgress(data);
      })
      .catch((caught: Error) => {
        if (!cancelled) setError(caught.message || t("progress.unavailable"));
      });
    return () => {
      cancelled = true;
    };
  }, [token, t]);

  function label(step: ProgressStep) {
    const translated = t(`progress.${step.key}`);
    return translated === step.key.replaceAll("_", " ") ? step.label : translated;
  }

  if (error) {
    return (
      <main className="mx-auto flex min-h-screen max-w-lg items-center px-4 py-10">
        <div className="w-full border border-[#e2ddd0] bg-white p-6 text-center">
          <p className="font-display text-2xl uppercase">{t("progress.unavailable")}</p>
        </div>
      </main>
    );
  }

  if (!progress) {
    return <main className="mx-auto max-w-lg px-4 py-10 text-sm text-[#6f746e]">{t("progress.loading")}</main>;
  }

  const current = progress.steps.find((step) => step.key === progress.current_step);

  return (
    <main className="mx-auto min-h-screen max-w-lg bg-[#f7f5ef] px-4 py-8">
      <p className="text-[10px] font-bold uppercase tracking-wide text-[#167c73]">{progress.business_name}</p>
      <h1 className="mt-1 font-display text-3xl font-semibold uppercase">
        {progress.complete ? t("progress.complete_banner") : label(current || progress.steps[0])}
      </h1>
      <p className="mt-2 text-sm text-[#6f746e]">
        {[progress.vehicle_number, progress.customer_name, progress.bill_number].filter(Boolean).join(" · ")}
      </p>
      <div className="mt-4">
        <ProgressBar percent={progressPercent(progress.steps, progress.complete)} />
      </div>
      <div className="mt-5 border border-[#e2ded4] bg-white p-4">
        <p className="text-[10px] font-bold uppercase text-[#6f746e]">{t("progress.work")}</p>
        {(progress.labor ?? []).length === 0 ? (
          <p className="mt-1 text-sm text-[#6f746e]">{t("progress.work_empty")}</p>
        ) : (
          <ul className="mt-2 space-y-1">
            {(progress.labor ?? []).map((line) => (
              <li key={line.id} className="text-sm font-semibold">{line.description}</li>
            ))}
          </ul>
        )}
      </div>
      <ol className="mt-6 space-y-3">
        {progress.steps.map((step) => (
          <li key={step.key} className="border border-[#e2ded4] bg-white p-4">
            <div className="flex items-center gap-2">
              <span className={`grid size-5 place-items-center rounded-full text-[10px] font-bold ${
                step.state === "upcoming" ? "border border-[#c9c5b9] text-[#6f746e]" : "bg-[#167c73] text-white"
              }`}>
                {step.state === "done" ? "✓" : step.state === "current" ? "•" : ""}
              </span>
              <p className="text-sm font-semibold">{label(step)}</p>
              <span className="text-[10px] font-bold uppercase text-[#6f746e]">
                {progress.complete || step.state === "done" ? t("progress.done") : step.state === "current" ? t("progress.now") : t("progress.waiting")}
              </span>
            </div>
            {step.photos.length > 0 && (
              <div className="mt-3 grid grid-cols-2 gap-2">
                {step.photos.map((photo) => (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    key={photo.id}
                    src={`${API_URL}/bills/shared/${token}/progress-photos/${photo.id}/file`}
                    alt=""
                    className="aspect-[4/3] w-full border border-[#e2ded4] bg-[#f7f5ef] object-cover"
                  />
                ))}
              </div>
            )}
          </li>
        ))}
      </ol>
    </main>
  );
}
