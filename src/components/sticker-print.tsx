"use client";

import { FormEvent, useEffect, useState } from "react";
import { Printer, X } from "lucide-react";
import { buttonClass, inputClass } from "@/components/ui";
import { currentUser } from "@/lib/api";
import { code128Svg, stickerPrice } from "@/lib/code128";

export type StickerItem = {
  name: string;
  price: number | string;
  sku?: string | null;
  barcode?: string | null;
};

function stickerHtml(shop: string, item: StickerItem, copies: number) {
  const code = (item.barcode || item.sku || item.name).slice(0, 22);
  const svg = code128Svg(code, 240, 52);
  const body = Array.from({ length: copies }, () => `
    <section class="sticker">
      <p class="shop">${escapeHtml(shop)}</p>
      <p class="price">${escapeHtml(stickerPrice(item.price))}</p>
      <div class="barcode">${svg}</div>
      <p class="sku">${escapeHtml(code)}</p>
      <p class="product">${escapeHtml(item.name)}</p>
    </section>
  `).join("");

  return `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8" />
  <title>Sticker</title>
  <style>
    @page { size: 58mm 40mm; margin: 0; }
    * { box-sizing: border-box; }
    html, body { margin: 0; padding: 0; background: #fff; }
    body { font-family: Arial, Helvetica, sans-serif; color: #1a2744; }
    .sticker {
      width: 58mm; height: 40mm; padding: 2.2mm 2.4mm 2mm;
      display: flex; flex-direction: column; align-items: center; justify-content: space-between;
      text-align: center; page-break-after: always; break-after: page;
    }
    .sticker:last-child { page-break-after: auto; break-after: auto; }
    .shop { margin: 0; font-size: 11pt; font-weight: 800; letter-spacing: 0.04em; text-transform: uppercase; line-height: 1.05; }
    .price { margin: 0; font-size: 16pt; font-weight: 800; line-height: 1; }
    .barcode { width: 48mm; height: 12mm; }
    .barcode svg { width: 100%; height: 100%; display: block; }
    .sku { margin: 0; font-size: 6.5pt; letter-spacing: 0.08em; }
    .product { margin: 0; font-size: 8pt; font-weight: 700; text-transform: uppercase; line-height: 1.1; max-height: 8mm; overflow: hidden; }
  </style>
</head>
<body>${body}</body>
</html>`;
}

function escapeHtml(value: string) {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;");
}

export function StickerPrintButton({ item, copiesHint }: { item: StickerItem; copiesHint?: number }) {
  const [open, setOpen] = useState(false);
  const [copies, setCopies] = useState(String(copiesHint && copiesHint > 0 ? Math.min(copiesHint, 50) : 1));
  const shop = currentUser()?.tenant?.business_name || "Shop";

  useEffect(() => {
    if (open) setCopies(String(copiesHint && copiesHint > 0 ? Math.min(copiesHint, 50) : 1));
  }, [open, copiesHint]);

  function printStickers(event: FormEvent) {
    event.preventDefault();
    const count = Math.max(1, Math.min(99, Number(copies) || 1));
    const frame = document.createElement("iframe");
    frame.setAttribute("aria-hidden", "true");
    frame.style.position = "fixed";
    frame.style.right = "0";
    frame.style.bottom = "0";
    frame.style.width = "0";
    frame.style.height = "0";
    frame.style.border = "0";
    document.body.appendChild(frame);
    const doc = frame.contentDocument;
    if (!doc) {
      frame.remove();
      return;
    }
    doc.open();
    doc.write(stickerHtml(shop, item, count));
    doc.close();
    const trigger = () => {
      frame.contentWindow?.focus();
      frame.contentWindow?.print();
      setTimeout(() => frame.remove(), 800);
    };
    setTimeout(trigger, 120);
    setOpen(false);
  }

  return (
    <>
      <button type="button" onClick={() => setOpen(true)} className="flex flex-1 items-center justify-center gap-1.5 py-2 text-[10px] font-bold uppercase text-[#1a2744] hover:bg-[#eeece5]">
        <Printer size={12} /> Sticker
      </button>
      {open && (
        <div className="fixed inset-0 z-50 grid place-items-center bg-black/55 p-4" onClick={() => setOpen(false)}>
          <form onSubmit={printStickers} onClick={(event) => event.stopPropagation()} className="w-full max-w-sm bg-[#f3f0e8] p-5">
            <div className="mb-4 flex items-start justify-between">
              <div>
                <h2 className="font-display text-2xl font-semibold uppercase">Print sticker</h2>
                <p className="mt-1 text-xs text-[#6f746e]">Sends a 58×40mm label to the sticker printer. No A4 page.</p>
              </div>
              <button type="button" onClick={() => setOpen(false)} aria-label="Close"><X /></button>
            </div>
            <div className="border border-[#d7d3c8] bg-white p-4 text-center text-[#1a2744]">
              <p className="text-sm font-extrabold uppercase tracking-wide">{shop}</p>
              <p className="mt-1 text-2xl font-extrabold">{stickerPrice(item.price)}</p>
              <div className="mx-auto mt-2 h-12 w-48" dangerouslySetInnerHTML={{ __html: code128Svg(item.barcode || item.sku || item.name, 192, 48) }} />
              <p className="mt-1 text-[10px] tracking-widest">{item.barcode || item.sku || "—"}</p>
              <p className="mt-1 text-xs font-bold uppercase">{item.name}</p>
            </div>
            <label className="mt-4 block text-xs font-bold uppercase">
              Copies
              <input name="copies" type="number" min={1} max={99} value={copies} onChange={(event) => setCopies(event.target.value)} className={`${inputClass} mt-2`} />
            </label>
            <button className={`${buttonClass} mt-4 w-full`}><Printer size={16} /> Print labels</button>
          </form>
        </div>
      )}
    </>
  );
}
