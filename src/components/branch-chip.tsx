"use client";

import { CSSProperties, useEffect, useLayoutEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { api, Branch, currentBranch, currentBranches, currentUser, isMultiBranch, setCurrentBranchId, storeSession } from "@/lib/api";
import { ConfirmModal } from "@/components/ui";
import { useT } from "@/lib/locale";

export function BranchChip() {
  const t = useT();
  const [branch, setBranch] = useState<Branch | null>(null);
  const [branches, setBranches] = useState<Branch[]>([]);
  const [open, setOpen] = useState(false);
  const [pending, setPending] = useState<Branch | null>(null);
  const [busy, setBusy] = useState(false);
  const [menuStyle, setMenuStyle] = useState<CSSProperties>({});
  const [mounted, setMounted] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);
  const user = currentUser();
  const canSwitch = user?.role === "business_owner";

  function refresh() {
    const list = currentBranches().filter((item) => item.status !== "inactive");
    setBranches(list);
    setBranch(currentBranch());
  }

  useEffect(() => {
    setMounted(true);
    refresh();
    const onChange = () => refresh();
    window.addEventListener("garage-branch-changed", onChange);
    return () => window.removeEventListener("garage-branch-changed", onChange);
  }, []);

  useLayoutEffect(() => {
    if (!open) return;
    function place() {
      const el = rootRef.current;
      if (!el) return;
      const r = el.getBoundingClientRect();
      const gutter = 12;
      const width = Math.min(Math.max(280, r.width), window.innerWidth - gutter * 2);
      const left = Math.min(Math.max(gutter, r.left), window.innerWidth - width - gutter);
      const top = Math.min(r.bottom + 8, window.innerHeight - 180);
      const maxHeight = Math.max(160, window.innerHeight - top - gutter);
      setMenuStyle({
        position: "fixed",
        top,
        left: window.innerWidth < 640 ? gutter : left,
        width: window.innerWidth < 640 ? window.innerWidth - gutter * 2 : width,
        maxHeight,
        zIndex: 80,
      });
    }
    place();
    window.addEventListener("resize", place);
    window.addEventListener("scroll", place, true);
    return () => {
      window.removeEventListener("resize", place);
      window.removeEventListener("scroll", place, true);
    };
  }, [open]);

  useEffect(() => {
    if (!open) return;
    const previous = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    function onKey(event: KeyboardEvent) {
      if (event.key === "Escape") setOpen(false);
    }
    document.addEventListener("keydown", onKey);
    return () => {
      document.body.style.overflow = previous;
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  if (!isMultiBranch() || !branch) return null;

  async function confirmSwitch() {
    if (!pending) return;
    setBusy(true);
    try {
      await api("/me/active-branch", { method: "POST", body: JSON.stringify({ branch_id: pending.id }) });
      setCurrentBranchId(pending.id);
      const token = localStorage.getItem("garage_token");
      const sessionUser = currentUser();
      const features = JSON.parse(localStorage.getItem("garage_features") || "[]");
      if (token && sessionUser) {
        storeSession(token, sessionUser, features, { branches: currentBranches(), active_branch: pending });
      }
      setPending(null);
      window.location.reload();
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="relative" ref={rootRef}>
      {canSwitch ? (
        <button
          type="button"
          onClick={() => setOpen((value) => !value)}
          aria-expanded={open}
          aria-haspopup="listbox"
          className="inline-flex h-8 max-w-full items-center gap-2 border border-[#20221f] bg-white px-2.5 text-[11px] font-bold uppercase tracking-wide"
        >
          <span className="size-2 shrink-0 rounded-full bg-[#167c73]" />
          <span className="max-w-36 truncate">{branch.name}</span>
          <span className="text-[#6f746e]">▾</span>
        </button>
      ) : (
        <span className="inline-flex h-8 items-center gap-2 border border-[#6b1e2a] bg-[#f8ecee] px-2.5 text-[11px] font-bold uppercase tracking-wide text-[#6b1e2a]">
          <span className="size-2 shrink-0 rounded-full bg-[#6b1e2a]" />
          {branch.name} · {t("common.locked")}
        </span>
      )}
      {mounted && open && canSwitch && createPortal(
        <>
          <button
            type="button"
            className="fixed inset-0 z-[70] bg-black/45"
            aria-label={t("common.close")}
            onClick={() => setOpen(false)}
          />
          <div
            role="listbox"
            style={menuStyle}
            className="overflow-y-auto border border-[#20221f] bg-white p-2 shadow-[0_16px_40px_rgba(32,34,31,0.28)]"
          >
            <p className="px-3 pb-2 pt-1 text-[10px] font-bold uppercase tracking-wide text-[#6f746e]">{t("common.shop")}</p>
            {branches.map((item) => (
              <button
                key={item.id}
                type="button"
                role="option"
                aria-selected={item.id === branch.id}
                onClick={() => {
                  setOpen(false);
                  if (item.id !== branch.id) setPending(item);
                }}
                className={`mb-1 flex min-h-11 w-full items-center justify-between gap-3 px-3 py-2 text-left text-sm last:mb-0 ${item.id === branch.id ? "bg-[#167c73]/10 font-semibold" : "hover:bg-[#f3f0e8]"}`}
              >
                <span className="min-w-0 break-words">{item.name}</span>
                {item.is_default ? <span className="shrink-0 text-[10px] uppercase text-[#6f746e]">{t("common.main")}</span> : null}
              </button>
            ))}
          </div>
        </>,
        document.body,
      )}
      <ConfirmModal
        open={Boolean(pending)}
        title={t("branch.switch_title")}
        message={t("branch.switch_msg", { from: branch.name, to: pending?.name ?? "" })}
        confirmLabel={busy ? t("branch.switching") : t("branch.confirm", { name: pending?.name ?? "" })}
        tone="teal"
        busy={busy}
        onCancel={() => setPending(null)}
        onConfirm={confirmSwitch}
      />
    </div>
  );
}

export function ShopFilter({
  value,
  onChange,
  className = "min-w-40",
}: {
  value: string;
  onChange: (value: string) => void;
  className?: string;
}) {
  const t = useT();
  // localStorage is client-only — first paint must match SSR (null).
  const [ready, setReady] = useState(false);
  useEffect(() => setReady(true), []);
  if (!ready || !isMultiBranch() || currentUser()?.role !== "business_owner") return null;
  return (
    <label className={`relative z-0 flex min-w-0 flex-col ${className}`}>
      <span className="mb-1 block text-[10px] font-bold uppercase text-[#6f746e]">{t("common.shop")}</span>
      <select
        value={value}
        onChange={(event) => onChange(event.target.value)}
        className="h-8 w-full min-w-0 border border-[#c9c5b9] bg-white px-2 text-[11px] outline-none focus:border-[#167c73]"
      >
        <option value="">{t("common.this_shop")}</option>
        <option value="all">{t("common.all_shops")}</option>
        {currentBranches().filter((branch) => branch.status !== "inactive").map((branch) => (
          <option key={branch.id} value={String(branch.id)}>{branch.name}</option>
        ))}
      </select>
    </label>
  );
}

export function BillingBranchBanner() {
  const t = useT();
  const [name, setName] = useState<string | null>(null);
  useEffect(() => {
    const apply = () => {
      if (!isMultiBranch()) {
        setName(null);
        return;
      }
      setName(currentBranch()?.name ?? null);
    };
    apply();
    window.addEventListener("garage-branch-changed", apply);
    return () => window.removeEventListener("garage-branch-changed", apply);
  }, []);
  if (!name) return null;
  return (
    <div className="no-print mb-4 bg-[#6b1e2a] px-4 py-2 text-center font-display text-sm font-semibold uppercase tracking-wide text-[#f8ebea]">
      {t("branch.billing_as", { name })}
    </div>
  );
}
