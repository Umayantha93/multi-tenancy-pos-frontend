import { formatDate } from "@/lib/api";
import type { TranslateFn } from "@/lib/locale";

export function warrantyLabel(
  months?: number | string | null,
  until?: string | null,
  starts?: string | null,
  t?: TranslateFn,
) {
  const count = Number(months || 0);
  const range = starts && until
    ? ` · ${t ? t("common.until_range", { start: formatDate(starts), end: formatDate(until) }) : `${formatDate(starts)} – ${formatDate(until)}`}`
    : until
      ? ` ${t ? t("common.until", { date: formatDate(until) }) : `until ${formatDate(until)}`}`
      : "";
  if (count > 0 && count % 12 === 0) {
    const years = count / 12;
    if (t) {
      return `${t(years === 1 ? "warranty.years_one" : "warranty.years_many", { count: years })}${range}`;
    }
    return `${years} year${years === 1 ? "" : "s"} warranty${range}`;
  }
  if (count > 0) {
    if (t) {
      return `${t(count === 1 ? "warranty.months_one" : "warranty.months_many", { count })}${range}`;
    }
    return `${count} month${count === 1 ? "" : "s"} warranty${range}`;
  }
  if (until) {
    return t ? t("warranty.until_date", { date: formatDate(until) }) : `Warranty until ${formatDate(until)}`;
  }
  return null;
}
