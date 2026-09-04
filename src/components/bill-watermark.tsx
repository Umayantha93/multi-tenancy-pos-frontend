export function BillWatermark({
  src,
  printOnly = false,
}: {
  src?: string | null;
  printOnly?: boolean;
}) {
  if (!src) return null;

  return (
    <div
      aria-hidden="true"
      className={`bill-watermark pointer-events-none ${printOnly ? "hidden print:grid" : "grid"}`}
    >
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src={src} alt="" />
    </div>
  );
}
