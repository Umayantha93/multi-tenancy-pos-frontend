"use client";

import { InputHTMLAttributes, ReactNode, useState } from "react";
import { Eye, EyeOff } from "lucide-react";

export function Panel({ children, className = "" }: { children: ReactNode; className?: string }) {
  // Avoid stacking two Tailwind bg-* utilities — stylesheet order, not class order, wins,
  // which left dark panels with white text on the default cream background.
  const hasBg = /\bbg-/.test(className);
  return <section className={`min-w-0 border border-[#d7d3c8] ${hasBg ? "" : "bg-[#fbfaf6]"} ${className}`}>{children}</section>;
}
export function PageState({ message }: { message: string }) { return <div className="grid min-h-48 place-items-center border border-dashed border-[#bdb8ab] bg-[#fbfaf6]/60 text-sm text-[#6f746e]">{message}</div>; }
export function ErrorMessage({ message }: { message: string }) { return <p className="border-l-4 border-[#b84837] bg-[#b84837]/8 px-4 py-3 text-sm text-[#8d3326]">{message}</p>; }
export function SuccessMessage({ message }: { message: string }) { return <p className="border-l-4 border-[#167c73] bg-[#167c73]/8 px-4 py-3 text-sm text-[#0f5c56]">{message}</p>; }
export const inputClass = "h-11 w-full border border-[#c9c5b9] bg-white px-3 text-sm outline-none focus:border-[#167c73]";
export const buttonClass = "inline-flex h-11 items-center justify-center gap-2 bg-[#20221f] px-4 text-sm font-semibold text-white transition hover:bg-[#167c73] disabled:opacity-50";

type PasswordInputProps = Omit<InputHTMLAttributes<HTMLInputElement>, "type"> & {
  leftIcon?: ReactNode;
};

export function PasswordInput({ leftIcon, className = "", ...props }: PasswordInputProps) {
  const [show, setShow] = useState(false);
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
        aria-label={show ? "Hide password" : "Show password"}
        className="absolute right-3 top-1/2 -translate-y-1/2 text-[#858a83] transition hover:text-[#20221f]"
      >
        {show ? <EyeOff size={18} /> : <Eye size={18} />}
      </button>
    </div>
  );
}
