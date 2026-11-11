"use client";

import { useEffect, useState } from "react";
import { currentUser } from "@/lib/api";

const KEY = "clothing_half_view";

export function readHalfView(): boolean {
  if (typeof window === "undefined") return false;
  return localStorage.getItem(KEY) === "1";
}

export function writeHalfView(on: boolean) {
  localStorage.setItem(KEY, on ? "1" : "0");
  window.dispatchEvent(new Event("clothing-half-view"));
}

export function halfQty(qty: number): number {
  return Math.floor(Number(qty) / 2);
}

export function useHalfView(): [boolean, (on: boolean) => void] {
  const [on, setOn] = useState(false);

  useEffect(() => {
    const read = () => setOn(readHalfView());
    read();
    window.addEventListener("clothing-half-view", read);
    window.addEventListener("storage", read);
    return () => {
      window.removeEventListener("clothing-half-view", read);
      window.removeEventListener("storage", read);
    };
  }, []);

  return [on, (next: boolean) => {
    writeHalfView(next);
    setOn(next);
  }];
}

export function useNewSalePurple(): boolean {
  const [purple, setPurple] = useState(false);

  useEffect(() => {
    const read = () => {
      const tenant = currentUser()?.tenant;
      setPurple(tenant?.business_type === "clothing" && !tenant.half_view);
    };
    read();
    window.addEventListener("clothing-half-view", read);
    return () => window.removeEventListener("clothing-half-view", read);
  }, []);

  return purple;
}

export function HalfToggle({ on, onChange, tone = "dark" }: { on: boolean; onChange: (next: boolean) => void; tone?: "dark" | "light" }) {
  const offTrack = tone === "light" ? "bg-[#c9c5b9]" : "bg-white/15";

  return (
    <button
      type="button"
      role="switch"
      aria-checked={on}
      aria-label="Color"
      title={on ? "Color on" : "Color off"}
      onClick={() => onChange(!on)}
      className="inline-flex items-center gap-1.5"
    >
      <span className={`text-[10px] font-semibold uppercase tracking-wide ${tone === "light" ? "text-[#6f746e]" : "text-white/55"}`}>Color</span>
      <span className={`relative h-4 w-7 shrink-0 rounded-full transition ${on ? "bg-violet-500" : offTrack}`}>
        <span className={`absolute top-0.5 size-3 rounded-full bg-white transition ${on ? "left-3.5" : "left-0.5"}`} />
      </span>
    </button>
  );
}
