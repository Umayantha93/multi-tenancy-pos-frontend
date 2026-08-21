"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import { Download } from "lucide-react";
import { API_URL, formatDate, mediaUrl, money, PhoneEntry, Tenant } from "@/lib/api";
import { billLinePresentation, sortBillItems } from "@/lib/business-profiles";
import { billStamp, billStampDateLabel, latestPaymentAt } from "@/lib/bill-stamp";
import { BillStatusSeal } from "@/components/bill-status-seal";

type SharedBill = {
  bill_number: string;
  admission_date: string | null;
  status: string;
  subtotal: string;
  total_deductions: string;
  amount_paid: string;
  balance_due: string;
  mileage?: number | string | null;
  notes?: string | null;
  customer: { name: string; phone: string; address?: string | null } | null;
  vehicle: { number_plate: string; make?: string | null; model?: string | null; chassis_number?: string | null } | null;
  items: Array<{
    id: number;
    type: string;
    description: string;
    included_services?: string[] | null;
    quantity: string;
    unit_price: string;
    line_total: string;
  }>;
  payments: Array<{ id: number; amount: string; method: string; paid_at: string }>;
  tenant: Tenant | null;
};

function documentCopy(stamp: ReturnType<typeof billStamp>) {
  if (stamp === "paid") {
    return { title: "Receipt", label: "Paid receipt", download: "Download receipt" };
  }
  if (stamp === "partial") {
    return { title: "Bill", label: "Partially paid bill", download: "Download bill" };
  }
  return { title: "Quotation", label: "Quotation", download: "Download quotation" };
}

