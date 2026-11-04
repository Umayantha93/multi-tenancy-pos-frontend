"use client";

import { useCallback, useEffect, useState } from "react";
import { MessageCircle } from "lucide-react";
import { API_URL, api } from "@/lib/api";
import { useT } from "@/lib/locale";
import { whatsappHref } from "@/lib/whatsapp";
import { compressPhoto } from "@/components/job-photos";

type ProgressPhoto = { id: number; original_name?: string | null; size_bytes: number };
type ProgressStep = { key: string; label: string; state: "done" | "current" | "upcoming"; photos: ProgressPhoto[] };
type ProgressLabor = { id: number; description: string };

export function progressPercent(steps: Array<{ state: string }>, complete: boolean): number {
  if (complete || steps.length === 0) return complete ? 100 : 0;
  const index = steps.findIndex((step) => step.state === "current");
  const at = index < 0 ? 0 : index;
  return Math.round(((at + 1) / steps.length) * 100);
}

export function ProgressBar({ percent }: { percent: number }) {
  const t = useT();
  const width = Math.max(0, Math.min(100, percent));
  return (
    <div>
      <div className="mb-1 flex items-center justify-between text-[11px] font-bold uppercase">
        <span className="text-[#6f746e]">{t("progress.bar")}</span>
        <span>{width}%</span>
      </div>
      <div className="h-2 overflow-hidden bg-[#e2ded4]" role="progressbar" aria-valuenow={width} aria-valuemin={0} aria-valuemax={100}>
        <div className="h-full bg-[#167c73]" style={{ width: `${width}%` }} />
      </div>
    </div>
  );
}
type Progress = {
  current_step: string;
  complete: boolean;
  share_token: string;
  steps: ProgressStep[];
  labor?: ProgressLabor[];
};

