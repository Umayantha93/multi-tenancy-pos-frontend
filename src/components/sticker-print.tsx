"use client";

import { FormEvent, useEffect, useLayoutEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { Printer, X } from "lucide-react";
import { buttonClass, inputClass } from "@/components/ui";
import { api, currentUser } from "@/lib/api";
import { code128Svg, stickerPrice } from "@/lib/code128";

export type StickerItem = {
  id?: number;
  name: string;
  price: number | string;
  sku?: string | null;
  barcode?: string | null;
};

type PanelPos = { top: number; left: number; width: number };

function stickerHtml(shop: string, item: StickerItem, copies: number, code: string) {
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

function resolveCode(item: StickerItem) {
  return (item.barcode || item.sku || item.name).slice(0, 22);
}

function clampPanel(anchor: DOMRect, panelHeight = 420): PanelPos {
  const viewW = document.documentElement.clientWidth;
  const viewH = window.innerHeight;
  const pad = 12;
  const width = Math.min(384, viewW - pad * 2);

  // Prefer aligning under the button; on the right edge, pin the panel's right to the button's right.
  const centered = anchor.left + anchor.width / 2 - width / 2;
  const rightAligned = anchor.right - width;
  const preferRight = anchor.left > viewW * 0.55;
  let left = preferRight ? rightAligned : centered;
  left = Math.min(Math.max(pad, left), viewW - width - pad);

  let top = anchor.bottom + 8;
  if (top + panelHeight > viewH - pad) {
    top = anchor.top - panelHeight - 8;
  }
  top = Math.min(Math.max(pad, top), Math.max(pad, viewH - panelHeight - pad));

  return { top, left, width };
}

export function StickerPrintButton({
  item,
  copiesHint,
  onBarcodeAssigned,
}: {
  item: StickerItem;
  copiesHint?: number;
  onBarcodeAssigned?: (barcode: string) => void;
}) {
  const [open, setOpen] = useState(false);
  const [copies, setCopies] = useState(String(copiesHint && copiesHint > 0 ? Math.min(copiesHint, 50) : 1));
  const [printItem, setPrintItem] = useState(item);
  const [ensuring, setEnsuring] = useState(false);
  const [error, setError] = useState("");
  const [panelPos, setPanelPos] = useState<PanelPos | null>(null);
  const [mounted, setMounted] = useState(false);
  const buttonRef = useRef<HTMLButtonElement>(null);
  const panelRef = useRef<HTMLFormElement>(null);
  const shop = currentUser()?.tenant?.business_name || "Shop";

  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    if (open) {
      setCopies(String(copiesHint && copiesHint > 0 ? Math.min(copiesHint, 50) : 1));
      setPrintItem(item);
      setError("");
    } else {
      setPanelPos(null);
    }
  }, [open, copiesHint, item]);

  useLayoutEffect(() => {
    if (!open || !buttonRef.current) return;

    buttonRef.current.scrollIntoView({ block: "nearest", inline: "nearest" });

    function place() {
      if (!buttonRef.current) return;
      const height = panelRef.current?.offsetHeight || 420;
      setPanelPos(clampPanel(buttonRef.current.getBoundingClientRect(), height));
    }

    place();
    const frame = requestAnimationFrame(place);
    window.addEventListener("resize", place);
    window.addEventListener("scroll", place, true);
    return () => {
      cancelAnimationFrame(frame);
      window.removeEventListener("resize", place);
      window.removeEventListener("scroll", place, true);
    };
  }, [open, error, printItem.barcode]);

  async function ensureBarcode(): Promise<StickerItem> {
    if (printItem.barcode?.trim()) return printItem;
    if (!printItem.id) return printItem;
    const updated = await api<StickerItem>(`/parts/${printItem.id}/ensure-barcode`, { method: "POST" });
    const next = { ...printItem, barcode: updated.barcode };
    setPrintItem(next);
    if (updated.barcode) onBarcodeAssigned?.(updated.barcode);
    return next;
  }

  async function printStickers(event: FormEvent) {
    event.preventDefault();
    setEnsuring(true);
    setError("");
    try {
      const ready = await ensureBarcode();
      const code = resolveCode(ready);
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
      doc.write(stickerHtml(shop, ready, count, code));
      doc.close();
      const trigger = () => {
        frame.contentWindow?.focus();
        frame.contentWindow?.print();
        setTimeout(() => frame.remove(), 800);
      };
      setTimeout(trigger, 120);
      setOpen(false);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Could not prepare barcode.");
    } finally {
      setEnsuring(false);
    }
  }

  const previewCode = resolveCode(printItem);

  const dialog = open && mounted
    ? createPortal(
        <div className="fixed inset-0 z-[100]" onClick={() => setOpen(false)}>
          <div className="absolute inset-0 bg-black/45" />
          <form
            ref={panelRef}
            onSubmit={(event) => void printStickers(event)}
            onClick={(event) => event.stopPropagation()}
            style={
              panelPos
                ? { top: panelPos.top, left: panelPos.left, width: panelPos.width }
                : { visibility: "hidden", top: 0, left: 0, width: Math.min(384, document.documentElement.clientWidth - 24) }
            }
            className="fixed max-h-[calc(100vh-1.5rem)] overflow-y-auto bg-[#f3f0e8] p-5 shadow-lg"
          >
            <div className="mb-4 flex items-start justify-between gap-3">
              <div className="min-w-0">
                <h2 className="font-display text-2xl font-semibold uppercase">Print sticker</h2>
                <p className="mt-1 text-xs text-[#6f746e]">Sends a 58×40mm label to the sticker printer. No A4 page.</p>
              </div>
              <button type="button" onClick={() => setOpen(false)} aria-label="Close" className="shrink-0"><X /></button>
            </div>
            <div className="border border-[#d7d3c8] bg-white p-4 text-center text-[#1a2744]">
              <p className="text-sm font-extrabold uppercase tracking-wide">{shop}</p>
              <p className="mt-1 text-2xl font-extrabold">{stickerPrice(printItem.price)}</p>
              <div className="mx-auto mt-2 h-12 w-full max-w-48" dangerouslySetInnerHTML={{ __html: code128Svg(previewCode, 192, 48) }} />
              <p className="mt-1 break-all text-[10px] tracking-widest">{printItem.barcode || printItem.sku || "Will generate"}</p>
              <p className="mt-1 text-xs font-bold uppercase">{printItem.name}</p>
            </div>
            {error && <p className="mt-3 text-xs font-semibold text-[#b84837]">{error}</p>}
            <label className="mt-4 block text-xs font-bold uppercase">
              Copies
              <input name="copies" type="number" min={1} max={99} value={copies} onChange={(event) => setCopies(event.target.value)} className={`${inputClass} mt-2`} />
            </label>
            <button disabled={ensuring} className={`${buttonClass} mt-4 w-full`}>
              <Printer size={16} /> {ensuring ? "Preparing…" : "Print labels"}
            </button>
          </form>
        </div>,
        document.body,
      )
    : null;

  return (
    <>
      <button
        ref={buttonRef}
        type="button"
        onClick={() => setOpen(true)}
        className="flex flex-1 items-center justify-center gap-1.5 py-2 text-[10px] font-bold uppercase text-[#1a2744] hover:bg-[#eeece5]"
      >
        <Printer size={12} /> Sticker
      </button>
      {dialog}
    </>
  );
}
