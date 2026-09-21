"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { API_URL, api, currentBranchId } from "@/lib/api";
import { useT } from "@/lib/locale";

type JobPhoto = {
  id: number;
  label?: string | null;
  original_name?: string | null;
  size_bytes: number;
  expires_at?: string | null;
};

const PHOTO_UPLOAD_BUDGET = 1.5 * 1024 * 1024;

function looksLikeImage(file: File) {
  if (file.type.startsWith("image/")) return true;
  return /\.(jpe?g|png|webp|gif|heic|heif|bmp|avif)$/i.test(file.name);
}

async function canvasToBlob(canvas: HTMLCanvasElement, type: string, quality?: number): Promise<Blob> {
  const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, type, quality));
  if (!blob) throw new Error("Could not prepare this photo.");
  return blob;
}

async function renderToJpeg(bitmap: ImageBitmap, maxEdge: number, quality: number): Promise<Blob> {
  const scale = Math.min(1, maxEdge / Math.max(bitmap.width, bitmap.height, 1));
  const width = Math.max(1, Math.round(bitmap.width * scale));
  const height = Math.max(1, Math.round(bitmap.height * scale));
  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("Could not prepare this photo.");
  ctx.drawImage(bitmap, 0, 0, width, height);
  return canvasToBlob(canvas, "image/jpeg", quality);
}

async function decodeImage(file: File): Promise<ImageBitmap> {
  try {
    return await createImageBitmap(file);
  } catch {
    const url = URL.createObjectURL(file);
    try {
      const image = await new Promise<HTMLImageElement>((resolve, reject) => {
        const element = new Image();
        element.onload = () => resolve(element);
        element.onerror = () => reject(new Error("decode"));
        element.src = url;
      });
      const canvas = document.createElement("canvas");
      canvas.width = image.naturalWidth || image.width;
      canvas.height = image.naturalHeight || image.height;
      const ctx = canvas.getContext("2d");
      if (!ctx || canvas.width < 1 || canvas.height < 1) throw new Error("decode");
      ctx.drawImage(image, 0, 0);
      return await createImageBitmap(await canvasToBlob(canvas, "image/png"));
    } finally {
      URL.revokeObjectURL(url);
    }
  }
}

async function compressPhoto(file: File): Promise<File> {
  if (file.type === "image/gif" && file.size <= PHOTO_UPLOAD_BUDGET) return file;
  if (!looksLikeImage(file)) {
    throw new Error("Use a JPEG, PNG, or WebP photo.");
  }

  let bitmap: ImageBitmap;
  try {
    bitmap = await decodeImage(file);
  } catch {
    throw new Error("This photo could not be read. Save it as JPEG or PNG and try again.");
  }

  try {
    let max = 1600;
    let quality = 0.82;
    let blob: Blob | null = null;
    for (let attempt = 0; attempt < 8; attempt += 1) {
      blob = await renderToJpeg(bitmap, max, quality);
      if (blob.size <= PHOTO_UPLOAD_BUDGET) break;
      quality = Math.max(0.4, quality - 0.1);
      max = Math.max(640, Math.round(max * 0.72));
    }
    if (!blob || blob.size > PHOTO_UPLOAD_BUDGET) {
      throw new Error("This photo is still too large. Try another shot.");
    }
    const base = file.name.replace(/\.[^.]+$/, "") || "job-photo";
    return new File([blob], `${base}.jpg`, { type: "image/jpeg" });
  } finally {
    bitmap.close();
  }
}

function authHeaders(): HeadersInit {
  const headers: Record<string, string> = {};
  const token = typeof window === "undefined" ? null : localStorage.getItem("garage_token");
  if (token) headers.Authorization = `Bearer ${token}`;
  const branchId = currentBranchId();
  if (branchId) headers["X-Branch-Id"] = String(branchId);
  return headers;
}

async function snapshotFiles(list: FileList | null): Promise<File[]> {
  if (!list?.length) return [];
  return Promise.all(
    Array.from(list).map(async (file) => new File([await file.arrayBuffer()], file.name, {
      type: file.type,
      lastModified: file.lastModified,
    })),
  );
}

export function JobPhotos({ billId, readOnly = false }: { billId: number; readOnly?: boolean }) {
  const t = useT();
  const inputRef = useRef<HTMLInputElement>(null);
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

  async function upload(files: File[]) {
    setError("");
    setUploading(true);
    const remaining = Math.max(0, 15 - photos.length);
    const batch = files.slice(0, remaining);
    if (batch.length === 0) {
      setUploading(false);
      return;
    }
    try {
      for (const file of batch) {
        const body = new FormData();
        body.append("photo", await compressPhoto(file));
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
    if (viewing?.id === photo.id) return;
    if (viewing?.url) URL.revokeObjectURL(viewing.url);
    const response = await fetch(`${API_URL}/bills/${billId}/photos/${photo.id}/file`, { headers: authHeaders() });
    if (!response.ok) {
      setError(t("photos.view_failed"));
      return;
    }
    const url = URL.createObjectURL(await response.blob());
    setViewing({ id: photo.id, url });
  }

  function hide() {
    if (viewing?.url) URL.revokeObjectURL(viewing.url);
    setViewing(null);
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
          <span className="relative inline-flex">
            <button
              type="button"
              disabled={uploading || left <= 0}
              onClick={() => inputRef.current?.click()}
              className="inline-flex h-8 cursor-pointer items-center bg-[#20221f] px-3 text-xs font-bold uppercase text-white disabled:cursor-not-allowed disabled:opacity-60"
            >
              {uploading ? t("photos.uploading") : t("photos.add", { left })}
            </button>
            <input
              ref={inputRef}
              type="file"
              accept="image/jpeg,image/png,image/webp,image/gif,.jpg,.jpeg,.png,.webp,.gif,.heic,.heif"
              multiple
              className="sr-only"
              tabIndex={-1}
              onChange={(event) => {
                const input = event.target;
                void snapshotFiles(input.files).then((files) => {
                  input.value = "";
                  if (files.length) void upload(files);
                }).catch(() => {
                  input.value = "";
                  setError("This photo could not be read. Save it as JPEG or PNG and try again.");
                });
              }}
            />
          </span>
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
            <div className="mt-2 flex flex-wrap gap-3">
              <button type="button" className="text-[#167c73]" onClick={() => void view(photo)}>{t("photos.view")}</button>
              <button type="button" className="text-[#167c73]" onClick={hide}>{t("photos.hide")}</button>
              {!readOnly && (
                <button type="button" className="text-[#b84837]" onClick={() => void remove(photo.id)}>{t("photos.delete")}</button>
              )}
            </div>
          </div>
        ))}
      </div>
      {photos.length === 0 && <p className="mt-4 text-sm text-[#6f746e]">{readOnly ? t("photos.empty_readonly") : t("photos.empty")}</p>}
      {viewing && (
        <div className="mt-4 max-w-lg">
          <div className="mb-2 flex justify-end">
            <button type="button" className="text-sm font-semibold text-[#167c73]" onClick={hide}>{t("photos.hide")}</button>
          </div>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img className="w-full border border-[#e2ded4] bg-[#f7f5ef] object-contain" src={viewing.url} alt="" />
        </div>
      )}
    </div>
  );
}
