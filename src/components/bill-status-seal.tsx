import { billStampLabel, type BillStamp } from "@/lib/bill-stamp";

export function BillStatusSeal({
  stamp,
  paymentDate,
  alwaysVisible = false,
}: {
  stamp: BillStamp;
  paymentDate?: string | null;
  alwaysVisible?: boolean;
}) {
  const tone =
    stamp === "paid"
      ? "border-[#167c73] text-[#167c73]"
      : stamp === "partial"
        ? "border-[#b8860b] text-[#b8860b]"
        : "border-[#b8860b] text-[#b8860b]";

  return (
    <div
      aria-hidden="true"
      className={`bill-status-seal pointer-events-none mt-3 inline-block rotate-[-12deg] select-none border-[3px] px-3 py-1.5 text-center font-display font-bold uppercase tracking-[0.08em] ${
        alwaysVisible ? "" : "hidden print:inline-block"
      } ${tone}`}
    >
      <p className={`leading-none ${stamp === "partial" ? "text-xl sm:text-2xl" : "text-3xl sm:text-4xl"}`}>
        {billStampLabel(stamp)}
      </p>
      {paymentDate && stamp !== "quote" && (
        <p className="mt-1 text-[10px] font-semibold normal-case tracking-normal sm:text-xs">{paymentDate}</p>
      )}
    </div>
  );
}
