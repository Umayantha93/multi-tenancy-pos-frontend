import { formatDate } from "@/lib/api";

export function warrantyLabel(
  months?: number | string | null,
  until?: string | null,
  starts?: string | null,
) {
  const count = Number(months || 0);
  const range = starts && until
    ? ` · ${formatDate(starts)} – ${formatDate(until)}`
    : until
      ? ` until ${formatDate(until)}`
      : "";
  if (count > 0 && count % 12 === 0) {
    const years = count / 12;
    return `${years} year${years === 1 ? "" : "s"} warranty${range}`;
  }
  if (count > 0) {
    return `${count} month${count === 1 ? "" : "s"} warranty${range}`;
  }
  if (until) return `Warranty until ${formatDate(until)}`;
  return null;
}
