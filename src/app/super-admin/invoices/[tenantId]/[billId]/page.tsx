"use client";

import Link from "next/link";
import { FormEvent, useCallback, useEffect, useMemo, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { ArrowLeft, Lock, RotateCcw, Trash2 } from "lucide-react";
import { PlatformShell } from "@/components/platform-shell";
import { ConfirmModal, ErrorMessage, PageState, Panel, SuccessMessage, buttonClass, inputClass } from "@/components/ui";
import { api, formatDate, money, Tenant } from "@/lib/api";
import { billItemLabel, profileFor, sortBillItems } from "@/lib/business-profiles";

type BillItem = {
  id: number;
  type: string;
  description: string;
  quantity: string;
  unit_price: string;
  line_total: string;
};
type Bill = {
  id: number;
  bill_number: string;
  status: string;
  notes?: string | null;
  odometer?: number | null;
  subtotal: string;
  total_deductions: string;
  amount_paid: string;
  balance_due: string;
  customer_balance?: string;
  admission_date: string;
  customer: { name: string; phone: string } | null;
  vehicle: { number_plate: string; make?: string; model?: string } | null;
  items: BillItem[];
  payments: Array<{ id: number; amount: string; method: string; paid_at: string; reference?: string | null }>;
};
type Part = { id: number; name: string; price: string; stock_qty: number; sku?: string | null; brand?: string };

function statusClass(status: string) {
  if (status === "paid") return "bg-[#167c73]/10 text-[#167c73]";
  if (status === "closed") return "bg-[#20221f] text-white";
  return "bg-[#f5c842]/25 text-[#735a00]";
}

export default function SuperAdminInvoiceDetailPage() {
  const { tenantId, billId } = useParams<{ tenantId: string; billId: string }>();
  const router = useRouter();
  const [tenant, setTenant] = useState<Tenant | null>(null);
  const [bill, setBill] = useState<Bill | null>(null);
  const [parts, setParts] = useState<Part[]>([]);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [busy, setBusy] = useState(false);
  const [notes, setNotes] = useState("");
  const [itemType, setItemType] = useState("labor");
  const [itemDescription, setItemDescription] = useState("");
  const [itemQty, setItemQty] = useState("1");
  const [itemPrice, setItemPrice] = useState("");
  const [selectedPartId, setSelectedPartId] = useState("");
  const [partQuery, setPartQuery] = useState("");
  const [confirm, setConfirm] = useState<"reopen" | "close" | "delete" | null>(null);
  const [drafts, setDrafts] = useState<Record<number, { description: string; quantity: string; unit_price: string }>>({});

  const profile = profileFor(tenant?.business_type);
  const itemTypes = profile.billItemTypes;
  const selectedType = itemTypes.find((option) => option.value === itemType) ?? itemTypes[0];
  const isStockType = selectedType?.kind === "stock";
  const billItems = useMemo(() => sortBillItems(bill?.items ?? []), [bill?.items]);

  const load = useCallback(() => {
    api<Bill>(`/super-admin/tenants/${tenantId}/bills/${billId}`)
      .then((result) => {
        setBill(result);
        setNotes(result.notes ?? "");
        setDrafts(
          Object.fromEntries(
            result.items.map((item) => [
              item.id,
              { description: item.description, quantity: String(Number(item.quantity)), unit_price: item.unit_price },
            ]),
          ),
        );
      })
      .catch((caught) => setError(caught.message));
  }, [tenantId, billId]);

  useEffect(() => {
    api<Tenant>(`/super-admin/tenants/${tenantId}`)
      .then(setTenant)
      .catch(() => undefined);
    load();
  }, [load, tenantId]);

  useEffect(() => {
    if (!itemTypes.length) return;
    if (!itemTypes.some((option) => option.value === itemType)) {
      setItemType(itemTypes[0].value);
    }
  }, [itemTypes, itemType]);

  useEffect(() => {
    if (!isStockType) return;
    const timer = setTimeout(() => {
      const params = partQuery ? `?search=${encodeURIComponent(partQuery)}` : "";
      api<Part[]>(`/super-admin/tenants/${tenantId}/parts${params}`)
        .then(setParts)
        .catch(() => undefined);
    }, 200);
    return () => clearTimeout(timer);
  }, [isStockType, partQuery, tenantId]);

  async function run(path: string, options: RequestInit, success: string) {
    setBusy(true);
    setError("");
    setNotice("");
    try {
      const result = await api<Bill | { message: string }>(path, options);
      if ("bill_number" in result) {
        setBill(result);
        setNotes(result.notes ?? "");
        setDrafts(
          Object.fromEntries(
            result.items.map((item) => [
              item.id,
              { description: item.description, quantity: String(Number(item.quantity)), unit_price: item.unit_price },
            ]),
          ),
        );
      }
      setNotice(success);
      setConfirm(null);
      if (!("bill_number" in result)) {
        router.replace(`/super-admin/invoices?tenant=${tenantId}`);
      }
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Request failed.");
    } finally {
      setBusy(false);
    }
  }

  async function saveNotes(event: FormEvent) {
    event.preventDefault();
    await run(
      `/super-admin/tenants/${tenantId}/bills/${billId}`,
      { method: "PUT", body: JSON.stringify({ notes }) },
      "Notes saved.",
    );
  }

  async function saveItem(itemId: number) {
    const draft = drafts[itemId];
    if (!draft) return;
    await run(
      `/super-admin/tenants/${tenantId}/bills/${billId}/items/${itemId}`,
      { method: "PUT", body: JSON.stringify(draft) },
      "Line updated.",
    );
  }

  async function addItem(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const payload: Record<string, string> = { type: itemType };
    if (isStockType && selectedPartId) {
      payload.part_id = selectedPartId;
      payload.quantity = itemQty || "1";
    } else {
      payload.description = itemDescription;
      payload.unit_price = itemPrice;
      payload.quantity = itemQty || "1";
    }
    await run(
      `/super-admin/tenants/${tenantId}/bills/${billId}/items`,
      { method: "POST", body: JSON.stringify(payload) },
      "Line added.",
    );
    setItemDescription("");
    setItemPrice("");
    setItemQty("1");
    setSelectedPartId("");
    setPartQuery("");
  }

  async function addPayment(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = event.currentTarget;
    await run(
      `/super-admin/tenants/${tenantId}/bills/${billId}/payments`,
      { method: "POST", body: JSON.stringify(Object.fromEntries(new FormData(form))) },
      "Payment recorded.",
    );
    form.reset();
  }

  if (!bill) {
    return (
      <PlatformShell title="Invoice" eyebrow="Tenants invoices">
        {error ? <ErrorMessage message={error} /> : <PageState message="Opening invoice..." />}
      </PlatformShell>
    );
  }

  return (
    <PlatformShell
      title={bill.bill_number}
      eyebrow={`${tenant?.business_name ?? "Tenant"} · ${bill.status.replace("_", " ")}`}
      action={
        <div className="flex flex-wrap items-center gap-2">
          {bill.status === "closed" ? (
            <button
              type="button"
              onClick={() => setConfirm("reopen")}
              className="inline-flex h-10 items-center gap-2 border border-[#167c73] bg-white px-3 text-sm font-semibold text-[#167c73]"
            >
              <RotateCcw size={16} /> Reopen
            </button>
          ) : (
            <button
              type="button"
              onClick={() => setConfirm("close")}
              className="inline-flex h-10 items-center gap-2 border border-[#20221f] bg-white px-3 text-sm font-semibold"
            >
              <Lock size={16} /> Close
            </button>
          )}
          <button
            type="button"
            onClick={() => setConfirm("delete")}
            className="inline-flex h-10 items-center gap-2 border border-[#b84837] bg-white px-3 text-sm font-semibold text-[#b84837]"
          >
            <Trash2 size={16} /> Delete
          </button>
        </div>
      }
    >
      <ConfirmModal
        open={confirm === "reopen"}
        title="Reopen bill"
        message="This bill will be reopened so the tenant can edit it again. Status will follow the current balance (open, partially paid, or paid)."
        confirmLabel="Reopen"
        tone="teal"
        busy={busy}
        onCancel={() => !busy && setConfirm(null)}
        onConfirm={() => run(`/super-admin/tenants/${tenantId}/bills/${billId}/reopen`, { method: "POST" }, "Bill reopened.")}
      />
      <ConfirmModal
        open={confirm === "close"}
        title="Close bill"
        message="Close this bill now? The tenant will not be able to edit it until you reopen it."
        confirmLabel="Close bill"
        busy={busy}
        onCancel={() => !busy && setConfirm(null)}
        onConfirm={() => run(`/super-admin/tenants/${tenantId}/bills/${billId}/close`, { method: "POST" }, "Bill closed.")}
      />
      <ConfirmModal
        open={confirm === "delete"}
        title="Delete bill"
        message={`Permanently delete ${bill.bill_number}? Stock used on this bill will be restored. This cannot be undone.`}
        confirmLabel="Delete bill"
        tone="danger"
        busy={busy}
        onCancel={() => !busy && setConfirm(null)}
        onConfirm={() => run(`/super-admin/tenants/${tenantId}/bills/${billId}`, { method: "DELETE" }, "Bill deleted.")}
      />

      <Link href={`/super-admin/invoices?tenant=${tenantId}`} className="mb-4 inline-flex items-center gap-2 text-sm text-[#6f746e] hover:text-[#167c73]">
        <ArrowLeft size={16} /> Back to invoices
      </Link>

      {error && <div className="mb-4"><ErrorMessage message={error} /></div>}
      {notice && <div className="mb-4"><SuccessMessage message={notice} /></div>}

      <div className="grid items-start gap-5 xl:grid-cols-[1.55fr_0.75fr]">
        <div className="space-y-5">
          <Panel className="p-5">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <p className="text-[10px] font-bold uppercase text-[#6f746e]">Customer</p>
                <p className="mt-1 font-semibold">{bill.customer?.name ?? "Walk-in"}</p>
                <p className="text-sm text-[#6f746e]">{bill.customer?.phone}</p>
              </div>
              {bill.vehicle && (
                <div>
                  <p className="text-[10px] font-bold uppercase text-[#6f746e]">Vehicle</p>
                  <p className="mt-1 font-semibold">{bill.vehicle.number_plate}</p>
                  <p className="text-sm text-[#6f746e]">{[bill.vehicle.make, bill.vehicle.model].filter(Boolean).join(" ")}</p>
                </div>
              )}
              <div className="text-right">
                <span className={`px-2 py-1 text-[10px] font-bold uppercase ${statusClass(bill.status)}`}>
                  {bill.status.replace("_", " ")}
                </span>
                <p className="mt-2 text-sm text-[#6f746e]">{formatDate(bill.admission_date)}</p>
              </div>
            </div>
          </Panel>

          <Panel>
            <div className="border-b border-[#d7d3c8] px-5 py-4">
              <h2 className="font-display text-2xl font-semibold uppercase">Bill items</h2>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full min-w-[720px] text-left text-sm">
                <thead className="bg-[#eeece5] text-[10px] uppercase text-[#6f746e]">
                  <tr>
                    <th className="px-4 py-3">Description</th>
                    <th>Type</th>
                    <th className="text-right">Qty</th>
                    <th className="text-right">Rate</th>
                    <th className="text-right">Total</th>
                    <th />
                  </tr>
                </thead>
                <tbody>
                  {billItems.map((item) => {
                    const draft = drafts[item.id] ?? {
                      description: item.description,
                      quantity: String(Number(item.quantity)),
                      unit_price: item.unit_price,
                    };
                    return (
                      <tr key={item.id} className="border-t border-[#e2ded4] align-top">
                        <td className="px-4 py-2">
                          <input
                            value={draft.description}
                            onChange={(event) => setDrafts((current) => ({ ...current, [item.id]: { ...draft, description: event.target.value } }))}
                            className={`${inputClass} h-9`}
                          />
                        </td>
                        <td className="py-2 text-[#6f746e]">{billItemLabel(item.type, profile)}</td>
                        <td className="py-2">
                          <input
                            type="number"
                            min="0.01"
                            step="0.01"
                            value={draft.quantity}
                            onChange={(event) => setDrafts((current) => ({ ...current, [item.id]: { ...draft, quantity: event.target.value } }))}
                            className={`${inputClass} h-9 w-20 text-right`}
                          />
                        </td>
                        <td className="py-2">
                          <input
                            type="number"
                            min="0"
                            step="0.01"
                            value={draft.unit_price}
                            onChange={(event) => setDrafts((current) => ({ ...current, [item.id]: { ...draft, unit_price: event.target.value } }))}
                            className={`${inputClass} h-9 w-28 text-right`}
                            disabled={item.type === "customer_part"}
                          />
                        </td>
                        <td className="py-2 pr-2 text-right tabular-nums">{money(item.line_total)}</td>
                        <td className="py-2 pr-3">
                          <div className="flex justify-end gap-2">
                            <button type="button" onClick={() => saveItem(item.id)} className="text-xs font-bold uppercase text-[#167c73]">
                              Save
                            </button>
                            <button
                              type="button"
                              onClick={() => run(`/super-admin/tenants/${tenantId}/bills/${billId}/items/${item.id}`, { method: "DELETE" }, "Line removed.")}
                              className="text-[#b84837]"
                              title="Remove line"
                            >
                              <Trash2 size={16} />
                            </button>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
              {billItems.length === 0 && <p className="p-8 text-center text-sm text-[#6f746e]">No line items.</p>}
            </div>
          </Panel>

          {bill.payments.length > 0 && (
            <Panel>
              <div className="border-b border-[#d7d3c8] px-5 py-4">
                <h2 className="font-display text-2xl font-semibold uppercase">Payments</h2>
              </div>
              <div className="divide-y divide-[#e2ded4]">
                {bill.payments.map((payment) => (
                  <div key={payment.id} className="flex items-center gap-3 px-5 py-3 text-sm">
                    <span className="uppercase text-[#6f746e]">{payment.method.replace("_", " ")}</span>
                    <span className="text-xs text-[#6f746e]">{formatDate(payment.paid_at)}</span>
                    <strong className="ml-auto tabular-nums">{money(payment.amount)}</strong>
                    <button
                      type="button"
                      onClick={() => run(`/super-admin/tenants/${tenantId}/bills/${billId}/payments/${payment.id}`, { method: "DELETE" }, "Payment removed.")}
                      className="text-[#b84837]"
                      title="Remove payment"
                    >
                      <Trash2 size={16} />
                    </button>
                  </div>
                ))}
              </div>
            </Panel>
          )}
        </div>

        <div className="space-y-5">
          <Panel className="p-5">
            <p className="text-xs font-bold uppercase text-[#6f746e]">Add item</p>
            <form onSubmit={addItem} className="mt-4 space-y-3">
              <select value={itemType} onChange={(event) => { setItemType(event.target.value); setSelectedPartId(""); }} className={inputClass}>
                {itemTypes.map((option) => (
                  <option key={option.value} value={option.value}>{option.label}</option>
                ))}
              </select>
              {isStockType ? (
                <>
                  <input value={partQuery} onChange={(event) => setPartQuery(event.target.value)} placeholder="Search stock" className={inputClass} />
                  <div className="max-h-40 overflow-y-auto border border-[#d7d3c8] bg-white">
                    {parts.map((part) => (
                      <button
                        key={part.id}
                        type="button"
                        onClick={() => { setSelectedPartId(String(part.id)); setPartQuery(part.name); }}
                        className={`flex w-full items-center justify-between px-3 py-2 text-left text-sm ${selectedPartId === String(part.id) ? "bg-[#167c73]/10" : "hover:bg-[#f7f5ef]"}`}
                      >
                        <span>{part.name}</span>
                        <span className="text-xs text-[#6f746e]">{part.stock_qty} in stock</span>
                      </button>
                    ))}
                  </div>
                  <input name="quantity" type="number" min="1" step="1" value={itemQty} onChange={(event) => setItemQty(event.target.value)} className={inputClass} />
                </>
              ) : (
                <>
                  <input value={itemDescription} onChange={(event) => setItemDescription(event.target.value)} placeholder="Description" required className={inputClass} />
                  <input type="number" min="0" step="0.01" value={itemPrice} onChange={(event) => setItemPrice(event.target.value)} placeholder="Amount" required className={inputClass} />
                </>
              )}
              <button className={`${buttonClass} w-full`} disabled={busy}>Add line</button>
            </form>
          </Panel>

          <Panel className="p-5">
            <p className="text-xs font-bold uppercase text-[#6f746e]">Add payment</p>
            <form onSubmit={addPayment} className="mt-4 space-y-3">
              <input name="amount" type="number" min="0.01" step="0.01" required placeholder="Amount" className={inputClass} />
              <select name="method" className={inputClass}>
                <option value="cash">Cash</option>
                <option value="card">Card</option>
                <option value="bank_transfer">Bank transfer</option>
                <option value="other">Other</option>
              </select>
              <input name="reference" placeholder="Reference" className={inputClass} />
              <button className={`${buttonClass} w-full bg-[#167c73]`} disabled={busy}>Record payment</button>
            </form>
          </Panel>

          <Panel className="p-5">
            <form onSubmit={saveNotes} className="space-y-3">
              <label className="block text-xs font-bold uppercase text-[#6f746e]">
                Notes
                <textarea value={notes} onChange={(event) => setNotes(event.target.value)} rows={4} className={`${inputClass} mt-2 h-auto py-2`} />
              </label>
              <button className={`${buttonClass} w-full`} disabled={busy}>Save notes</button>
            </form>
          </Panel>

          <Panel className="p-5">
            <p className="text-xs font-bold uppercase text-[#6f746e]">Summary</p>
            <div className="mt-4 space-y-3 text-sm">
              <div className="flex justify-between"><span>Charges</span><strong className="tabular-nums">{money(bill.subtotal)}</strong></div>
              <div className="flex justify-between"><span>Deductions</span><strong className="tabular-nums">- {money(bill.total_deductions)}</strong></div>
              <div className="flex justify-between"><span>Paid</span><strong className="tabular-nums">- {money(bill.amount_paid)}</strong></div>
              <div className="flex justify-between border-t border-[#e2ded4] pt-3">
                <span>Due</span>
                <strong className={`tabular-nums ${Number(bill.balance_due) > 0 ? "text-[#b84837]" : ""}`}>{money(bill.balance_due)}</strong>
              </div>
            </div>
          </Panel>
        </div>
      </div>
    </PlatformShell>
  );
}
