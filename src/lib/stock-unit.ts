export type StockUnit = "qty" | "ml" | "l";

export function normalizeStockUnit(unit?: string | null, isPaint = false): StockUnit {
  if (isPaint) return "ml";
  const value = String(unit || "").toLowerCase().replace(/[.\s]/g, "");
  if (value === "ml" || value === "millilitre" || value === "milliliter" || value === "millilitres" || value === "milliliters") return "ml";
  if (value === "l" || value === "lt" || value === "ltr" || value === "litre" || value === "liter" || value === "litres" || value === "liters") return "l";
  return "qty";
}

export function stockUnitLabel(unit?: string | null, isPaint = false): string {
  const value = normalizeStockUnit(unit, isPaint);
  if (value === "ml") return "ML";
  if (value === "l") return "L";
  return "ITEM";
}

export function stockAllowsDecimal(unit?: string | null, isPaint = false): boolean {
  const value = normalizeStockUnit(unit, isPaint);
  return value === "ml" || value === "l";
}

export function formatStockNumber(qty: number | string, unit?: string | null, isPaint = false): string {
  const n = Number(qty);
  if (!Number.isFinite(n)) return String(qty ?? 0);
  if (!stockAllowsDecimal(unit, isPaint)) return String(Math.round(n));
  return String(Number(n.toFixed(3)));
}

export function formatStockQty(qty: number | string, unit?: string | null, isPaint = false): string {
  return `${formatStockNumber(qty, unit, isPaint)} ${stockUnitLabel(unit, isPaint)}`;
}
