"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { inputClass } from "@/components/ui";
import { money } from "@/lib/api";

export type LaborCatalogItem = {
  id: number;
  name: string;
  hourly_rate: string;
  standard_hours: string;
  standard_price?: string;
  active?: boolean;
};

export type LaborCategory = {
  id: number;
  name: string;
  items: LaborCatalogItem[];
};

export function LaborCatalogPicker({
  categories,
  selectedId,
  onSelect,
  disabled = false,
  placeholder = "Search brakes, clutch, oil change…",
}: {
  categories: LaborCategory[];
  selectedId: string;
  onSelect: (item: LaborCatalogItem | null) => void;
  disabled?: boolean;
  placeholder?: string;
}) {
  const [query, setQuery] = useState("");
  const [open, setOpen] = useState(false);
  const [coords, setCoords] = useState<{ top: number; left: number; width: number } | null>(null);
  const rootRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const listRef = useRef<HTMLDivElement>(null);

  function updateCoords() {
    const el = inputRef.current;
    if (!el) return;
    const rect = el.getBoundingClientRect();
    setCoords({ top: rect.bottom + 4, left: rect.left, width: rect.width });
  }

  useEffect(() => {
    if (!open) return;
    updateCoords();
    function onReposition() {
      updateCoords();
    }
    window.addEventListener("resize", onReposition);
    window.addEventListener("scroll", onReposition, true);
    return () => {
      window.removeEventListener("resize", onReposition);
      window.removeEventListener("scroll", onReposition, true);
    };
  }, [open]);

  useEffect(() => {
    function onPointer(event: MouseEvent) {
      const target = event.target as Node;
      if (rootRef.current?.contains(target) || listRef.current?.contains(target)) return;
      setOpen(false);
    }
    window.addEventListener("mousedown", onPointer);
    return () => window.removeEventListener("mousedown", onPointer);
  }, []);

  const items = useMemo(() => {
    const needle = query.trim().toLowerCase();
    return categories.flatMap((category) =>
      (category.items ?? [])
        .filter((item) => item.active !== false)
        .filter((item) => {
          if (!needle) return true;
          return `${category.name} ${item.name}`.toLowerCase().includes(needle);
        })
        .map((item) => ({ ...item, category: category.name })),
    );
  }, [categories, query]);

  const selected = useMemo(() => {
    for (const category of categories) {
      const match = (category.items ?? []).find((item) => String(item.id) === selectedId);
      if (match) return { ...match, category: category.name };
    }
    return null;
  }, [categories, selectedId]);

  const list = open && coords && typeof document !== "undefined" ? createPortal(
    <div
      ref={listRef}
      style={{ top: coords.top, left: coords.left, width: coords.width }}
      className="fixed z-[200] max-h-64 overflow-y-auto border border-[#d7d3c8] bg-white shadow-[0_12px_28px_rgba(24,27,25,0.16)]"
    >
      {items.length === 0 ? (
        <p className="p-3 text-sm text-[#6f746e]">No matching labor items.</p>
      ) : (
        items.map((item) => (
          <button
            type="button"
            key={item.id}
            onMouseDown={(event) => event.preventDefault()}
            onClick={() => {
              onSelect(item);
              setQuery("");
              setOpen(false);
            }}
            className={`flex w-full items-start justify-between gap-3 border-b border-[#eeeae1] px-3 py-2 text-left text-sm hover:bg-[#f7f5ef] ${
              selectedId === String(item.id) ? "bg-[#167c73]/10" : ""
            }`}
          >
            <span>
              <span className="block text-[10px] font-bold uppercase text-[#6f746e]">{item.category}</span>
              <span className="font-semibold">{item.name}</span>
            </span>
            <span className="shrink-0 text-right text-xs text-[#6f746e]">
              {`${Number(item.standard_hours)}h · ${money(item.standard_price ?? Number(item.hourly_rate) * Number(item.standard_hours))}`}
            </span>
          </button>
        ))
      )}
    </div>,
    document.body,
  ) : null;

  return (
    <div className="relative z-30" ref={rootRef}>
      <label className="block text-xs font-bold uppercase">
        Labor catalog
        <input
          ref={inputRef}
          value={open ? query : (selected ? selected.name : query)}
          disabled={disabled}
          onChange={(event) => {
            setQuery(event.target.value);
            setOpen(true);
            if (selectedId) onSelect(null);
          }}
          onFocus={() => {
            setOpen(true);
            setQuery("");
          }}
          className={`${inputClass} mt-2`}
          placeholder={placeholder}
          autoComplete="off"
        />
      </label>
      {list}
      {selected && !open && (
        <p className="mt-1 text-xs text-[#167c73]">
          {`${selected.category} · ${money(selected.hourly_rate)}/h · standard ${money(selected.standard_price ?? Number(selected.hourly_rate) * Number(selected.standard_hours))}`}
        </p>
      )}
    </div>
  );
}
