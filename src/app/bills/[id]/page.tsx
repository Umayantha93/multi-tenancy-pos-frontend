"use client";

import { FormEvent, useCallback, useEffect, useMemo, useState } from "react";
import { useParams } from "next/navigation";
import { CreditCard, Plus, Printer, Trash2 } from "lucide-react";
import { AppShell } from "@/components/app-shell";
import { buttonClass, ErrorMessage, inputClass, PageState, Panel } from "@/components/ui";
import { api, currentUser, mediaUrl, money, storeSession, Tenant, User } from "@/lib/api";
import { profileFor } from "@/lib/business-profiles";

type Part = { id: number; name: string; price: string; stock_qty: number; sku?: string; brand?: string };
type Bill = {
  id: number;
  bill_number: string;
  status: string;
  subtotal: string;
  total_deductions: string;
  amount_paid: string;
  balance_due: string;
  customer: { name: string; phone: string } | null;
  vehicle: { number_plate: string; chassis_number: string; make?: string; model?: string } | null;
  items: Array<{ id: number; type: string; description: string; quantity: string; unit_price: string; line_total: string }>;
  payments: Array<{ id: number; amount: string; method: string; paid_at: string }>;
};

const itemTypes = [
  { value: "labor", label: "Labor" },
  { value: "charge", label: "Service / charge" },
  { value: "part", label: "Inventory part" },
  { value: "discount", label: "Discount" },
] as const;