export function JobProgress({
  billId,
  readOnly,
  customerName,
  customerPhone,
  vehicleNumber,
  shopName,
  workRevision = "",
}: {
  billId: number;
  readOnly: boolean;
  customerName?: string | null;
  customerPhone?: string | null;
  vehicleNumber?: string | null;
  shopName?: string | null;
  workRevision?: string;
}) {
  const t = useT();
  const [progress, setProgress] = useState<Progress | null>(null);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [view, setView] = useState<{ id: number; url: string } | null>(null);

  const load = useCallback(() => {
    api<Progress>(`/bills/${billId}/progress`)
      .then(setProgress)
      .catch((caught) => setError(caught instanceof Error ? caught.message : t("progress.load_failed")));
  }, [billId, t, workRevision]);

  useEffect(() => { load(); }, [load]);

  function label(step: ProgressStep) {
    const translated = t(`progress.${step.key}`);
    return translated === step.key.replaceAll("_", " ") ? step.label : translated;
  }

  async function choose(step: string) {
    if (readOnly || progress?.current_step === step) return;
    setBusy(true);
    setError("");
    try {
      setProgress(await api<Progress>(`/bills/${billId}/progress`, {
        method: "PUT",
        body: JSON.stringify({ step }),
      }));
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : t("progress.save_failed"));
    } finally {
      setBusy(false);
    }
  }

  async function upload(step: string, file: File) {
    setBusy(true);
    setError("");
    try {
      const prepared = await compressPhoto(file);
      const body = new FormData();
      body.set("step", step);
      body.set("photo", prepared);
      setProgress(await api<Progress>(`/bills/${billId}/progress/photos`, { method: "POST", body }));
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : t("progress.photo_failed"));
    } finally {
      setBusy(false);
    }
  }

  async function remove(id: number) {
    setBusy(true);
    setError("");
    try {
      setProgress(await api<Progress>(`/bills/${billId}/progress/photos/${id}`, { method: "DELETE" }));
      if (view?.id === id) {
        URL.revokeObjectURL(view.url);
        setView(null);
      }
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : t("progress.photo_failed"));
    } finally {
      setBusy(false);
    }
  }

  async function openPhoto(photo: ProgressPhoto) {
    if (!progress?.share_token) return;
    const response = await fetch(`${API_URL}/bills/shared/${progress.share_token}/progress-photos/${photo.id}/file`);
    if (!response.ok) {
      setError(t("progress.photo_failed"));
      return;
    }
    if (view?.url) URL.revokeObjectURL(view.url);
    setView({ id: photo.id, url: URL.createObjectURL(await response.blob()) });
  }

  function share() {
    if (!progress || !customerPhone) {
      setError(t("progress.need_phone"));
      return;
    }
    const link = `${window.location.origin}/share/jobs/${progress.share_token}`;
    const who = customerName?.trim() ? `Hi ${customerName.trim()},` : "Hi,";
    const vehicle = vehicleNumber ? ` ${vehicleNumber}` : "";
    const shop = shopName || "the shop";
    const where = progress.complete
      ? `your vehicle${vehicle} is complete at ${shop}`
      : `your vehicle${vehicle} is at ${label(progress.steps.find((step) => step.key === progress.current_step) || progress.steps[0])} at ${shop}`;
    const href = whatsappHref(customerPhone, `${who} ${where}: ${link}`);
    if (!href) {
      setError(t("progress.need_phone"));
      return;
    }
    window.open(href, "_blank", "noopener,noreferrer");
  }

  if (!progress) {
    return error ? <p className="text-sm text-[#b84837]">{error}</p> : null;
  }

  return (
    <div className="no-print border border-[#d7d3c8] bg-white p-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="font-display text-xl font-semibold uppercase">{t("progress.title")}</p>
          <p className="mt-1 text-xs text-[#6f746e]">{t("progress.hint")}</p>
        </div>
        <button
          type="button"
          onClick={share}
          disabled={!customerPhone}
          title={customerPhone ? t("progress.share") : t("progress.need_phone")}
          className="inline-flex h-8 items-center gap-2 border border-[#c9c5b9] px-3 text-[11px] font-bold uppercase disabled:cursor-not-allowed disabled:opacity-40"
        >
          <MessageCircle size={14} />
          {t("progress.share")}
        </button>
      </div>
      <div className="mt-4">
        <ProgressBar percent={progressPercent(progress.steps, progress.complete)} />
      </div>
      {progress.complete && (
        <p className="mt-4 bg-[#167c73] px-3 py-2 text-sm font-bold uppercase text-white">{t("progress.complete_banner")}</p>
      )}
      {error && <p className="mt-3 text-sm text-[#b84837]">{error}</p>}
      <div className="mt-4">
        <p className="text-[10px] font-bold uppercase text-[#6f746e]">{t("progress.work")}</p>
        {(progress.labor ?? []).length === 0 ? (
          <p className="mt-1 text-sm text-[#6f746e]">{t("progress.work_empty")}</p>
        ) : (
          <ul className="mt-1 space-y-1">
            {(progress.labor ?? []).map((line) => (
              <li key={line.id} className="text-sm font-semibold">{line.description}</li>
            ))}
          </ul>
        )}
      </div>
      <ol className="mt-4 space-y-3">
        {progress.steps.map((step) => (
          <li key={step.key} className="border border-[#e2ded4] p-3">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <button
                type="button"
                disabled={readOnly || busy}
                onClick={() => void choose(step.key)}
                className="flex items-center gap-2 text-left disabled:cursor-default"
              >
                <span className={`grid size-5 place-items-center rounded-full text-[10px] font-bold ${
                  step.state === "upcoming" ? "border border-[#c9c5b9] text-[#6f746e]" : "bg-[#167c73] text-white"
                }`}>
                  {step.state === "current" ? "•" : step.state === "done" ? "✓" : ""}
                </span>
                <span className="text-sm font-semibold">{label(step)}</span>
                <span className="text-[10px] font-bold uppercase text-[#6f746e]">
                  {step.state === "current" && !progress.complete ? t("progress.now") : step.state === "done" ? t("progress.done") : t("progress.waiting")}
                </span>
              </button>
              {!readOnly && (
                <label className={`inline-flex h-8 cursor-pointer items-center bg-[#20221f] px-3 text-[11px] font-bold uppercase text-white ${busy || step.photos.length >= 6 ? "pointer-events-none opacity-50" : ""}`}>
                  {t("progress.add_photo")}
                  <input
                    type="file"
                    accept="image/jpeg,image/png,image/webp,image/gif,.jpg,.jpeg,.png,.webp,.gif"
                    className="sr-only"
                    disabled={busy || step.photos.length >= 6}
                    onChange={(event) => {
                      const file = event.target.files?.[0];
                      event.target.value = "";
                      if (file) void upload(step.key, file);
                    }}
                  />
                </label>
              )}
            </div>
            {step.photos.length > 0 && (
              <div className="mt-2 flex flex-wrap gap-3 text-sm">
                {step.photos.map((photo, index) => (
                  <span key={photo.id} className="inline-flex items-center gap-2">
                    <button type="button" className="font-semibold text-[#167c73]" onClick={() => void openPhoto(photo)}>
                      {t("progress.photo_n", { n: index + 1 })}
                    </button>
                    {!readOnly && (
                      <button type="button" className="text-[#b84837]" onClick={() => void remove(photo.id)}>{t("progress.remove")}</button>
                    )}
                  </span>
                ))}
              </div>
            )}
          </li>
        ))}
      </ol>
      {view && (
        <div className="mt-4 max-w-lg">
          <div className="mb-2 flex justify-end">
            <button type="button" className="text-sm font-semibold text-[#167c73]" onClick={() => { URL.revokeObjectURL(view.url); setView(null); }}>{t("progress.hide")}</button>
          </div>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={view.url} alt="" className="w-full border border-[#e2ded4] bg-[#f7f5ef] object-contain" />
        </div>
      )}
    </div>
  );
}
