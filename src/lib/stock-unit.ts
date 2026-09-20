export type StockUnit = "qty" | "ml" | "l";

export function normalizeStockUnit(unit?: string | null, isPaint = false): StockUnit {
  if (isPaint) return "ml";
  const value = String(unit || "").toLowerCase();
  if (value === "ml") return "ml";
  if (value === "l" || value === "litre" || value === "liter" || value === "litres" || value === "liters") return "l";
  return "qty";
}

export function stockUnitLabel(unit?: string | null, isPaint = false): string {
  const value = normalizeStockUnit(unit, isPaint);
  if (value === "ml") return "ml";
  if (value === "l") return "L";
  return "qty";
}

export function formatStockQty(qty: number | string, unit?: string | null, isPaint = false): string {
  return `${qty} ${stockUnitLabel(unit, isPaint)}`;
}
