"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { api, mediaUrl, money } from "@/lib/api";

type Line = { name: string; detail?: string | null; quantity: number; unit_price: number; line_total: number };

type DisplayPayload = {
  business_name?: string | null;
  logo_url?: string | null;
  payload?: {
    lines?: Line[];
    customer_name?: string | null;
    discount?: number;
    subtotal?: number;
    tax?: number;
    total?: number;
  };
};

export default function ClothingDisplayPage() {
  const router = useRouter();
  const [state, setState] = useState<DisplayPayload | null>(null);
  const [blocked, setBlocked] = useState("");

  useEffect(() => {
    if (!localStorage.getItem("garage_token")) {
      router.replace("/login");
      return;
    }
    let stop = false;
    async function pull() {
      try {
        const next = await api<DisplayPayload>("/clothing/display");
        if (!stop) {
          setBlocked("");
          setState(next);
        }
      } catch (caught) {
        if (!stop) setBlocked(caught instanceof Error ? caught.message : "Customer display is not available.");
      }
    }
    pull();
    const id = window.setInterval(pull, 1000);
    return () => {
      stop = true;
      window.clearInterval(id);
    };
  }, [router]);

  const lines = state?.payload?.lines ?? [];
  const logo = mediaUrl(state?.logo_url);
  const name = state?.business_name || "Clothing";

  return (
    <main className="flex min-h-screen flex-col bg-[#070b14] text-white">
      <header className="flex items-center justify-between px-8 py-6">
        <p className="text-sm uppercase tracking-[0.22em] text-white/45">{name}</p>
        {state?.payload?.customer_name && lines.length > 0 && (
          <p className="text-sm text-white/70">{state.payload.customer_name}</p>
        )}
      </header>
      {blocked ? (
        <div className="grid flex-1 place-items-center px-8 text-center">
          <p className="max-w-md text-lg text-white/70">{blocked}</p>
        </div>
      ) : lines.length === 0 ? (
        <div className="grid flex-1 place-items-center px-8">
          {logo ? (
            <img src={logo} alt={name} className="max-h-64 max-w-md object-contain" />
          ) : (
            <p className="text-center text-5xl font-semibold tracking-tight sm:text-7xl">{name}</p>
          )}
        </div>
      ) : (
        <div className="grid min-w-0 flex-1 gap-8 px-8 pb-10 lg:grid-cols-[minmax(0,1fr)_minmax(18rem,24rem)]">
          <ul className="min-w-0 space-y-4">
            {lines.map((line, index) => (
              <li key={`${line.name}-${index}`} className="flex items-start justify-between gap-4 border-b border-white/10 pb-4">
                <div className="min-w-0">
                  <p className="text-xl font-medium">{line.name}</p>
                  <p className="mt-1 text-sm text-white/45">{line.detail} · {line.quantity} × {money(line.unit_price)}</p>
                </div>
                <p className="shrink-0 text-xl font-semibold">{money(line.line_total)}</p>
              </li>
            ))}
          </ul>
          <aside className="h-fit min-w-0 overflow-hidden rounded-3xl border border-white/10 bg-white/5 p-6">
            <dl className="space-y-2 text-sm text-white/60">
              <div className="flex justify-between gap-3"><dt>Subtotal</dt><dd className="shrink-0">{money(state?.payload?.subtotal || 0)}</dd></div>
              {Number(state?.payload?.discount || 0) > 0 && (
                <div className="flex justify-between gap-3 text-emerald-300"><dt>Discount</dt><dd className="shrink-0">-{money(state?.payload?.discount || 0)}</dd></div>
              )}
              {Number(state?.payload?.tax || 0) > 0 && (
                <div className="flex justify-between gap-3"><dt>Tax</dt><dd className="shrink-0">{money(state?.payload?.tax || 0)}</dd></div>
              )}
            </dl>
            <p className="mt-6 text-xs uppercase tracking-[0.18em] text-white/40">Total</p>
            <p className="mt-1 text-3xl font-semibold leading-tight break-words sm:text-4xl">{money(state?.payload?.total || 0)}</p>
          </aside>
        </div>
      )}
    </main>
  );
}
