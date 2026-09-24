"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import { Download } from "lucide-react";
import { API_URL, formatDate, mediaUrl, money, PhoneEntry, Tenant } from "@/lib/api";
import { billLinePresentation, sortBillItems } from "@/lib/business-profiles";
import { warrantyLabel } from "@/lib/warranty";
import { billNetTotal, billStamp, billStampDateLabel, garageBillPdfTitle, latestPaymentAt } from "@/lib/bill-stamp";
import { BillStatusSeal } from "@/components/bill-status-seal";
import { BillWatermark } from "@/components/bill-watermark";
import { useT } from "@/lib/locale";

type SharedBill = {
  bill_number: string;
  admission_date: string | null;
  status: string;
  hide_amounts?: boolean;
  subtotal: string | null;
  total_deductions: string | null;
  vat_rate?: string | number | null;
  sscl_rate?: string | number | null;
  vat_amount?: string | number | null;
  sscl_amount?: string | number | null;
  amount_paid: string | null;
  balance_due: string | null;
  customer_balance?: string | null;
  driver_name?: string | null;
  driver_phone?: string | null;
  mileage?: number | string | null;
  next_service_mileage?: number | string | null;
  warranty_months?: number | null;
  warranty_starts_on?: string | null;
  warranty_until?: string | null;
  additional_note?: string | null;
  additional_note_color?: string | null;
  notes?: string | null;
  customer: { name: string; phone: string; address?: string | null } | null;
  vehicle: { number_plate: string; make?: string | null; model?: string | null; chassis_number?: string | null } | null;
  items: Array<{
    id: number;
    type: string;
    description: string;
    included_services?: string[] | null;
    quantity: string | number | null;
    unit_price: string | number | null;
    line_total: string | number | null;
    hide_hours?: boolean;
    hide_amounts?: boolean;
    warranty_months?: number | null;
    warranty_starts_on?: string | null;
    warranty_until?: string | null;
  }>;
  payments: Array<{ id: number; amount: string; method: string; paid_at: string }>;
  photos?: Array<{ id: number; original_name?: string | null; size_bytes?: number }>;
  videos?: Array<{ id: number; original_name?: string | null; duration_seconds?: number; size_bytes?: number }>;
  tenant: Tenant | null;
  branch?: { id: number; name: string; address?: string | null } | null;
  show_shop?: boolean;
};

function documentCopy(stamp: ReturnType<typeof billStamp>, t: (key: string) => string) {
  if (stamp === "paid") {
    return { title: t("print.receipt"), label: t("print.paid_receipt"), download: t("print.download_receipt") };
  }
  if (stamp === "partial") {
    return { title: t("print.bill"), label: t("print.partial_bill"), download: t("print.download_bill") };
  }
  if (stamp === "repair_note") {
    return { title: t("print.repair_note"), label: t("print.repair_note"), download: t("print.download_note") };
  }
  return { title: t("print.quotation"), label: t("print.quotation"), download: t("print.download_quote") };
}

function shareTokenFromParam(token: string | string[] | undefined): string {
  const raw = Array.isArray(token) ? token[0] : token;
  return String(raw ?? "").trim().replace(/[^a-zA-Z0-9]/g, "");
}