export default function BillDetailPage() {
  const { id } = useParams<{ id: string }>();
  const [bill, setBill] = useState<Bill | null>(null);
  const [parts, setParts] = useState<Part[]>([]);
  const [tenant, setTenant] = useState<Tenant | null>(currentUser()?.tenant ?? null);
  const [error, setError] = useState("");
  const [mode, setMode] = useState<"item" | "payment">("item");
  const [type, setType] = useState<string>("labor");
  const [partQuery, setPartQuery] = useState("");
  const [selectedPartId, setSelectedPartId] = useState("");
  const [outsidePart, setOutsidePart] = useState(false);
  const [customerPart, setCustomerPart] = useState(false);

  const logoUrl = mediaUrl(tenant?.logo_url || tenant?.logo);
  const contactEmail = tenant?.contact_email || tenant?.owner_email || "";
  const contactPhones = (tenant?.contact_phones?.length
    ? tenant.contact_phones.map((p) => p.number)
    : [tenant?.contact_phone || tenant?.owner_phone].filter(Boolean)) as string[];
  const profile = profileFor(tenant?.business_type);

  const load = useCallback(() => {
    api<Bill>(`/bills/${id}`).then(setBill).catch((caught) => setError(caught.message));
  }, [id]);

  useEffect(() => {
    load();
    api<{ data: Part[] }>("/parts?per_page=100")
      .then((result) => setParts(result.data))
      .catch(() => undefined);
    api<{ user: User; features: string[] }>("/user")
      .then((result) => {
        setTenant(result.user.tenant ?? null);
        const token = localStorage.getItem("garage_token");
        if (token) storeSession(token, result.user, result.features);
      })
      .catch(() => undefined);
  }, [load]);

  const filteredParts = useMemo(() => {
    const query = partQuery.trim().toLowerCase();
    return parts
      .filter((part) => part.stock_qty > 0)
      .filter((part) => {
        if (!query) return true;
        return [part.name, part.sku, part.brand].filter(Boolean).join(" ").toLowerCase().includes(query);
      });
  }, [partQuery, parts]);

  const selectedPart = parts.find((part) => String(part.id) === selectedPartId);
  const showQuantity = type === "part";
  const showCost = type !== "part" || outsidePart;
  const useStockSearch = type === "part" && !outsidePart && !customerPart;

  async function addItem(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");
    const form = event.currentTarget;
    const formData = new FormData(form);
    const payload: Record<string, string> = {
      type: String(formData.get("type") || type),
    };

    if (type === "part") {
      if (customerPart) {
        payload.type = "customer_part";
        payload.description = String(formData.get("description") || "");
        payload.quantity = String(formData.get("quantity") || "1");
        payload.unit_price = "0";
      } else if (outsidePart) {
        payload.description = String(formData.get("description") || "");
        payload.unit_price = String(formData.get("unit_price") || "");
        payload.quantity = String(formData.get("quantity") || "1");
      } else {
        if (!selectedPartId) {
          setError("Select a part from stock, or choose Bought outside / Customer supplied.");
          return;
        }
        payload.part_id = selectedPartId;
        payload.quantity = String(formData.get("quantity") || "1");
      }
    } else {
      payload.description = String(formData.get("description") || "");
      payload.unit_price = String(formData.get("unit_price") || "");
      payload.quantity = "1";
    }

    try {
      await api(`/bills/${id}/items`, { method: "POST", body: JSON.stringify(payload) });
      form.reset();
      setType("labor");
      setPartQuery("");
      setSelectedPartId("");
      setOutsidePart(false);
      setCustomerPart(false);
      load();
      api<{ data: Part[] }>("/parts?per_page=100").then((result) => setParts(result.data)).catch(() => undefined);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Could not add item.");
    }
  }

  async function addPayment(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = event.currentTarget;
    try {
      await api(`/bills/${id}/payments`, { method: "POST", body: JSON.stringify(Object.fromEntries(new FormData(form))) });
      form.reset();
      load();
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Could not record payment.");
    }
  }

  async function remove(itemId: number) {
    if (!confirm("Remove this line item? Inventory stock will be restored.")) return;
    await api(`/bills/${id}/items/${itemId}`, { method: "DELETE" });
    load();
    api<{ data: Part[] }>("/parts?per_page=100").then((result) => setParts(result.data)).catch(() => undefined);
  }

  if (!bill) {
    return (
      <AppShell title={profile.billingSingular} eyebrow="Billing">
        {error ? <ErrorMessage message={error} /> : <PageState message={`Opening ${profile.billingSingular.toLowerCase()}...`} />}
      </AppShell>
    );
  }

  return (
    <AppShell
      title={bill.bill_number}
      eyebrow={`${bill.vehicle?.number_plate ?? bill.customer?.name ?? profile.billingSingular} · ${bill.status.replace("_", " ")}`}
      action={
        <button onClick={() => window.print()} className="no-print grid size-10 place-items-center border border-[#c9c5b9]" title="Print bill">
          <Printer size={19} />
        </button>
      }
    >
      <Panel className="bill-letterhead mb-5 p-5">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div className="flex min-w-0 items-start gap-4">
            {logoUrl ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={logoUrl}
                alt={tenant?.business_name ?? "Business logo"}
                className="h-20 w-20 shrink-0 object-contain border border-[#d7d3c8] bg-white p-1"
              />
            ) : (
              <div className="grid h-20 w-20 shrink-0 place-items-center border border-dashed border-[#c9c5b9] bg-[#fbfaf6] text-center text-[10px] font-bold uppercase text-[#6f746e]">
                No logo
              </div>
            )}
            <div className="min-w-0">
              <p className="font-display text-3xl font-semibold uppercase leading-none">
                {tenant?.business_name ?? "Business"}
              </p>
              <p className="mt-2 text-sm text-[#6f746e]">{bill.bill_number}</p>
              <div className="mt-3 space-y-1 text-sm">
                {contactPhones.map((phone) => (
                  <p key={phone}><span className="text-[#6f746e]">Mobile:</span> {phone}</p>
                ))}
                {contactEmail && <p><span className="text-[#6f746e]">Email:</span> {contactEmail}</p>}
              </div>
            </div>
          </div>
          <div className="text-right text-xs uppercase text-[#6f746e]">
            <p className="font-bold text-[#167c73]">Tax invoice / {profile.billingSingular.toLowerCase()}</p>
            <p className="mt-1 normal-case">{new Date().toLocaleString("en-LK")}</p>
          </div>
        </div>
      </Panel>

      <div className="grid gap-5 xl:grid-cols-[1.55fr_0.75fr] print:block print:space-y-5">
        <div className="space-y-5">
          <Panel>
            <div className="grid gap-4 p-5 sm:grid-cols-3">
              <div>
                <p className="text-[10px] font-bold uppercase text-[#6f746e]">Customer</p>
                <p className="mt-1 font-semibold">{bill.customer?.name ?? "Walk-in"}</p>
                <p className="text-sm text-[#6f746e]">{bill.customer?.phone}</p>
              </div>
              {bill.vehicle ? (
                <>
                  <div>
                    <p className="text-[10px] font-bold uppercase text-[#6f746e]">Vehicle</p>
                    <p className="mt-1 font-semibold">{bill.vehicle.number_plate}</p>
                    <p className="text-sm text-[#6f746e]">{bill.vehicle.make} {bill.vehicle.model}</p>
                  </div>
                  <div>
                    <p className="text-[10px] font-bold uppercase text-[#6f746e]">Chassis</p>
                    <p className="mt-1 break-all text-sm">{bill.vehicle.chassis_number}</p>
                  </div>
                </>
              ) : (
                <div className="sm:col-span-2">
                  <p className="text-[10px] font-bold uppercase text-[#6f746e]">Type</p>
                  <p className="mt-1 font-semibold">{profile.label}</p>
                </div>
              )}
            </div>
          </Panel>

          {error && <div className="no-print"><ErrorMessage message={error} /></div>}

          <Panel>
            <div className="border-b border-[#d7d3c8] px-5 py-4">
              <h2 className="font-display text-2xl font-semibold uppercase">Bill items</h2>
            </div>
            <div className="overflow-x-auto print:overflow-visible">
              <table className="bill-items-table w-full table-fixed text-left text-sm">
                <colgroup>
                  <col className="w-[36%]" />
                  <col className="w-[14%]" />
                  <col className="w-[10%]" />
                  <col className="w-[18%]" />
                  <col className="w-[18%]" />
                  <col className="no-print w-10" />
                </colgroup>
                <thead className="bg-[#eeece5] text-[10px] uppercase text-[#6f746e]">
                  <tr>
                    <th className="px-4 py-3">Description</th>
                    <th className="px-3 py-3">Type</th>
                    <th className="px-3 py-3 text-right">Qty</th>
                    <th className="px-3 py-3 text-right">Rate</th>
                    <th className="px-4 py-3 text-right">Total</th>
                    <th className="no-print px-2 py-3" />
                  </tr>
                </thead>
                <tbody>
                  {bill.items.map((item) => {
                    const fromCustomer = item.type === "customer_part";
                    const isPartLine = item.type === "part" || fromCustomer;
                    return (
                      <tr key={item.id} className="border-t border-[#e2ded4] align-top">
                        <td className="px-4 py-3 font-semibold break-words whitespace-normal">{item.description}</td>
                        <td className="px-3 py-3 uppercase text-[#6f746e] break-words whitespace-normal">
                          {fromCustomer ? "customer part" : item.type}
                        </td>
                        <td className="px-3 py-3 text-right tabular-nums">
                          {isPartLine ? Number(item.quantity) : "—"}
                        </td>
                        <td className="px-3 py-3 text-right break-words whitespace-normal">
                          {fromCustomer ? (
                            <span className="font-semibold text-[#167c73]">—</span>
                          ) : (
                            <span className="tabular-nums">{money(item.unit_price)}</span>
                          )}
                        </td>
                        <td className="px-4 py-3 text-right break-words whitespace-normal">
                          {fromCustomer ? (
                            <span className="inline-block max-w-full font-semibold leading-snug text-[#167c73]">
                              Received from customer
                            </span>
                          ) : (
                            <span className="tabular-nums">{money(item.line_total)}</span>
                          )}
                        </td>
                        <td className="no-print px-2 py-3">
                          <button onClick={() => remove(item.id)} className="text-[#b84837]" title="Remove item">
                            <Trash2 size={16} />
                          </button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
              {bill.items.length === 0 && <p className="p-8 text-center text-sm text-[#6f746e]">No charges yet.</p>}
            </div>
          </Panel>

          {bill.payments.length > 0 && (
            <Panel>
              <div className="border-b border-[#d7d3c8] px-5 py-4">
                <h2 className="font-display text-2xl font-semibold uppercase">Payments</h2>
              </div>
              <div className="divide-y divide-[#e2ded4]">
                {bill.payments.map((payment) => (
                  <div key={payment.id} className="flex items-center justify-between px-5 py-3 text-sm">
                    <span className="uppercase text-[#6f746e]">{payment.method.replace("_", " ")}</span>
                    <strong>{money(payment.amount)}</strong>
                  </div>
                ))}
              </div>
            </Panel>
          )}
        </div>

        <div className="mt-5 space-y-5 print:mt-5">
          <Panel className="p-5">
            <p className="text-xs font-bold uppercase text-[#6f746e]">Bill summary</p>
            <div className="mt-5 space-y-3 text-sm">
              <div className="flex justify-between gap-6"><span>Charges</span><strong className="tabular-nums">{money(bill.subtotal)}</strong></div>
              <div className="flex justify-between gap-6"><span>Deductions</span><strong className="tabular-nums">- {money(bill.total_deductions)}</strong></div>
              <div className="flex justify-between gap-6"><span>Paid</span><strong className="tabular-nums">- {money(bill.amount_paid)}</strong></div>
              <div className="flex justify-between gap-6 border-t-2 border-[#20221f] pt-4 font-display text-2xl uppercase">
                <span>Due</span><strong className="tabular-nums">{money(bill.balance_due)}</strong>
              </div>
            </div>
          </Panel>

          <Panel className="no-print">
            <div className="grid grid-cols-2 border-b border-[#d7d3c8]">
              <button onClick={() => setMode("item")} className={`h-11 text-sm font-semibold ${mode === "item" ? "bg-[#20221f] text-white" : ""}`}>
                <Plus className="inline" size={16} /> Add item
              </button>
              <button onClick={() => setMode("payment")} className={`h-11 text-sm font-semibold ${mode === "payment" ? "bg-[#167c73] text-white" : ""}`}>
                <CreditCard className="inline" size={16} /> Payment
              </button>
            </div>

            {mode === "item" ? (
              <form onSubmit={addItem} className="space-y-4 p-5">
                <label className="block text-xs font-bold uppercase">
                  Type
                  <select
                    name="type"
                    value={type}
                    onChange={(event) => {
                      setType(event.target.value);
                      setSelectedPartId("");
                      setPartQuery("");
                      setOutsidePart(false);
                      setCustomerPart(false);
                    }}
                    className={`${inputClass} mt-2`}
                  >
                    {itemTypes.map((option) => (
                      <option key={option.value} value={option.value}>{option.label}</option>
                    ))}
                  </select>
                </label>

                {type === "part" ? (
                  <>
                    <div className="grid gap-2 sm:grid-cols-2">
                      <label className="flex cursor-pointer items-center gap-3 border border-[#d7d3c8] bg-[#fbfaf6] px-3 py-3">
                        <input
                          type="checkbox"
                          checked={outsidePart}
                          onChange={(event) => {
                            const checked = event.target.checked;
                            setOutsidePart(checked);
                            if (checked) {
                              setCustomerPart(false);
                              setSelectedPartId("");
                              setPartQuery("");
                            }
                          }}
                          className="size-4 accent-[#167c73]"
                        />
                        <span className="text-xs font-bold uppercase">Bought outside</span>
                      </label>
                      <label className="flex cursor-pointer items-center gap-3 border border-[#d7d3c8] bg-[#fbfaf6] px-3 py-3">
                        <input
                          type="checkbox"
                          checked={customerPart}
                          onChange={(event) => {
                            const checked = event.target.checked;
                            setCustomerPart(checked);
                            if (checked) {
                              setOutsidePart(false);
                              setSelectedPartId("");
                              setPartQuery("");
                            }
                          }}
                          className="size-4 accent-[#167c73]"
                        />
                        <span className="text-xs font-bold uppercase">Customer supplied</span>
                      </label>
                    </div>

                    {useStockSearch ? (
                      <>
                        <label className="block text-xs font-bold uppercase">
                          Search parts
                          <input
                            value={partQuery}
                            onChange={(event) => {
                              setPartQuery(event.target.value);
                              setSelectedPartId("");
                            }}
                            className={`${inputClass} mt-2`}
                            placeholder="Type name, SKU or brand"
                          />
                        </label>
                        <div className="max-h-44 overflow-y-auto border border-[#d7d3c8] bg-white">
                          {filteredParts.length === 0 ? (
                            <p className="p-3 text-sm text-[#6f746e]">No matching stock.</p>
                          ) : (
                            filteredParts.map((part) => (
                              <button
                                type="button"
                                key={part.id}
                                onClick={() => setSelectedPartId(String(part.id))}
                                className={`flex w-full items-center justify-between border-b border-[#eeeae1] px-3 py-2 text-left text-sm ${selectedPartId === String(part.id) ? "bg-[#167c73]/10" : "hover:bg-[#f7f5ef]"}`}
                              >
                                <span className="font-semibold">{part.name}</span>
                                <span className="text-xs text-[#6f746e]">{part.stock_qty} · {money(part.price)}</span>
                              </button>
                            ))
                          )}
                        </div>
                        {selectedPart && (
                          <p className="text-xs text-[#167c73]">Selected: {selectedPart.name}</p>
                        )}
                      </>
                    ) : outsidePart ? (
                      <>
                        <label className="block text-xs font-bold uppercase">
                          Part description
                          <input name="description" required className={`${inputClass} mt-2`} placeholder="e.g. Oil filter bought outside" />
                        </label>
                        <label className="block text-xs font-bold uppercase">
                          Cost
                          <input name="unit_price" type="number" min="0" step="0.01" required className={`${inputClass} mt-2`} />
                        </label>
                      </>
                    ) : (
                      <label className="block text-xs font-bold uppercase">
                        Part description
                        <input name="description" required className={`${inputClass} mt-2`} placeholder="e.g. Customer brought brake pads" />
                      </label>
                    )}
                  </>
                ) : (
                  <>
                    <label className="block text-xs font-bold uppercase">
                      Description
                      <input name="description" required className={`${inputClass} mt-2`} />
                    </label>
                    {showCost && (
                      <label className="block text-xs font-bold uppercase">
                        Cost
                        <input name="unit_price" type="number" min="0" step="0.01" required className={`${inputClass} mt-2`} />
                      </label>
                    )}
                  </>
                )}

                {showQuantity && (selectedPartId || outsidePart || customerPart) && (
                  <label className="block text-xs font-bold uppercase">
                    Quantity
                    <input name="quantity" type="number" min="1" step="1" defaultValue="1" required className={`${inputClass} mt-2`} />
                  </label>
                )}

                <button className={`${buttonClass} w-full`}>
                  <Plus size={17} />Add to bill
                </button>
              </form>
            ) : (
              <form onSubmit={addPayment} className="space-y-4 p-5">
                <label className="block text-xs font-bold uppercase">
                  Amount
                  <input name="amount" type="number" min="0.01" step="0.01" required className={`${inputClass} mt-2`} />
                </label>
                <label className="block text-xs font-bold uppercase">
                  Method
                  <select name="method" className={`${inputClass} mt-2`}>
                    <option value="cash">Cash</option>
                    <option value="card">Card</option>
                    <option value="bank_transfer">Bank transfer</option>
                    <option value="other">Other</option>
                  </select>
                </label>
                <label className="block text-xs font-bold uppercase">
                  Reference
                  <input name="reference" className={`${inputClass} mt-2`} />
                </label>
                <button className={`${buttonClass} w-full bg-[#167c73]`}>
                  <CreditCard size={17} />Record payment
                </button>
              </form>
            )}
          </Panel>
        </div>
      </div>
    </AppShell>
  );
}
