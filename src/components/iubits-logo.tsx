export function IubitsLogo({
  tone = "onDark",
  size = "md",
  markOnly = false,
}: {
  tone?: "onDark" | "onLight";
  size?: "sm" | "md" | "lg";
  markOnly?: boolean;
}) {
  const mark = size === "sm" ? "size-9" : size === "lg" ? "h-16 w-auto" : "size-11";
  const text = size === "sm" ? "text-xl" : size === "lg" ? "text-4xl" : "text-2xl";
  const name = tone === "onDark" ? "text-white" : "text-[#1c1914]";

  return (
    <span className="inline-flex min-w-0 items-center gap-2.5">
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src="/brand/iubits-mark.svg" alt="" className={`${mark} shrink-0`} />
      {!markOnly && (
        <span className={`font-display font-semibold leading-none tracking-wide ${text} ${name}`}>
          IUBits <span className="text-[#e2b43a]">POS</span>
        </span>
      )}
    </span>
  );
}