export default function SharedBillPage() {
  const { token } = useParams<{ token: string }>();
  const [bill, setBill] = useState<SharedBill | null>(null);
  const [error, setError] = useState("");

  useEffect(() => {
    if (!token) return;
    fetch(`${API_URL}/bills/shared/${token}`)
      .then(async (response) => {
        if (!response.ok) {
          throw new Error("This bill link is invalid or no longer available.");
        }
        return response.json() as Promise<SharedBill>;
      })
      .then(setBill)
      .catch((caught: Error) => setError(caught.message || "Could not load bill."));
  }, [token]);

  useEffect(() => {
    if (!bill) return;
    const stamp = billStamp(bill);
    const label = documentCopy(stamp).title;
    const business = bill.tenant?.business_name ?? "Business";
    document.title = `${label} ${bill.bill_number} · ${business}`;
  }, [bill]);

  if (error) {
    return (
      <main className="mx-auto flex min-h-screen max-w-lg items-center px-4 py-10">
        <div className="w-full border border-[#e2ddd0] bg-white p-6 text-center">
          <p className="font-display text-2xl uppercase">Document unavailable</p>
          <p className="mt-2 text-sm text-[#6f746e]">{error}</p>
        </div>
      </main>
    );
  }

  if (!bill) {
    return (
      <main className="mx-auto flex min-h-screen max-w-lg items-center px-4 py-10">
        <p className="w-full text-center text-sm text-[#6f746e]">Loading…</p>
      </main>
    );
  }

  const logoUrl = mediaUrl(bill.tenant?.logo_url || bill.tenant?.logo);
  const contactEmail = bill.tenant?.contact_email || bill.tenant?.owner_email || "";
  const contactPhones = (bill.tenant?.contact_phones?.length
    ? bill.tenant.contact_phones.map((entry: PhoneEntry) => entry.number)
    : [bill.tenant?.contact_phone || bill.tenant?.owner_phone].filter(Boolean)) as string[];
  const stamp = billStamp(bill);
  const copy = documentCopy(stamp);
  const documentLabel = copy.label;
  const downloadLabel = copy.download;
  const paymentDate = billStampDateLabel(latestPaymentAt(bill.payments));
  const paid = stamp === "paid";
  const billItems = sortBillItems(bill.items);
  const chargeItems = billItems.filter((item) => item.type !== "discount");
  const discountItems = billItems.filter((item) => item.type === "discount");

  return (
    <main className="mx-auto min-h-screen max-w-3xl px-4 py-8">
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3 print:hidden">
        <div>
          <p className="text-[10px] font-bold uppercase tracking-wide text-[#6f746e]">{documentLabel}</p>
          <p className="font-display text-2xl uppercase leading-none">{bill.bill_number}</p>
        </div>
        <button
          type="button"
          onClick={() => window.print()}
          className="inline-flex h-11 items-center gap-2 bg-[#20221f] px-4 text-sm font-semibold text-white"
        >
          <Download size={18} />
          {downloadLabel}
        </button>
      </div>

      <div className="border border-[#e2ddd0] bg-white print:border-0">
        <div className="overflow-hidden border-b border-[#e2ddd0] p-5">
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div className="flex min-w-0 flex-wrap items-start gap-4">
              {logoUrl ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={logoUrl}
                  alt={bill.tenant?.business_name ?? "Business logo"}
                  className="h-16 w-16 shrink-0 object-contain border border-[#d7d3c8] bg-white p-1"
                />
              ) : null}
              <div className="min-w-0">
                <p className="font-display text-3xl font-semibold uppercase leading-none">
                  {bill.tenant?.business_name ?? "Business"}
                </p>
                <p className="mt-1 text-sm text-[#6f746e]">{bill.bill_number}</p>
                <p className="mt-1 text-sm text-[#6f746e]">Date: {formatDate(bill.admission_date)}</p>
                <div className="mt-3 space-y-1 text-sm">
                  {bill.tenant?.address && <p>{bill.tenant.address}</p>}
                  {contactPhones.map((phone) => (
                    <p key={phone}>{phone}</p>
                  ))}
                  {contactEmail && <p>{contactEmail}</p>}
                </div>
              </div>
            </div>
            <div className="flex shrink-0 flex-col items-end text-right text-xs uppercase text-[#6f746e]">
              <p className="font-bold text-[#167c73]">{documentLabel}</p>
              <BillStatusSeal stamp={stamp} paymentDate={paymentDate} alwaysVisible />
            </div>
          </div>
        </div>

        <div className="grid gap-4 border-b border-[#e2ddd0] p-5 sm:grid-cols-2">
          <div>
            <p className="text-[10px] font-bold uppercase text-[#6f746e]">Customer</p>
            <p className="mt-1 font-semibold">{bill.customer?.name ?? "Customer"}</p>
            <p className="text-sm text-[#6f746e]">{bill.customer?.phone}</p>
            {bill.customer?.address && <p className="mt-1 text-sm text-[#6f746e]">{bill.customer.address}</p>}
          </div>
          {bill.vehicle && (
            <div>
              <p className="text-[10px] font-bold uppercase text-[#6f746e]">Vehicle</p>
              <p className="mt-1 font-semibold">{bill.vehicle.number_plate}</p>
              <p className="text-sm text-[#6f746e]">
                {[bill.vehicle.make, bill.vehicle.model].filter(Boolean).join(" ") || "—"}
              </p>
              <p className="mt-2 text-sm">
                <span className="text-[10px] font-bold uppercase text-[#6f746e]">Mileage </span>
                {bill.mileage != null && bill.mileage !== "" ? `${Number(bill.mileage).toLocaleString()} km` : "—"}
              </p>
            </div>
          )}
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead className="border-b border-[#e2ddd0] bg-[#fbfaf6] text-[10px] uppercase text-[#6f746e]">
              <tr>
                <th className="px-5 py-3 font-bold">Item</th>
                <th className="px-3 py-3 font-bold">Qty</th>
                <th className="px-3 py-3 font-bold">Price</th>
                <th className="px-5 py-3 text-right font-bold">Total</th>
              </tr>
            </thead>
            <tbody>
              {chargeItems.map((item) => {
                const { title, inclusions } = billLinePresentation(item);
                return (
                <tr key={item.id} className="border-b border-[#f0ece3] align-top">
                  <td className="px-5 py-3">
                    <p className="font-semibold">{title}</p>
                    {inclusions.length > 0 && (
                      <ul className="mt-1.5 space-y-0.5 text-xs text-[#6f746e]">
                        {inclusions.map((name) => (
                          <li key={name}>– {name}</li>
                        ))}
                      </ul>
                    )}
                  </td>
                  <td className="px-3 py-3 tabular-nums">{item.quantity}</td>
                  <td className="px-3 py-3 tabular-nums">{money(item.unit_price)}</td>
                  <td className="px-5 py-3 text-right tabular-nums">{money(item.line_total)}</td>
                </tr>
                );
              })}
              {discountItems.length > 0 && (
                <>
                  <tr className="bill-discount-row border-t-2 border-[#167c73]/35 bg-[#e7f4f2]">
                    <td colSpan={4} className="px-5 py-2 text-[10px] font-bold uppercase tracking-wide text-[#167c73]">
                      Discount
                    </td>
                  </tr>
                  {discountItems.map((item) => (
                    <tr key={item.id} className="bill-discount-row border-t border-[#167c73]/20 bg-[#e7f4f2] text-[#167c73]">
                      <td className="px-5 py-3">{item.description}</td>
                      <td className="px-3 py-3 tabular-nums">{item.quantity}</td>
                      <td className="px-3 py-3 tabular-nums">{money(item.unit_price)}</td>
                      <td className="px-5 py-3 text-right font-semibold tabular-nums">-{money(item.line_total)}</td>
                    </tr>
                  ))}
                </>
              )}
              {!billItems.length && (
                <tr>
                  <td colSpan={4} className="px-5 py-8 text-center text-[#6f746e]">
                    No line items yet.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        <div className="space-y-2 border-t border-[#e2ddd0] p-5 text-sm">
          <div className="flex justify-between">
            <span className="text-[#6f746e]">Subtotal</span>
            <strong className="tabular-nums">{money(bill.subtotal)}</strong>
          </div>
          {Number(bill.total_deductions) > 0 && (
            <div className="bill-discount-row -mx-2 flex justify-between rounded-sm bg-[#e7f4f2] px-2 py-1.5 text-[#167c73]">
              <span>Deductions</span>
              <strong className="tabular-nums">-{money(bill.total_deductions)}</strong>
            </div>
          )}
          {paid ? (
            <>
              <div className="flex justify-between">
                <span className="text-[#6f746e]">Amount paid</span>
                <strong className="tabular-nums">{money(bill.amount_paid)}</strong>
              </div>
              <div className="flex justify-between border-t border-[#e2ddd0] pt-2 text-base">
                <span className="font-semibold text-[#167c73]">Paid in full</span>
                <strong className="tabular-nums text-[#167c73]">{money(0)}</strong>
              </div>
            </>
          ) : (
            <>
              {Number(bill.amount_paid) > 0 && (
                <div className="flex justify-between">
                  <span className="text-[#6f746e]">Amount paid</span>
                  <strong className="tabular-nums">{money(bill.amount_paid)}</strong>
                </div>
              )}
              <div className="flex justify-between border-t border-[#e2ddd0] pt-2 text-base">
                <span className="font-semibold">Balance due</span>
                <strong className="tabular-nums">{money(bill.balance_due)}</strong>
              </div>
              {stamp === "quote" && (
                <p className="pt-2 text-xs text-[#6f746e]">
                  This is a quotation. Final receipt will be available after payment is completed.
                </p>
              )}
            </>
          )}
        </div>
      </div>
    </main>
  );
}