export default function SharedBillPage() {
  const t = useT();
  const params = useParams<{ token: string }>();
  const token = shareTokenFromParam(params.token);
  const [bill, setBill] = useState<SharedBill | null>(null);
  const [error, setError] = useState("");
  const [printWithLogo, setPrintWithLogo] = useState(true);

  useEffect(() => {
    try {
      const stored = window.localStorage.getItem("bill-print-with-logo");
      if (stored === "0") setPrintWithLogo(false);
      if (stored === "1") setPrintWithLogo(true);
    } catch {
      /* ignore */
    }
  }, []);

  useEffect(() => {
    if (!token) {
      setBill(null);
      setError(t("print.invalid"));
      return;
    }

    let cancelled = false;
    setError("");
    fetch(`${API_URL}/bills/shared/${encodeURIComponent(token)}`)
      .then(async (response) => {
        if (!response.ok) {
          throw new Error(t("print.invalid"));
        }
        return response.json() as Promise<SharedBill>;
      })
      .then((data) => {
        if (!cancelled) setBill(data);
      })
      .catch((caught: Error) => {
        if (cancelled) return;
        if (caught.name === "TypeError") {
          setError(t("print.offline"));
          return;
        }
        setError(caught.message || t("print.load_failed"));
      });

    return () => {
      cancelled = true;
    };
  }, [token, t]);

  useEffect(() => {
    if (!bill) return;
    const stamp = billStamp(bill);
    const label = documentCopy(stamp, t).title;
    const business = bill.tenant?.business_name ?? t("bill.business");
    document.title = bill.tenant?.business_type === "garage"
      ? garageBillPdfTitle(business, bill.vehicle?.number_plate)
      : `${label} ${bill.bill_number} · ${business}`;
  }, [bill, t]);

  if (error) {
    return (
      <main className="mx-auto flex min-h-screen max-w-lg items-center px-4 py-10">
        <div className="w-full border border-[#e2ddd0] bg-white p-6 text-center">
          <p className="font-display text-2xl uppercase">{t("print.unavailable")}</p>
          <p className="mt-2 text-sm text-[#6f746e]">{error}</p>
        </div>
      </main>
    );
  }

  if (!bill) {
    return (
      <main className="mx-auto flex min-h-screen max-w-lg items-center px-4 py-10">
        <p className="w-full text-center text-sm text-[#6f746e]">{t("print.loading")}</p>
      </main>
    );
  }

  const logoUrl = mediaUrl(bill.tenant?.logo_url || bill.tenant?.logo);
  const contactEmail = bill.tenant?.contact_email || bill.tenant?.owner_email || "";
  const contactPhones = (bill.tenant?.contact_phones?.length
    ? bill.tenant.contact_phones.map((entry: PhoneEntry) => entry.number)
    : [bill.tenant?.contact_phone || bill.tenant?.owner_phone].filter(Boolean)) as string[];
  const stamp = billStamp(bill);
  const copy = documentCopy(stamp, t);
  const documentLabel = copy.label;
  const downloadLabel = copy.download;
  const paymentDate = billStampDateLabel(latestPaymentAt(bill.payments));
  const paid = stamp === "paid";
  const billItems = sortBillItems(bill.items);
  const chargeItems = billItems.filter((item) => item.type !== "discount");
  const discountItems = billItems.filter((item) => item.type === "discount");

  return (
    <main className="mx-auto min-h-screen max-w-3xl px-4 py-8 print:max-w-none print:px-0 print:py-0">
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3 print:hidden">
        <div>
          <p className="text-[10px] font-bold uppercase tracking-wide text-[#6f746e]">{documentLabel}</p>
          <p className="font-display text-2xl uppercase leading-none">{bill.bill_number}</p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <label className="inline-flex h-8 cursor-pointer items-center gap-2 border border-[#c9c5b9] bg-white px-3 text-xs font-bold uppercase">
            <input
              type="checkbox"
              checked={printWithLogo}
              onChange={(event) => {
                const next = event.target.checked;
                setPrintWithLogo(next);
                try {
                  window.localStorage.setItem("bill-print-with-logo", next ? "1" : "0");
                } catch {
                  /* ignore */
                }
              }}
              className="size-3.5 accent-[#167c73]"
            />
            {t("common.watermark")}
          </label>
          <button
            type="button"
            onClick={() => window.print()}
            className="inline-flex h-8 items-center gap-2 bg-[#20221f] px-2.5 text-[11px] font-semibold text-white"
          >
            <Download size={18} />
            {downloadLabel}
          </button>
        </div>
      </div>

      <div className="bill-print-sheet overflow-hidden border border-[#e2ddd0] bg-white print:border-0">
        <BillWatermark src={printWithLogo ? logoUrl : null} />
        <div className="bill-letterhead overflow-hidden border-b border-[#e2ddd0] p-5">
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div className="flex min-w-0 flex-wrap items-start gap-4">
              {logoUrl ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={logoUrl}
                  alt={bill.tenant?.business_name ?? t("bill.business_logo")}
                  className="h-16 w-16 shrink-0 object-contain border border-[#d7d3c8] bg-white p-1"
                />
              ) : null}
              <div className="min-w-0">
                <p className="font-display text-3xl font-semibold uppercase leading-none">
                  {bill.tenant?.business_name ?? t("bill.business")}
                </p>
                {bill.show_shop && bill.branch?.name && (
                  <p className="mt-1 text-sm font-semibold uppercase tracking-wide text-[#167c73]">{bill.branch.name}</p>
                )}
                <p className="mt-1 text-sm text-[#6f746e]">{bill.bill_number}</p>
                <p className="mt-1 text-sm text-[#6f746e]">{t("print.date", { date: formatDate(bill.admission_date) })}</p>
                <div className="mt-1.5 space-y-0.5 text-sm print:text-xs">
                  {(bill.branch?.address || bill.tenant?.address) && <p>{bill.branch?.address || bill.tenant?.address}</p>}
                  {bill.tenant?.tin && <p>{t("common.tin")}: {bill.tenant.tin}</p>}
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

        <div className="bill-meta grid gap-4 border-b border-[#e2ddd0] p-5 sm:grid-cols-2">
          <div>
            <p className="text-[10px] font-bold uppercase text-[#6f746e]">{t("common.customer")}</p>
            <p className="mt-1 font-semibold">{bill.customer?.name ?? t("print.customer")}</p>
            {bill.customer?.phone && <p className="text-sm text-[#6f746e]">{bill.customer.phone}</p>}
            {bill.customer?.address && <p className="mt-1 text-sm text-[#6f746e]">{bill.customer.address}</p>}
            {(bill.driver_name || bill.driver_phone) && (
              <p className="mt-2 text-sm">
                <span className="text-[10px] font-bold uppercase text-[#6f746e]">{t("bill.driver")} </span>
                {[bill.driver_name, bill.driver_phone].filter(Boolean).join(" · ")}
              </p>
            )}
          </div>
          {bill.vehicle && (
            <div>
              <p className="text-[10px] font-bold uppercase text-[#6f746e]">{t("common.vehicle")}</p>
              <p className="mt-1 font-semibold">{bill.vehicle.number_plate}</p>
              <p className="text-sm text-[#6f746e]">
                {[bill.vehicle.make, bill.vehicle.model].filter(Boolean).join(" ") || "—"}
              </p>
              <p className="mt-2 text-sm">
                <span className="text-[10px] font-bold uppercase text-[#6f746e]">{t("bill.mileage")} </span>
                {bill.mileage != null && bill.mileage !== "" ? t("common.km", { count: Number(bill.mileage).toLocaleString() }) : "—"}
              </p>
              {bill.next_service_mileage != null && bill.next_service_mileage !== "" && (
                <p className="mt-1 text-sm">
                  <span className="text-[10px] font-bold uppercase text-[#6f746e]">{t("bill.next_service")} </span>
                  {t("common.km", { count: Number(bill.next_service_mileage).toLocaleString() })}
                </p>
              )}
            </div>
          )}
          {(bill.warranty_until || Number(bill.warranty_months) > 0) && (
            <div>
              <p className="text-[10px] font-bold uppercase text-[#6f746e]">{t("common.warranty")}</p>
              <p className="mt-1 font-semibold">
                {warrantyLabel(bill.warranty_months, bill.warranty_until, bill.warranty_starts_on, t)}
              </p>
            </div>
          )}
        </div>

        <div className="overflow-x-auto">
          <table className="bill-items-table w-full text-left text-sm">
            <thead className="border-b border-[#e2ddd0] bg-[#fbfaf6] text-[10px] uppercase text-[#6f746e]">
              <tr>
                <th className="px-5 py-3 font-bold">{t("common.item")}</th>
                <th className="px-3 py-3 font-bold">{t("common.qty")}</th>
                <th className="px-3 py-3 font-bold">{t("common.price")}</th>
                <th className="px-5 py-3 text-right font-bold">{t("common.total")}</th>
              </tr>
            </thead>
            <tbody>
              {chargeItems.map((item) => {
                const { title } = billLinePresentation(item);
                const hideHours = Boolean(item.hide_hours);
                const warranty = warrantyLabel(item.warranty_months, item.warranty_until, item.warranty_starts_on, t);
                return (
                <tr key={item.id} className="border-b border-[#f0ece3] align-top">
                  <td className="px-5 py-3">
                    <p className="font-semibold">{title}</p>
                    {warranty && <p className="mt-1 text-[11px] font-semibold uppercase text-[#167c73]">{warranty}</p>}
                  </td>
                  <td className="px-3 py-3 tabular-nums">{hideHours || item.quantity == null ? "—" : item.quantity}</td>
                  <td className="px-3 py-3 tabular-nums">{hideHours || item.unit_price == null ? "—" : money(item.unit_price)}</td>
                  <td className="px-5 py-3 text-right tabular-nums">{item.line_total == null ? "—" : money(item.line_total)}</td>
                </tr>
                );
              })}
              {discountItems.length > 0 && (
                <>
                  <tr className="bill-discount-row border-t-2 border-[#167c73]/35 bg-[#e7f4f2]">
                    <td colSpan={4} className="px-5 py-2 text-[10px] font-bold uppercase tracking-wide text-[#167c73]">
                      {t("common.discount")}
                    </td>
                  </tr>
                  {discountItems.map((item) => (
                    <tr key={item.id} className="bill-discount-row border-t border-[#167c73]/20 bg-[#e7f4f2] text-[#167c73]">
                      <td className="px-5 py-3">{item.description}</td>
                      <td className="px-3 py-3 tabular-nums">{item.quantity == null ? "—" : item.quantity}</td>
                      <td className="px-3 py-3 tabular-nums">{item.unit_price == null ? "—" : money(item.unit_price)}</td>
                      <td className="px-5 py-3 text-right font-semibold tabular-nums">{item.line_total == null ? "—" : `-${money(item.line_total)}`}</td>
                    </tr>
                  ))}
                </>
              )}
              {!billItems.length && (
                <tr>
                  <td colSpan={4} className="px-5 py-8 text-center text-[#6f746e]">
                    {t("print.no_lines")}
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        <div className="bill-summary space-y-2 border-t border-[#e2ddd0] p-5 text-sm">
          {stamp === "repair_note" ? (
            <p className="text-[#6f746e]">{t("bill.work_list")}</p>
          ) : (
            <>
          <div className="flex justify-between">
            <span className="text-[#6f746e]">{t("common.subtotal")}</span>
            <strong className="tabular-nums">{money(bill.subtotal ?? 0)}</strong>
          </div>
          {Number(bill.total_deductions) > 0 && (
            <div className="bill-discount-row -mx-2 flex justify-between rounded-sm bg-[#e7f4f2] px-2 py-1.5 text-[#167c73]">
              <span>{t("bill.deductions")}</span>
              <strong className="tabular-nums">-{money(bill.total_deductions ?? 0)}</strong>
            </div>
          )}
          {Number(bill.vat_amount) > 0 && (
            <div className="flex justify-between">
              <span className="text-[#6f746e]">{t("bill.vat")} {bill.vat_rate ? `(${bill.vat_rate}%)` : ""}</span>
              <strong className="tabular-nums">{money(bill.vat_amount ?? 0)}</strong>
            </div>
          )}
          {Number(bill.sscl_amount) > 0 && (
            <div className="flex justify-between">
              <span className="text-[#6f746e]">{t("bill.sscl")} {bill.sscl_rate ? `(${bill.sscl_rate}%)` : ""}</span>
              <strong className="tabular-nums">{money(bill.sscl_amount ?? 0)}</strong>
            </div>
          )}
          <div className="flex justify-between border-t border-[#e2ddd0] pt-2 text-base">
            <span className="font-semibold">{t("common.total")}</span>
            <strong className="tabular-nums">{money(billNetTotal(bill))}</strong>
          </div>
          {paid ? (
            <>
              <div className="flex justify-between">
                <span className="text-[#6f746e]">{t("print.amount_paid")}</span>
                <strong className="tabular-nums">{money(bill.amount_paid ?? 0)}</strong>
              </div>
              <div className="flex justify-between border-t border-[#e2ddd0] pt-2 text-base">
                <span className="font-semibold text-[#167c73]">{t("print.paid_in_full")}</span>
                <strong className="tabular-nums text-[#167c73]">{money(0)}</strong>
              </div>
            </>
          ) : (
            <>
              {Number(bill.amount_paid) > 0 && (
                <div className="flex justify-between">
                  <span className="text-[#6f746e]">{t("print.amount_paid")}</span>
                  <strong className="tabular-nums">{money(bill.amount_paid ?? 0)}</strong>
                </div>
              )}
              <div className="flex justify-between border-t border-[#e2ddd0] pt-2 text-base">
                <span className="font-semibold">{t("print.balance_due")}</span>
                <strong className="tabular-nums">{money(bill.balance_due ?? 0)}</strong>
              </div>
              {stamp === "quote" && (
                <p className="pt-2 text-xs text-[#6f746e]">
                  {t("print.quote_note")}
                </p>
              )}
            </>
          )}
            </>
          )}
        </div>
        {bill.additional_note?.trim() && (
          <div className={`bill-additional-note px-5 py-4 text-sm ${bill.additional_note_color === "red" ? "bg-[#7a1c2e]/20 text-[#7a1c2e]" : "bg-[#1b365d]/20 text-[#1b365d]"}`}>
            <p className="text-[10px] font-bold uppercase tracking-wide opacity-80">{t("print.additional_note")}</p>
            <p className="mt-2 whitespace-pre-wrap">{bill.additional_note}</p>
          </div>
        )}
        {(bill.photos?.length || bill.videos?.length) ? (
          <div className="print:hidden space-y-6 border-t border-[#e2ddd0] p-5">
            {!!bill.photos?.length && (
              <div>
                <p className="text-[10px] font-bold uppercase tracking-wide text-[#6f746e]">{t("print.photos")}</p>
                <div className="mt-3 grid grid-cols-2 gap-3 sm:grid-cols-3">
                  {bill.photos.map((photo) => (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      key={photo.id}
                      src={`${API_URL}/bills/shared/${encodeURIComponent(token)}/photos/${photo.id}/file`}
                      alt={photo.original_name || ""}
                      className="aspect-[4/3] w-full border border-[#e2ddd0] bg-[#f7f5ef] object-contain"
                    />
                  ))}
                </div>
              </div>
            )}
            {!!bill.videos?.length && (
              <div>
                <p className="text-[10px] font-bold uppercase tracking-wide text-[#6f746e]">{t("print.videos")}</p>
                <div className="mt-3 space-y-3">
                  {bill.videos.map((video) => (
                    <video
                      key={video.id}
                      className="w-full max-w-lg bg-black"
                      src={`${API_URL}/bills/shared/${encodeURIComponent(token)}/videos/${video.id}/file`}
                      controls
                      preload="metadata"
                    />
                  ))}
                </div>
              </div>
            )}
          </div>
        ) : null}
      </div>
    </main>
  );
}
