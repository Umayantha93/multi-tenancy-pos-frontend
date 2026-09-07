"use client";

import { useCallback, useEffect, useState } from "react";
import { API_URL, api, currentBranchId } from "@/lib/api";

type JobVideo = {
  id: number;
  label?: string | null;
  original_name?: string | null;
  duration_seconds: number;
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

export function JobVideos({ billId }: { billId: number }) {
  const [videos, setVideos] = useState<JobVideo[]>([]);
  const [error, setError] = useState("");
  const [uploading, setUploading] = useState(false);
  const [playing, setPlaying] = useState<{ id: number; url: string } | null>(null);

  const load = useCallback(() => {
    api<JobVideo[]>(`/bills/${billId}/videos`)
      .then(setVideos)
      .catch((caught) => setError(caught.message));
  }, [billId]);

  useEffect(() => {
    load();
    return () => {
      if (playing?.url) URL.revokeObjectURL(playing.url);
    };
  }, [load]);

  async function upload(file: File) {
    setError("");
    setUploading(true);
    const body = new FormData();
    body.append("video", file);
    try {
      await api(`/bills/${billId}/videos`, { method: "POST", body });
      load();
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Could not upload video.");
    } finally {
      setUploading(false);
    }
  }

  async function play(video: JobVideo) {
    if (playing?.url) URL.revokeObjectURL(playing.url);
    const response = await fetch(`${API_URL}/bills/${billId}/videos/${video.id}/file`, { headers: authHeaders() });
    if (!response.ok) {
      setError("Could not play this video.");
      return;
    }
    const url = URL.createObjectURL(await response.blob());
    setPlaying({ id: video.id, url });
  }

  async function remove(id: number) {
    setError("");
    try {
      await api(`/bills/${billId}/videos/${id}`, { method: "DELETE" });
      if (playing?.id === id && playing.url) URL.revokeObjectURL(playing.url);
      if (playing?.id === id) setPlaying(null);
      load();
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Could not delete video.");
    }
  }

  const left = Math.max(0, 5 - videos.length);

  return (
    <div className="no-print border border-[#d7d3c8] bg-white p-5">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <p className="font-display text-xl font-semibold uppercase">Job videos</p>
          <p className="text-xs text-[#6f746e]">Staff only · not printed · not on SMS · removed after 6 months · {videos.length} / 5</p>
        </div>
        <label className="inline-flex h-10 cursor-pointer items-center bg-[#20221f] px-3 text-xs font-bold uppercase text-white">
          {uploading ? "Converting..." : `Add video (${left} left)`}
          <input
            type="file"
            accept="video/mp4,video/quicktime,video/webm,video/3gpp"
            className="hidden"
            disabled={uploading || left <= 0}
            onChange={(event) => {
              const file = event.target.files?.[0];
              event.target.value = "";
              if (file) void upload(file);
            }}
          />
        </label>
      </div>
      {error && <p className="mt-3 text-sm text-[#b84837]">{error}</p>}
      <div className="mt-4 space-y-2">
        {videos.map((video, index) => (
          <div key={video.id} className="flex flex-wrap items-center gap-3 border border-[#e2ded4] px-3 py-2 text-sm">
            <span className="font-semibold">Clip {index + 1}</span>
            <span className="text-[#6f746e]">
              {video.duration_seconds}s · {(video.size_bytes / (1024 * 1024)).toFixed(1)} MB
              {video.expires_at ? ` · until ${video.expires_at}` : ""}
            </span>
            <button type="button" className="ml-auto text-[#167c73]" onClick={() => void play(video)}>Play</button>
            <button type="button" className="text-[#b84837]" onClick={() => void remove(video.id)}>Delete</button>
          </div>
        ))}
        {videos.length === 0 && <p className="text-sm text-[#6f746e]">No clips yet. Film on the phone, then upload.</p>}
      </div>
      {playing && (
        <video className="mt-4 w-full max-w-lg bg-black" src={playing.url} controls autoPlay />
      )}
    </div>
  );
}
