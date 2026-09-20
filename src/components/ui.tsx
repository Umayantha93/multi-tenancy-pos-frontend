"use client";

import { InputHTMLAttributes, ReactNode, useEffect, useState } from "react";
import { Eye, EyeOff, Minus, Plus, X } from "lucide-react";
import { useT } from "@/lib/locale";

export function Panel({ children, className = "" }: { children: ReactNode; className?: string }) {
  // Avoid stacking two Tailwind bg-* utilities — stylesheet order, not class order, wins,
  // which left dark panels with white text on the default cream background.
  const hasBg = /\bbg-/.test(className);
  return <section className={`min-w-0 border border-[#d7d3c8] ${hasBg ? "" : "bg-[#fbfaf6]"} ${className}`}>{children}</section>;
}
export function PageState({ message }: { message: string }) { return <div className="grid min-h-48 place-items-center border border-dashed border-[#bdb8ab] bg-[#fbfaf6]/60 text-sm text-[#6f746e]">{message}</div>; }
export function ErrorMessage({ message }: { message: string }) { return <p className="border-l-4 border-[#b84837] bg-[#b84837]/8 px-4 py-3 text-sm text-[#8d3326]">{message}</p>; }
export function SuccessMessage({ message }: { message: string }) { return <p className="border-l-4 border-[#167c73] bg-[#167c73]/8 px-4 py-3 text-sm text-[#0f5c56]">{message}</p>; }
export const inputClass = "h-8 w-full border border-[#c9c5b9] bg-white px-2 text-[11px] outline-none focus:border-[#167c73] [&:is(textarea)]:h-auto [&:is(textarea)]:min-h-[4rem] [&:is(textarea)]:py-1.5";
export const buttonClass = "inline-flex h-8 items-center justify-center gap-1 bg-[#20221f] px-2.5 text-[11px] font-semibold text-white transition hover:bg-[#167c73] disabled:opacity-50";

type PasswordInputProps = Omit<InputHTMLAttributes<HTMLInputElement>, "type"> & {
  leftIcon?: ReactNode;
};

export function PasswordInput({ leftIcon, className = "", ...props }: PasswordInputProps) {
  const [show, setShow] = useState(false);
  const t = useT();
  return (
    <div className="relative">
      {leftIcon}
      <input
        {...props}
        type={show ? "text" : "password"}
        className={`${className} ${leftIcon ? "!pl-12" : ""} !pr-11`.trim()}
      />
      <button
        type="button"
        onClick={() => setShow((value) => !value)}
        aria-label={show ? t("common.hide_password") : t("common.show_password")}
        className="absolute right-3 top-1/2 -translate-y-1/2 text-[#858a83] transition hover:text-[#20221f]"
      >
        {show ? <EyeOff size={18} /> : <Eye size={18} />}
      </button>
    </div>
  );
}

type ConfirmModalProps = {
  open: boolean;
  title: string;
  message: string;
  confirmLabel?: string;
  cancelLabel?: string;
  tone?: "default" | "danger" | "teal";
  busy?: boolean;
  children?: ReactNode;
  onConfirm: () => void;
  onCancel: () => void;
};

export function ConfirmModal({
  open,
  title,
  message,
  confirmLabel,
  cancelLabel,
  tone = "default",
  busy = false,
  children,
  onConfirm,
  onCancel,
}: ConfirmModalProps) {
  const t = useT();
  const resolvedConfirm = confirmLabel ?? t("common.confirm");
  const resolvedCancel = cancelLabel ?? t("common.cancel");
  useEffect(() => {
    if (!open) return;
    function onKey(event: KeyboardEvent) {
      if (event.key === "Escape" && !busy) onCancel();
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, busy, onCancel]);

  if (!open) return null;

  const confirmTone =
    tone === "danger"
      ? "bg-[#b84837] hover:bg-[#9a3a2c]"
      : tone === "teal"
        ? "bg-[#167c73] hover:bg-[#0f5c56]"
        : "bg-[#20221f] hover:bg-[#167c73]";

  return (
    <div className="fixed inset-0 z-[80] flex items-center justify-center p-4">
      <button
        type="button"
        aria-label={t("common.close_dialog")}
        className="absolute inset-0 bg-[#181b19]/55 backdrop-blur-[2px]"
        disabled={busy}
        onClick={onCancel}
      />
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="confirm-modal-title"
        className="relative z-10 w-full max-w-md border border-[#d7d3c8] bg-[#fbfaf6] shadow-[0_24px_60px_rgba(24,27,25,0.28)]"
      >
        <div className="flex items-start justify-between border-b border-[#e2ded4] px-5 py-4">
          <div>
            <p className="text-[10px] font-bold uppercase tracking-wide text-[#167c73]">{t("common.please_confirm")}</p>
            <h2 id="confirm-modal-title" className="mt-1 font-display text-2xl font-semibold uppercase leading-none">
              {title}
            </h2>
          </div>
          <button
            type="button"
            aria-label={t("common.close")}
            disabled={busy}
            onClick={onCancel}
            className="grid size-8 place-items-center border border-[#d7d3c8] text-[#6f746e] hover:border-[#167c73] hover:text-[#167c73] disabled:opacity-50"
          >
            <X size={16} />
          </button>
        </div>
        <div className="px-5 py-5">
          <p className="text-sm leading-relaxed text-[#4f544e]">{message}</p>
          {children}
        </div>
        <div className="flex flex-wrap justify-end gap-2 border-t border-[#e2ded4] bg-[#f3f0e8] px-5 py-4">
          <button
            type="button"
            disabled={busy}
            onClick={onCancel}
            className="inline-flex h-8 items-center justify-center border border-[#c9c5b9] bg-white px-2.5 text-[11px] font-semibold text-[#20221f] hover:border-[#167c73] disabled:opacity-50"
          >
            {resolvedCancel}
          </button>
          <button
            type="button"
            disabled={busy}
            onClick={onConfirm}
            className={`inline-flex h-8 items-center justify-center px-2.5 text-[11px] font-semibold text-white transition disabled:opacity-50 ${confirmTone}`}
          >
            {busy ? t("common.working") : resolvedConfirm}
          </button>
        </div>
      </div>
    </div>
  );
}

export function QtyStepper({
  value,
  min = 1,
  max,
  onChange,
}: {
  value: number;
  min?: number;
  max: number;
  onChange: (value: number) => void;
}) {
  const t = useT();
  return (
    <div className="inline-flex h-7 shrink-0 items-stretch overflow-hidden border border-[#c9c5b9] bg-white">
      <button
        type="button"
        disabled={value <= min}
        onClick={() => onChange(value - 1)}
        className="grid w-7 place-items-center text-[#6f746e] hover:bg-[#eeece5] disabled:opacity-30"
        aria-label={`− ${t("common.qty")}`}
      >
        <Minus size={12} strokeWidth={2.25} />
      </button>
      <input
        type="number"
        min={min}
        max={max}
        value={value}
        onChange={(event) => onChange(Number(event.target.value))}
        className="w-8 border-x border-[#c9c5b9] bg-white text-center text-xs tabular-nums outline-none [appearance:textfield] [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none"
        aria-label={t("common.quantity")}
      />
      <button
        type="button"
        disabled={value >= max}
        onClick={() => onChange(value + 1)}
        className="grid w-7 place-items-center text-[#6f746e] hover:bg-[#eeece5] disabled:opacity-30"
        aria-label={`+ ${t("common.qty")}`}
      >
        <Plus size={12} strokeWidth={2.25} />
      </button>
    </div>
  );
}
