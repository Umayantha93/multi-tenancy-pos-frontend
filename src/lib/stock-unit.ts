export const STOCK_UNITS = ["qty", "ml", "l", "g", "kg", "mg", "m", "cm", "pack", "box", "pair", "dozen"] as const;

export type StockUnit = (typeof STOCK_UNITS)[number];

const ALIASES: Record<string, StockUnit> = {
  item: "qty",
  items: "qty",
  qty: "qty",
  quantity: "qty",
  pcs: "qty",
  pc: "qty",
  piece: "qty",
  pieces: "qty",
  nos: "qty",
  no: "qty",
  ml: "ml",
  millilitre: "ml",
  milliliter: "ml",
  millilitres: "ml",
  milliliters: "ml",
  l: "l",
  lt: "l",
  ltr: "l",
  litre: "l",
  liter: "l",
  litres: "l",
  liters: "l",
  g: "g",
  gm: "g",
  gms: "g",
  gram: "g",
  grams: "g",
  kg: "kg",
  kgs: "kg",
  kilo: "kg",
  kilos: "kg",
  kilogram: "kg",
  kilograms: "kg",
  mg: "mg",
  milligram: "mg",
  milligrams: "mg",
  m: "m",
  meter: "m",
  metre: "m",
  meters: "m",
  metres: "m",
  cm: "cm",
  centimeter: "cm",
  centimetre: "cm",
  pack: "pack",
  packs: "pack",
  packet: "pack",
  packets: "pack",
  pkt: "pack",
  box: "box",
  boxes: "box",
  pair: "pair",
  pairs: "pair",
  dozen: "dozen",
  doz: "dozen",
  dz: "dozen",
};

const LABELS: Record<StockUnit, string> = {
  qty: "ITEM",
  ml: "ML",
  l: "L",
  g: "G",
  kg: "KG",
  mg: "MG",
  m: "M",
  cm: "CM",
  pack: "PACK",
  box: "BOX",
  pair: "PAIR",
  dozen: "DOZEN",
};

const MEASURED = new Set<StockUnit>(["ml", "l", "g", "kg", "mg", "m", "cm"]);

export const STOCK_UNIT_OPTIONS = STOCK_UNITS.map((value) => ({ value, label: LABELS[value] }));

export function normalizeStockUnit(unit?: string | null, isPaint = false): StockUnit {
  const value = String(unit || "").toLowerCase().replace(/[.\s]/g, "");
  if (!value) return isPaint ? "ml" : "qty";
  return ALIASES[value] ?? (isPaint ? "ml" : "qty");
}

export function stockUnitLabel(unit?: string | null, isPaint = false): string {
  return LABELS[normalizeStockUnit(unit, isPaint)];
}

export function stockAllowsDecimal(unit?: string | null, isPaint = false): boolean {
  return MEASURED.has(normalizeStockUnit(unit, isPaint));
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

export function sellPriceFromMarkup(cost: number, percent: number): number {
  return Math.round(cost * (1 + percent / 100) * 100) / 100;
}

export type SalePriceLayer = { quantity: number; unitPrice: number };

/** Oldest labelled price first, then the price waiting after that stock is sold. */
export function salePriceLayers(
  quantity: number,
  price: number,
  stockQty: number,
  pendingPrice?: number | string | null,
  pendingAtQty?: number | string | null,
): SalePriceLayer[] {
  const qty = round3(Math.max(0, quantity));
  const current = round2(price);
  const pending = pendingPrice == null || pendingPrice === "" ? null : round2(Number(pendingPrice));
  const threshold = pendingAtQty == null || pendingAtQty === "" ? null : Number(pendingAtQty);
  if (qty <= 0 || pending == null || threshold == null || !Number.isFinite(pending) || !Number.isFinite(threshold)) {
    return [{ quantity: qty, unitPrice: current }];
  }
  const oldLeft = Math.max(0, round3(stockQty - threshold));
  if (oldLeft <= 0.0001) return [{ quantity: qty, unitPrice: pending }];
  if (qty <= oldLeft + 0.0001) return [{ quantity: qty, unitPrice: current }];
  return [
    { quantity: oldLeft, unitPrice: current },
    { quantity: round3(qty - oldLeft), unitPrice: pending },
  ];
}

function round2(value: number): number {
  return Math.round(value * 100) / 100;
}

function round3(value: number): number {
  return Math.round(value * 1000) / 1000;
}
