"use client";

import { useEffect, useState } from "react";
import { api, Branch, currentBranch, currentBranches, currentUser, isMultiBranch, setCurrentBranchId, storeSession } from "@/lib/api";
import { ConfirmModal, inputClass } from "@/components/ui";

export function BranchChip() {
  const [branch, setBranch] = useState<Branch | null>(null);
  const [branches, setBranches] = useState<Branch[]>([]);
  const [open, setOpen] = useState(false);
  const [pending, setPending] = useState<Branch | null>(null);
  const [busy, setBusy] = useState(false);
  const user = currentUser();
  const canSwitch = user?.role === "business_owner";

  function refresh() {
    const list = currentBranches().filter((item) => item.status !== "inactive");
    setBranches(list);
    setBranch(currentBranch());
  }

  useEffect(() => {
    refresh();
    const onChange = () => refresh();
    window.addEventListener("garage-branch-changed", onChange);
    return () => window.removeEventListener("garage-branch-changed", onChange);
  }, []);

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
    <div className="relative">
      {canSwitch ? (
        <button
          type="button"
          onClick={() => setOpen((value) => !value)}
          className="inline-flex items-center gap-2 border border-[#20221f] bg-white px-3 py-2 text-left text-[11px] font-bold uppercase tracking-wide"
        >
          <span className="size-2 rounded-full bg-[#167c73]" />
          {branch.name}
          <span className="text-[#6f746e]">▾</span>
        </button>
      ) : (
        <span className="inline-flex items-center gap-2 border border-[#6b1e2a] bg-[#f8ecee] px-3 py-2 text-[11px] font-bold uppercase tracking-wide text-[#6b1e2a]">
          <span className="size-2 rounded-full bg-[#6b1e2a]" />
          {branch.name} · locked
        </span>
      )}
      {open && canSwitch && (
        <div className="absolute right-0 z-30 mt-2 w-56 border border-[#20221f] bg-white p-2 shadow-lg">
          {branches.map((item) => (
            <button
              key={item.id}
              type="button"
              onClick={() => {
                setOpen(false);
                if (item.id !== branch.id) setPending(item);
              }}
              className={`mb-1 flex w-full items-center justify-between px-3 py-2 text-left text-sm last:mb-0 ${item.id === branch.id ? "bg-[#167c73]/10 font-semibold" : "hover:bg-[#f3f0e8]"}`}
            >
              <span>{item.name}</span>
              {item.is_default ? <span className="text-[10px] uppercase text-[#6f746e]">Main</span> : null}
            </button>
          ))}
        </div>
      )}
      <ConfirmModal
        open={Boolean(pending)}
        title="Switch active shop?"
        message={`You are leaving ${branch.name}. New admits, instant bills, and payments will go to ${pending?.name ?? ""}.`}
        confirmLabel={busy ? "Switching..." : `Confirm ${pending?.name ?? ""}`}
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
  className = "block",
}: {
  value: string;
  onChange: (value: string) => void;
  className?: string;
}) {
  if (!isMultiBranch() || currentUser()?.role !== "business_owner") return null;
  return (
    <label className={className}>
      <span className="mb-1 block text-[10px] font-bold uppercase text-[#6f746e]">Shop</span>
      <select value={value} onChange={(event) => onChange(event.target.value)} className={`${inputClass} w-auto min-w-40`}>
        <option value="">This shop</option>
        <option value="all">All shops</option>
        {currentBranches().filter((branch) => branch.status !== "inactive").map((branch) => (
          <option key={branch.id} value={String(branch.id)}>{branch.name}</option>
        ))}
      </select>
    </label>
  );
}

export function BillingBranchBanner() {
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
      Billing as · {name} — new lines and payments go here
    </div>
  );
}
