"use client";

import { useCallback, useEffect, useState } from "react";
import { API_URL, api, currentBranchId } from "@/lib/api";
import { useT } from "@/lib/locale";

type JobPhoto = {
  id: number;
  label?: string | null;
  original_name?: string | null;
  size_bytes: number;
  expires_at?: string | null;
};

function authHeaders(): HeadersInit {
  const headers: Record<string, string> = {};
  const token = typeof window === "undefined" ? null : localStorage.getItem("garage_token");
  if (token) headers.Authorization = `Bearer ${token}`;
  const branchId = currentBranchId();
  if (branchId) headers["X-Branch-Id"] = String(branchId);
  return headers;
}

export function JobPhotos({ billId, readOnly = false }: { billId: number; readOnly?: boolean }) {
  const t = useT();
  const [photos, setPhotos] = useState<JobPhoto[]>([]);
  const [error, setError] = useState("");
  const [uploading, setUploading] = useState(false);
  const [viewing, setViewing] = useState<{ id: number; url: string } | null>(null);

  const load = useCallback(() => {
    api<JobPhoto[]>(`/bills/${billId}/photos`)
      .then(setPhotos)
      .catch((caught) => setError(caught.message));
  }, [billId]);

  useEffect(() => {
    load();
    return () => {
      if (viewing?.url) URL.revokeObjectURL(viewing.url);
    };
  }, [load]);

  async function upload(files: FileList | File[]) {
    setError("");
    setUploading(true);
    const remaining = Math.max(0, 15 - photos.length);
    const batch = Array.from(files).slice(0, remaining);
    try {
      for (const file of batch) {
        const body = new FormData();
        body.append("photo", file);
        await api(`/bills/${billId}/photos`, { method: "POST", body });
      }
      load();
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : t("photos.upload_failed"));
    } finally {
      setUploading(false);
    }
  }

  async function view(photo: JobPhoto) {
    if (viewing?.url) URL.revokeObjectURL(viewing.url);
    const response = await fetch(`${API_URL}/bills/${billId}/photos/${photo.id}/file`, { headers: authHeaders() });
    if (!response.ok) {
      setError(t("photos.view_failed"));
      return;
    }
    const url = URL.createObjectURL(await response.blob());
    setViewing({ id: photo.id, url });
  }

  async function remove(id: number) {
    setError("");
    try {
      await api(`/bills/${billId}/photos/${id}`, { method: "DELETE" });
      if (viewing?.id === id && viewing.url) URL.revokeObjectURL(viewing.url);
      if (viewing?.id === id) setViewing(null);
      load();
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : t("photos.delete_failed"));
    }
  }

  const left = Math.max(0, 15 - photos.length);

  return (
    <div className="no-print border border-[#d7d3c8] bg-white p-5">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <p className="font-display text-xl font-semibold uppercase">{t("photos.title")}</p>
          <p className="text-xs text-[#6f746e]">{t("photos.hint", { count: photos.length })}</p>
        </div>
        {!readOnly && (
          <label className="inline-flex h-8 cursor-pointer items-center bg-[#20221f] px-3 text-xs font-bold uppercase text-white">
            {uploading ? t("photos.uploading") : t("photos.add", { left })}
            <input
              type="file"
              accept="image/jpeg,image/png,image/webp,image/gif"
              multiple
              className="hidden"
              disabled={uploading || left <= 0}
              onChange={(event) => {
                const files = event.target.files;
                event.target.value = "";
                if (files?.length) void upload(files);
              }}
            />
          </label>
        )}
      </div>
      {error && <p className="mt-3 text-sm text-[#b84837]">{error}</p>}
      <div className="mt-4 grid grid-cols-2 gap-2 sm:grid-cols-4">
        {photos.map((photo, index) => (
          <div key={photo.id} className="border border-[#e2ded4] p-2 text-sm">
            <p className="font-semibold">{t("photos.shot", { n: index + 1 })}</p>
            <p className="mt-1 text-[11px] text-[#6f746e]">
              {(photo.size_bytes / 1024).toFixed(0)} KB
              {photo.expires_at ? ` · ${t("photos.until", { date: photo.expires_at })}` : ""}
            </p>
            <div className="mt-2 flex gap-3">
              <button type="button" className="text-[#167c73]" onClick={() => void view(photo)}>{t("photos.view")}</button>
              {!readOnly && (
                <button type="button" className="text-[#b84837]" onClick={() => void remove(photo.id)}>{t("photos.delete")}</button>
              )}
            </div>
          </div>
        ))}
      </div>
      {photos.length === 0 && <p className="mt-4 text-sm text-[#6f746e]">{readOnly ? t("photos.empty_readonly") : t("photos.empty")}</p>}
      {viewing && (
        // eslint-disable-next-line @next/next/no-img-element
        <img className="mt-4 w-full max-w-lg border border-[#e2ded4] bg-[#f7f5ef] object-contain" src={viewing.url} alt="" />
      )}
    </div>
  );
}
