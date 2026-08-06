import { ReactNode } from "react";

export function Panel({ children, className = "" }: { children: ReactNode; className?: string }) {
  // Avoid stacking two Tailwind bg-* utilities — stylesheet order, not class order, wins,
  // which left dark panels with white text on the default cream background.
  const hasBg = /\bbg-/.test(className);
  return <section className={`min-w-0 border border-[#d7d3c8] ${hasBg ? "" : "bg-[#fbfaf6]"} ${className}`}>{children}</section>;
}
export function PageState({ message }: { message: string }) { return <div className="grid min-h-48 place-items-center border border-dashed border-[#bdb8ab] bg-[#fbfaf6]/60 text-sm text-[#6f746e]">{message}</div>; }
export function ErrorMessage({ message }: { message: string }) { return <p className="border-l-4 border-[#b84837] bg-[#b84837]/8 px-4 py-3 text-sm text-[#8d3326]">{message}</p>; }
export const inputClass = "h-11 w-full border border-[#c9c5b9] bg-white px-3 text-sm outline-none focus:border-[#167c73]";
export const buttonClass = "inline-flex h-11 items-center justify-center gap-2 bg-[#20221f] px-4 text-sm font-semibold text-white transition hover:bg-[#167c73] disabled:opacity-50";