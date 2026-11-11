"use client";

import { FormEvent, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { LayoutGrid, Monitor, PackageSearch, Plus, ScanBarcode, Search, ShoppingCart, Trash2, X } from "lucide-react";
import { api, currentBranch, currentFeatures, currentUser, mediaUrl, money, storeSession, type SessionPayload, type User } from "@/lib/api";

type Product = {
  id: number;
  name: string;
  sku: string | null;
  barcode?: string | null;
  category: string | null;
  size: string | null;
  color: string | null;
  badge?: string | null;
  price: string;
  cost_price?: string;
  stock_qty: number;
  image_urls?: string[];
};

type Customer = { id: number; name: string; phone: string | null; is_vip?: boolean };

type Insights = {
  worth: number;
  income: number;
  profit: number;
  today_sales: number;
  today_profit: number;
  today_bills: number;
};

type CartLine = {
  id: number;
  name: string;
  detail: string;
  price: number;
  quantity: number;
  realStock: number;
};

type Held = { id: string; label: string; lines: CartLine[]; customerId: number | null; percent: number };

const CATEGORIES = ["All", "Men", "Women", "Kids", "Accessories", "Footwear", "Sale"];
const DISCOUNTS = [0, 5, 10, 15];
const METHODS = [
  { id: "cash", label: "Cash" },
  { id: "card", label: "Card" },
  { id: "qr", label: "QR" },
  { id: "credit", label: "Credit" },
] as const;

function round2(value: number) {
  return Math.round(value * 100) / 100;
}

const SIZE_ORDER = ["XS", "S", "M", "L", "XL", "XXL", "28", "30", "32", "34", "36", "38", "40", "42", "EU 39", "EU 40", "EU 41", "EU 42", "EU 43", "One"];

function styleKey(product: { name: string; color: string | null; category: string | null }) {
  return `${product.name}||${product.color || ""}||${product.category || ""}`;
}

function sizeRank(size: string) {
  const at = SIZE_ORDER.indexOf(size);
  return at < 0 ? 1000 : at;
}

function tone(category: string | null) {
  if (category === "Women") return "from-[#4a2a40] to-[#1a1018]";
  if (category === "Kids") return "from-[#1f3d32] to-[#101814]";
  if (category === "Accessories") return "from-[#3d3420] to-[#16130e]";
  if (category === "Footwear") return "from-[#2c2644] to-[#12101a]";
  return "from-[#243044] to-[#10151f]";
}

function badgeClass(badge: string) {
  if (badge === "SALE") return "bg-rose-500";
  if (badge === "CLEARANCE") return "bg-amber-500 text-black";
  if (badge === "TRENDING") return "bg-sky-500";
  return "bg-violet-500";
}

export default function ClothingFloorPage() {
  const router = useRouter();
  const [ready, setReady] = useState(false);
  const [allowed, setAllowed] = useState(false);
  const [displayOn, setDisplayOn] = useState(false);
  const [products, setProducts] = useState<Product[]>([]);
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [insights, setInsights] = useState<Insights | null>(null);
  const [search, setSearch] = useState("");
  const [scan, setScan] = useState("");
  const [category, setCategory] = useState("All");
  const [cart, setCart] = useState<CartLine[]>([]);
  const [customerId, setCustomerId] = useState<number | null>(null);
  const [percent, setPercent] = useState(0);
  const [method, setMethod] = useState<(typeof METHODS)[number]["id"]>("cash");
  const [tendered, setTendered] = useState("");
  const [sizePick, setSizePick] = useState<Record<string, string>>({});
  const [held, setHeld] = useState<Held[]>([]);
  const [heldOpen, setHeldOpen] = useState(false);
  const [stockOpen, setStockOpen] = useState(false);
  const [stockQuery, setStockQuery] = useState("");
  const [customerOpen, setCustomerOpen] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [saving, setSaving] = useState(false);
  const [now, setNow] = useState<Date | null>(null);
  const [user, setUser] = useState<User | null>(null);
  const branch = ready ? currentBranch() : null;

  useEffect(() => {
    if (!localStorage.getItem("garage_token")) {
      router.replace("/login");
      return;
    }
    const cached = currentUser();
    setUser(cached);
    setAllowed(cached?.tenant?.business_type === "clothing");
    setDisplayOn(currentFeatures().includes("customer_display"));
    setReady(true);
    api<SessionPayload>("/user")
      .then((result) => {
        const token = localStorage.getItem("garage_token");
        if (token) {
          storeSession(token, result.user, result.features, {
            branches: result.branches,
            active_branch: result.active_branch,
          });
        }
        setUser(result.user);
        setAllowed(result.user.tenant?.business_type === "clothing");
        setDisplayOn(result.features.includes("customer_display"));
      })
      .catch(() => undefined);
    try {
      const raw = localStorage.getItem("clothing_held_carts");
      if (raw) setHeld(JSON.parse(raw) as Held[]);
    } catch {
      setHeld([]);
    }
  }, [router]);

  useEffect(() => {
    const tick = () => setNow(new Date());
    tick();
    const id = window.setInterval(tick, 1000);
    return () => window.clearInterval(id);
  }, []);

  function loadFloor() {
    Promise.all([
      api<{ data: Product[] }>("/products?active_only=1&per_page=500", { cache: "no-store" }),
      api<{ data: Customer[] }>("/customers?per_page=100"),
      api<Insights>("/clothing/insights"),
    ]).then(([catalog, people, figures]) => {
      setProducts(catalog.data);
      setCustomers(people.data);
      setInsights(figures);
    }).catch((caught) => setError(caught instanceof Error ? caught.message : "Unable to load the floor."));
  }

  useEffect(() => {
    if (!allowed) return;
    loadFloor();
  }, [allowed]);

  const customer = customers.find((row) => row.id === customerId) ?? null;
  const vipPercent = customer?.is_vip ? 10 : 0;
  const discountPercent = Math.max(percent, vipPercent);

  const cards = useMemo(() => {
    const query = search.trim().toLowerCase();
    const groups = new Map<string, Product[]>();
    for (const product of products) {
      const onSale = product.badge === "SALE" || product.badge === "CLEARANCE";
      if (category === "Sale" && !onSale) continue;
      if (category !== "All" && category !== "Sale" && product.category !== category) continue;
      const haystack = [product.name, product.sku, product.barcode, product.category, product.color, product.size].filter(Boolean).join(" ").toLowerCase();
      if (query && !haystack.includes(query)) continue;
      const key = styleKey(product);
      const list = groups.get(key) ?? [];
      list.push(product);
      groups.set(key, list);
    }
    return [...groups.entries()].map(([key, variants]) => ({
      key,
      name: variants[0].name,
      category: variants[0].category,
      color: variants[0].color,
      badge: variants.find((row) => row.badge)?.badge ?? null,
      image: variants.find((row) => row.image_urls?.[0])?.image_urls?.[0] ?? null,
      variants: [...variants].sort((a, b) => sizeRank(a.size || "") - sizeRank(b.size || "")),
    }));
  }, [products, search, category]);

  const subtotal = round2(cart.reduce((sum, line) => sum + line.price * line.quantity, 0));
  const discount = round2(subtotal * discountPercent / 100);
  const taxable = round2(Math.max(0, subtotal - discount));
  const vatRate = user?.tenant?.vat_registered ? Number(user.tenant.vat_rate || 0) : 0;
  const ssclRate = user?.tenant?.sscl_registered ? Number(user.tenant.sscl_rate || 0) : 0;
  const tax = round2(taxable * ((vatRate + ssclRate) / 100));
  const total = round2(taxable + tax);
  const taxLabel = [
    vatRate > 0 ? `VAT ${vatRate}%` : "",
    ssclRate > 0 ? `SSCL ${ssclRate}%` : "",
  ].filter(Boolean).join(" + ") || "Tax";

  const snapshot = useMemo(() => ({
    lines: cart.map((line) => ({
      name: line.name,
      detail: line.detail,
      quantity: line.quantity,
      unit_price: line.price,
      line_total: round2(line.price * line.quantity),
    })),
    customer_name: customer ? `${customer.name}${customer.is_vip ? " (VIP)" : ""}` : "Walk-in Customer",
    discount,
    subtotal,
    tax,
    total,
  }), [cart, customer, discount, subtotal, tax, total]);

  useEffect(() => {
    if (!displayOn || !allowed) return;
    const handle = window.setTimeout(() => {
      api("/clothing/display", { method: "PUT", body: JSON.stringify(snapshot) }).catch(() => undefined);
    }, 250);
    return () => window.clearTimeout(handle);
  }, [snapshot, displayOn, allowed]);

  function shownStock(product: Product) {
    return Math.max(0, Number(product.stock_qty) || 0);
  }

  function add(product: Product) {
    const shown = shownStock(product);
    if (shown < 1) return;
    setCart((lines) => {
      const existing = lines.find((line) => line.id === product.id);
      if (existing) {
        if (existing.quantity >= shown) return lines;
        return lines.map((line) => line.id === product.id ? { ...line, quantity: line.quantity + 1 } : line);
      }
      return [...lines, {
        id: product.id,
        name: product.name,
        detail: [product.size, product.color].filter(Boolean).join(" · "),
        price: Number(product.price),
        quantity: 1,
        realStock: product.stock_qty,
      }];
    });
  }

  function onScan(event: FormEvent) {
    event.preventDefault();
    const code = scan.trim().toLowerCase();
    if (!code) return;
    const matches = products.filter((product) => product.barcode?.toLowerCase() === code || product.sku?.toLowerCase() === code);
    if (matches.length === 0) {
      setError("No garment matches that code.");
      return;
    }
    const key = styleKey(matches[0]);
    const picked = matches.find((product) => String(product.id) === sizePick[key]);
    const hit = picked || matches.find((product) => shownStock(product) > 0) || matches[0];
    if (shownStock(hit) < 1) {
      setError(`${hit.size || "That size"} is out of stock.`);
      return;
    }
    setError("");
    setSizePick((picks) => ({ ...picks, [key]: String(hit.id) }));
    add(hit);
    setScan("");
  }

  function holdCart() {
    if (cart.length === 0) return;
    const next = [{
      id: String(Date.now()),
      label: customer?.name || "Walk-in",
      lines: cart,
      customerId,
      percent,
    }, ...held].slice(0, 12);
    setHeld(next);
    localStorage.setItem("clothing_held_carts", JSON.stringify(next));
    setCart([]);
    setHeldOpen(false);
  }

  function restore(heldCart: Held) {
    setCart(heldCart.lines);
    setCustomerId(heldCart.customerId);
    setPercent(heldCart.percent);
    const next = held.filter((row) => row.id !== heldCart.id);
    setHeld(next);
    localStorage.setItem("clothing_held_carts", JSON.stringify(next));
    setHeldOpen(false);
  }

  async function saveCustomer(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    try {
      const created = await api<Customer>("/customers", {
        method: "POST",
        body: JSON.stringify({
          name: form.get("name"),
          phone: form.get("phone"),
          is_vip: form.get("is_vip") === "on",
        }),
      });
      setCustomers((rows) => [created, ...rows.filter((row) => row.id !== created.id)]);
      setCustomerId(created.id);
      setCustomerOpen(false);
      setError("");
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Unable to save the customer.");
    }
  }

  async function checkout() {
    if (cart.length === 0 || saving) return;
    const handed = Number(tendered);
    if (method === "cash" && tendered.trim() !== "" && (!Number.isFinite(handed) || handed + 0.009 < total)) {
      setError("Cash received is less than the total.");
      return;
    }
    setSaving(true);
    setError("");
    try {
      const sale = await api<{ change?: number | string }>("/retail-sales", {
        method: "POST",
        body: JSON.stringify({
          customer_name: customer?.name || null,
          customer_phone: customer?.phone || null,
          discount: discount || null,
          payment_method: method,
          cash_tendered: method === "cash" && tendered.trim() !== "" ? handed : null,
          items: cart.map((line) => ({ product_id: line.id, quantity: line.quantity })),
        }),
      });
      const balance = round2(Number(sale.change || 0));
      setProducts((rows) => rows.map((product) => {
        const sold = cart.find((line) => line.id === product.id);
        return sold ? { ...product, stock_qty: Math.max(0, Number(product.stock_qty) - sold.quantity) } : product;
      }));
      setCart([]);
      setPercent(0);
      setTendered("");
      setNotice(method === "credit" ? "Sale saved on credit." : balance > 0 ? `Sale completed. Balance ${money(balance)}.` : "Sale completed.");
      window.setTimeout(() => setNotice(""), balance > 0 ? 12000 : 2500);
      loadFloor();
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Unable to complete the sale.");
    } finally {
      setSaving(false);
    }
  }

  if (!ready) return <main className="min-h-screen bg-[#070b14]" />;
  if (!allowed) {
    return (
      <main className="grid min-h-screen place-items-center bg-[#070b14] text-white">
        <div className="text-center">
          <p className="text-lg font-semibold">This floor is for clothing shops.</p>
          <Link href="/dashboard" className="mt-4 inline-block text-sm text-violet-300">Back to the office</Link>
        </div>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-[#070b14] text-white">
      <header className="flex flex-wrap items-center gap-2 border-b border-white/10 px-4 py-3">
        <Link href="/dashboard" className="mr-1 grid size-9 place-items-center rounded-xl bg-violet-600" title="Office">
          <LayoutGrid size={16} />
        </Link>
        <div className="mr-2 min-w-0">
          <p className="truncate text-sm font-semibold tracking-wide">{user?.tenant?.business_name || "Clothing"}</p>
          <p className="text-[10px] uppercase tracking-[0.18em] text-white/45">Fashion floor</p>
        </div>
        <span className="rounded-full border border-white/10 bg-white/5 px-3 py-1 text-xs text-white/80">{branch?.name || "Main shop"}</span>
        <span className="rounded-full border border-emerald-400/30 bg-emerald-400/10 px-3 py-1 text-xs text-emerald-200">
          Today {money(insights?.today_sales ?? 0)} ({insights?.today_bills ?? 0})
        </span>
        <span className="rounded-full border border-white/10 bg-white/5 px-3 py-1 text-xs text-white/80">
          Profit {money(insights?.today_profit ?? 0)}
        </span>
        <div className="relative">
          <button type="button" onClick={() => setHeldOpen((open) => !open)} className="rounded-full border border-white/10 px-3 py-1 text-xs text-white/80">
            Held carts{held.length ? ` (${held.length})` : ""}
          </button>
          {heldOpen && (
            <div className="absolute left-0 z-20 mt-2 w-64 rounded-xl border border-white/10 bg-[#121826] p-2 shadow-xl">
              <button type="button" onClick={holdCart} disabled={cart.length === 0} className="w-full rounded-lg px-2 py-2 text-left text-xs hover:bg-white/5 disabled:opacity-40">Hold current cart</button>
              {held.map((row) => (
                <button key={row.id} type="button" onClick={() => restore(row)} className="flex w-full items-center justify-between rounded-lg px-2 py-2 text-left text-xs hover:bg-white/5">
                  <span>{row.label}</span>
                  <span className="text-white/45">{row.lines.length} lines</span>
                </button>
              ))}
              {held.length === 0 && <p className="px-2 py-2 text-xs text-white/40">No held carts.</p>}
            </div>
          )}
        </div>
        <button type="button" onClick={() => { setStockQuery(""); setStockOpen(true); }} className="rounded-full border border-white/10 px-3 py-1 text-xs text-white/80">Stock status</button>
        {displayOn && (
          <button
            type="button"
            onClick={() => window.open("/clothing/display", "clothing-customer-display", "noopener,width=1280,height=800")}
            className="inline-flex items-center gap-1 rounded-full border border-white/10 px-3 py-1 text-xs text-white/80"
          >
            <Monitor size={12} /> Customer screen
          </button>
        )}
        <div className="ml-auto text-right text-xs text-white/55">
          <p>{now ? now.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }) : ""}</p>
          <p className="text-white/80">{user?.name}</p>
        </div>
      </header>

      <div className="grid gap-4 p-4 xl:grid-cols-[minmax(0,1fr)_460px]">
        <section>
          <div className="flex flex-wrap gap-2">
            <label className="relative min-w-56 flex-1">
              <PackageSearch className="absolute left-3 top-1/2 -translate-y-1/2 text-white/35" size={16} />
              <input
                value={search}
                onChange={(event) => setSearch(event.target.value)}
                placeholder="Search by garment, tag, SKU or code"
                className="h-11 w-full rounded-xl border border-white/10 bg-[#101624] pl-10 pr-3 text-sm outline-none placeholder:text-white/30"
              />
            </label>
            <form onSubmit={onScan} className="flex min-w-56 flex-1 gap-2">
              <label className="relative flex-1">
                <ScanBarcode className="absolute left-3 top-1/2 -translate-y-1/2 text-white/35" size={16} />
                <input
                  value={scan}
                  onChange={(event) => setScan(event.target.value)}
                  placeholder="Scan barcode"
                  className="h-11 w-full rounded-xl border border-white/10 bg-[#101624] pl-10 pr-3 text-sm outline-none placeholder:text-white/30"
                />
              </label>
              <button className="h-11 rounded-xl bg-white/10 px-4 text-sm">Scan</button>
            </form>
          </div>
          <div className="mt-3 flex flex-wrap gap-2">
            {CATEGORIES.map((item) => (
              <button
                key={item}
                type="button"
                onClick={() => setCategory(item)}
                className={`rounded-full px-3 py-1 text-xs ${category === item ? "bg-violet-600" : "bg-white/5 text-white/70"}`}
              >
                {item}
              </button>
            ))}
          </div>
          {error && <p className="mt-3 rounded-lg bg-rose-500/15 px-3 py-2 text-sm text-rose-200">{error}</p>}
          <div className="mt-4 grid gap-2 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 2xl:grid-cols-5">
            {cards.map((card) => {
              const picked = card.variants.find((row) => String(row.id) === sizePick[card.key]);
              const variant = picked || card.variants.find((row) => shownStock(row) > 0) || card.variants[0];
              const qty = shownStock(variant);
              return (
                <article key={card.key} className="overflow-hidden rounded-xl border border-white/10 bg-[#101624]">
                  <div className={`relative aspect-[5/4] bg-gradient-to-b ${tone(card.category)}`}>
                    {card.image && <GarmentPhoto src={card.image} name={card.name} />}
                    {card.badge && <span className={`absolute left-3 top-3 rounded-full px-2 py-1 text-[10px] font-bold uppercase ${badgeClass(card.badge)}`}>{card.badge}</span>}
                    <span className={`absolute right-3 top-3 rounded-full bg-black/50 px-2 py-1 text-[10px] font-semibold ${qty < 10 ? "text-rose-300" : "text-emerald-300"}`}>Qty: {qty}</span>
                  </div>
                  <div className="p-2">
                    <p className="truncate text-xs font-semibold">{card.name}</p>
                    <p className="mt-0.5 text-[11px] text-white/40">{[card.category, card.color].filter(Boolean).join(" · ")}</p>
                    <div className="mt-2 flex flex-wrap gap-1">
                      {card.variants.map((row) => {
                        const rowQty = shownStock(row);
                        const selected = row.id === variant.id;
                        return (
                          <button
                            key={row.id}
                            type="button"
                            onClick={() => setSizePick((picks) => ({ ...picks, [card.key]: String(row.id) }))}
                            className={`rounded-md px-1.5 py-0.5 text-[10px] ${selected ? "bg-white text-black" : rowQty < 1 ? "bg-white/5 text-white/30" : "bg-white/10 text-white/70"}`}
                          >
                            {row.size || "One"}
                          </button>
                        );
                      })}
                    </div>
                    <div className="mt-3 flex items-center justify-between">
                      <strong className="text-sm">{money(variant.price)}</strong>
                      <button
                        type="button"
                        disabled={qty < 1}
                        onClick={() => add(variant)}
                        className="grid size-8 place-items-center rounded-full bg-violet-600 disabled:opacity-30"
                        aria-label={`Add ${card.name}`}
                      >
                        <Plus size={16} />
                      </button>
                    </div>
                  </div>
                </article>
              );
            })}
          </div>
          {cards.length === 0 && <p className="mt-10 text-center text-sm text-white/40">No garments match.</p>}
        </section>

        <aside className="h-fit rounded-2xl border border-white/10 bg-[#0d1320] p-4 xl:sticky xl:top-4">
          <div className="flex gap-2">
            <select
              value={customerId ?? ""}
              onChange={(event) => setCustomerId(event.target.value ? Number(event.target.value) : null)}
              className="h-11 min-w-0 flex-1 rounded-xl border border-white/10 bg-[#101624] px-3 text-sm"
            >
              <option value="">Walk-in Customer (Guest)</option>
              {customers.map((row) => (
                <option key={row.id} value={row.id}>{row.name}{row.is_vip ? " (VIP - 10%)" : ""}</option>
              ))}
            </select>
            <button type="button" onClick={() => setCustomerOpen(true)} className="inline-flex h-11 items-center gap-1 rounded-xl bg-white/10 px-3 text-sm">
              <Plus size={14} /> New
            </button>
          </div>

          <div className="mt-6 min-h-40">
            {cart.length === 0 ? (
              <div className="grid place-items-center py-10 text-center text-white/40">
                <ShoppingCart size={36} />
                <p className="mt-3 text-sm font-medium text-white/70">Current cart is empty</p>
                <p className="mt-1 max-w-56 text-xs">Click any garment or scan a barcode to add it.</p>
              </div>
            ) : (
              <div className="space-y-3">
                {cart.map((line) => {
                  const product = products.find((row) => row.id === line.id);
                  const cap = product ? shownStock(product) : line.realStock;
                  return (
                    <div key={line.id} className="flex items-start gap-2 text-sm">
                      <div className="min-w-0 flex-1">
                        <p className="truncate font-medium">{line.name}</p>
                        <p className="text-[11px] text-white/40">{line.detail} · {money(line.price)}</p>
                      </div>
                      <input
                        type="number"
                        min={1}
                        max={Math.max(1, cap)}
                        value={line.quantity}
                        onChange={(event) => {
                          const quantity = Math.min(Math.max(1, Number(event.target.value) || 1), Math.max(1, cap));
                          setCart((lines) => lines.map((row) => row.id === line.id ? { ...row, quantity } : row));
                        }}
                        className="h-8 w-14 rounded-lg border border-white/10 bg-transparent text-center text-xs"
                      />
                      <strong className="w-20 text-right text-xs">{money(line.price * line.quantity)}</strong>
                      <button type="button" onClick={() => setCart((lines) => lines.filter((row) => row.id !== line.id))} className="text-rose-300" aria-label="Remove">
                        <Trash2 size={14} />
                      </button>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          <p className="mt-4 text-[10px] font-semibold uppercase tracking-wide text-white/40">Quick discount</p>
          <div className="mt-2 grid grid-cols-4 gap-2">
            {DISCOUNTS.map((value) => (
              <button
                key={value}
                type="button"
                onClick={() => setPercent(value)}
                className={`h-9 rounded-lg text-xs ${percent === value ? "bg-violet-600" : "bg-white/5 text-white/70"}`}
              >
                {value === 0 ? "None" : `${value}%`}
              </button>
            ))}
          </div>
          {vipPercent > 0 && percent < vipPercent && <p className="mt-2 text-[11px] text-violet-200">VIP 10% is applied.</p>}

          <dl className="mt-4 space-y-1 text-sm text-white/60">
            <div className="flex justify-between"><dt>Subtotal ({cart.reduce((sum, line) => sum + line.quantity, 0)} items)</dt><dd>{money(subtotal)}</dd></div>
            {discount > 0 && <div className="flex justify-between text-emerald-300"><dt>Discount</dt><dd>-{money(discount)}</dd></div>}
            {(vatRate > 0 || ssclRate > 0) && <div className="flex justify-between"><dt>{taxLabel}</dt><dd>{money(tax)}</dd></div>}
            <div className="flex items-end justify-between pt-2 text-white">
              <dt className="text-xs uppercase tracking-wide text-white/50">Grand total</dt>
              <dd className="text-2xl font-semibold">{money(total)}</dd>
            </div>
          </dl>

          <div className="mt-4 grid grid-cols-4 gap-2">
            {METHODS.map((item) => (
              <button
                key={item.id}
                type="button"
                onClick={() => {
                  setMethod(item.id);
                  if (item.id !== "cash") setTendered("");
                }}
                className={`h-12 rounded-xl text-xs ${method === item.id ? "border border-violet-400 bg-violet-600/20" : "bg-white/5 text-white/70"}`}
              >
                {item.label}
              </button>
            ))}
          </div>
          {method === "cash" && total > 0 && (
            <CashTender total={total} tendered={tendered} onChange={setTendered} />
          )}
          {notice && <p className="mt-3 text-sm text-emerald-300">{notice}</p>}
          <button
            type="button"
            disabled={saving || cart.length === 0 || (method === "cash" && tendered.trim() !== "" && Number(tendered) + 0.009 < total)}
            onClick={checkout}
            className="mt-3 h-12 w-full rounded-xl bg-emerald-500 text-sm font-semibold text-black disabled:opacity-40"
          >
            {saving ? "Saving..." : method === "credit" ? `Save on credit (${money(total)})` : `Pay & complete (${money(total)})`}
          </button>
        </aside>
      </div>

      {stockOpen && (
        <div className="fixed inset-0 z-30 grid place-items-center bg-black/60 p-4" onClick={() => setStockOpen(false)}>
          <div className="flex h-[80vh] w-full max-w-3xl flex-col overflow-hidden rounded-2xl border border-white/10 bg-[#101624]" onClick={(event) => event.stopPropagation()}>
            <div className="flex shrink-0 items-center justify-between px-5 py-4">
              <h2 className="text-sm font-semibold">Stock status overview</h2>
              <button type="button" onClick={() => setStockOpen(false)} aria-label="Close"><X size={16} /></button>
            </div>
            <label className="relative mx-5 mb-3 block shrink-0">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-white/35" size={14} />
              <input
                value={stockQuery}
                onChange={(event) => setStockQuery(event.target.value)}
                placeholder="Search name, size, SKU or category"
                aria-label="Search stock"
                className="h-10 w-full rounded-xl border border-white/10 bg-[#070b14] pl-9 pr-9 text-sm outline-none placeholder:text-white/30"
              />
              {stockQuery && (
                <button
                  type="button"
                  onClick={() => setStockQuery("")}
                  aria-label="Clear search"
                  className="absolute right-2 top-1/2 grid size-6 -translate-y-1/2 place-items-center text-white/50 hover:text-white"
                >
                  <X size={14} />
                </button>
              )}
            </label>
            <div className="min-h-0 flex-1 overflow-auto">
              <table className="w-full text-left text-sm">
                <thead className="text-[10px] uppercase tracking-wide text-white/40">
                  <tr>
                    <th className="px-5 py-2">Code</th>
                    <th className="py-2">Garment</th>
                    <th className="py-2">Size</th>
                    <th className="py-2">Category</th>
                    <th className="py-2">Stock</th>
                    <th className="px-5 py-2 text-right">Unit price</th>
                  </tr>
                </thead>
                <tbody>
                  {products.filter((product) => {
                    const needle = stockQuery.trim().toLowerCase();
                    if (!needle) return true;
                    return [product.name, product.sku, product.barcode, product.category, product.color, product.size].filter(Boolean).join(" ").toLowerCase().includes(needle);
                  }).map((product) => {
                    const qty = shownStock(product);
                    return (
                      <tr key={product.id} className="border-t border-white/5">
                        <td className="px-5 py-2.5 text-white/70">{product.sku || "—"}</td>
                        <td className="py-2.5">{product.name}</td>
                        <td className="py-2.5">{product.size || "One"}</td>
                        <td className="py-2.5 text-white/60">{product.category || "—"}</td>
                        <td className={`py-2.5 font-semibold ${qty < 10 ? "text-rose-400" : "text-emerald-400"}`}>{qty} units</td>
                        <td className="px-5 py-2.5 text-right">{money(product.price)}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
              {products.filter((product) => {
                const needle = stockQuery.trim().toLowerCase();
                if (!needle) return true;
                return [product.name, product.sku, product.barcode, product.category, product.color, product.size].filter(Boolean).join(" ").toLowerCase().includes(needle);
              }).length === 0 && <p className="px-5 py-6 text-sm text-white/40">No garments match that search.</p>}
            </div>
          </div>
        </div>
      )}

      {customerOpen && (
        <div className="fixed inset-0 z-30 grid place-items-center bg-black/60 p-4">
          <form onSubmit={saveCustomer} className="w-full max-w-md rounded-2xl border border-white/10 bg-[#101624] p-5">
            <div className="flex items-center justify-between">
              <h2 className="text-sm font-semibold">Add new retail customer</h2>
              <button type="button" onClick={() => setCustomerOpen(false)} aria-label="Close"><X size={16} /></button>
            </div>
            <label className="mt-4 block text-xs text-white/60">
              Full name
              <input name="name" required placeholder="e.g. Jessica Alba" className="mt-1 h-11 w-full rounded-xl border border-white/10 bg-[#070b14] px-3 text-sm text-white" />
            </label>
            <label className="mt-3 block text-xs text-white/60">
              Phone number
              <input name="phone" required placeholder="0771234567" className="mt-1 h-11 w-full rounded-xl border border-white/10 bg-[#070b14] px-3 text-sm text-white" />
            </label>
            <label className="mt-4 flex items-center gap-2 text-sm">
              <input name="is_vip" type="checkbox" className="size-4 accent-violet-500" />
              Register as VIP member (automatic 10% discount)
            </label>
            <div className="mt-5 flex justify-end gap-2">
              <button type="button" onClick={() => setCustomerOpen(false)} className="h-10 rounded-xl bg-white/10 px-4 text-sm">Cancel</button>
              <button className="h-10 rounded-xl bg-violet-600 px-4 text-sm font-semibold">Save & select</button>
            </div>
          </form>
        </div>
      )}
    </main>
  );
}

function roundUp(amount: number, step: number) {
  const stepCents = Math.round(step * 100);
  return (Math.ceil(Math.round(amount * 100) / stepCents) * stepCents) / 100;
}

function CashTender({ total, tendered, onChange }: { total: number; tendered: string; onChange: (value: string) => void }) {
  const handed = Number(tendered);
  const hasAmount = tendered.trim() !== "" && Number.isFinite(handed);
  const short = hasAmount && handed + 0.009 < total ? round2(total - handed) : 0;
  const balance = hasAmount && short === 0 ? round2(handed - total) : 0;
  const quick = [1000, 5000]
    .map((step) => roundUp(total, step))
    .filter((amount, index, list) => amount > total + 0.009 && list.indexOf(amount) === index);

  return (
    <div className="mt-3 rounded-xl border border-white/10 bg-white/5 p-3">
      <label className="block text-[10px] font-semibold uppercase tracking-wide text-white/40">
        Cash received
        <input
          type="number"
          min="0"
          step="0.01"
          inputMode="decimal"
          value={tendered}
          onChange={(event) => onChange(event.target.value)}
          placeholder={total.toFixed(2)}
          aria-label="Cash received"
          className="mt-1 h-11 w-full rounded-xl border border-white/10 bg-[#070b14] px-3 text-sm text-white outline-none"
        />
      </label>
      <div className="mt-2 flex flex-wrap gap-2">
        <button type="button" onClick={() => onChange(total.toFixed(2))} className="h-8 rounded-lg bg-white/10 px-3 text-xs">Exact</button>
        {quick.map((amount) => (
          <button key={amount} type="button" onClick={() => onChange(amount.toFixed(2))} className="h-8 rounded-lg bg-white/10 px-3 text-xs">
            {money(amount)}
          </button>
        ))}
      </div>
      {short > 0 && <p className="mt-3 text-sm font-semibold text-rose-300">Short by {money(short)}</p>}
      {hasAmount && short === 0 && (
        <div className="mt-3 flex items-end justify-between text-white">
          <span className="text-xs uppercase tracking-wide text-white/50">Balance</span>
          <span className="text-2xl font-semibold text-emerald-300">{money(balance)}</span>
        </div>
      )}
    </div>
  );
}

function GarmentPhoto({ src, name }: { src: string; name: string }) {
  const [failed, setFailed] = useState(false);
  if (failed) return null;
  return <img src={mediaUrl(src) || src} alt={name} onError={() => setFailed(true)} className="absolute inset-0 h-full w-full object-cover" />;
}
