"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { X } from "lucide-react";
import { AppShell } from "@/components/app-shell";
import { buttonClass, ErrorMessage, inputClass, PageState, Panel } from "@/components/ui";
import { api, currentUser, formatDate, money } from "@/lib/api";
import { billStatusClass, billStatusLabel } from "@/lib/bill-stamp";

type JobKindFilter = "service" | "repair" | "parts_sale" | null;

type ProfitLine = {
  id: number;
  type: string;
  description: string;
  quantity: string;
  unit_price: string;
  purchase_unit_cost?: string | null;
  line_total: string;
  cogs: number;
  profit: number;
};

type ProfitBill = {
  id: number;
  bill_number: string;
  admission_date: string;
  status: string;
  owe_in_due_date?: string | null;
  customer: { name: string; phone?: string } | null;
  vehicle: { number_plate: string } | null;
  amount_paid: string;
  balance_due: string;
  subtotal: string;
  revenue: number;
  cogs: number;
  profit: number;
  margin: number;
  billing_type: "instant" | "credit";
  payment_status: string;
  job_kind?: "service" | "repair" | "parts_sale";
  lines?: ProfitLine[];
  payments?: Array<{ id: number; amount: string; method: string; paid_at: string }>;
};

type Report = {
  period: { date_from: string; date_to: string };
  job_kind?: "service" | "repair" | "parts_sale" | null;
  total_revenue: number;
  total_cogs: number;
  gross_profit: number;
  margin: number;
  service_revenue: number;
  service_cogs: number;
  service_gross_profit: number;
  service_margin: number;
  service_count: number;
  repair_revenue: number;
  repair_cogs: number;
  repair_gross_profit: number;
  repair_margin: number;
  repair_count: number;
  parts_sale_revenue: number;
  parts_sale_cogs: number;
  parts_sale_gross_profit: number;
  parts_sale_margin: number;
  parts_sale_count: number;
  credit_count: number;
  credit_generated: number;
  credit_collected: number;
  credit_pending: number;
  bills: { data: ProfitBill[] };
};

function daysAgo(days: number) {
  const date = new Date();
  date.setDate(date.getDate() - days);
  return date.toISOString().slice(0, 10);
}

export default function BillProfitsPage() {
  const [isGarage, setIsGarage] = useState(false);
  const [dateFrom, setDateFrom] = useState(() => daysAgo(29));
  const [dateTo, setDateTo] = useState(() => new Date().toISOString().slice(0, 10));
  const [jobKind, setJobKind] = useState<JobKindFilter>(null);
  const [report, setReport] = useState<Report | null>(null);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);
  const [detail, setDetail] = useState<ProfitBill | null>(null);
  const [detailBusy, setDetailBusy] = useState(false);
  const rangeInvalid = Boolean(dateFrom && dateTo && dateFrom > dateTo);

  const load = useCallback(() => {
    if (rangeInvalid) {
      setError("From date must be on or before To date.");
      setLoading(false);
      return;
    }
    setLoading(true);
    setError("");
    const params = new URLSearchParams({ date_from: dateFrom, date_to: dateTo, per_page: "50" });
    if (jobKind) params.set("job_kind", jobKind);
    api<Report>(`/bill-profits?${params}`)
      .then(setReport)
      .catch((caught) => setError(caught instanceof Error ? caught.message : "Could not load bill profits."))
      .finally(() => setLoading(false));
  }, [dateFrom, dateTo, jobKind, rangeInvalid]);

  useEffect(() => { load(); }, [load]);
  useEffect(() => {
    const type = currentUser()?.tenant?.business_type;
    setIsGarage(type === "garage" || type === "tyre" || type === "device_repair");
  }, []);

  function toggleKind(kind: "service" | "repair" | "parts_sale") {
    setJobKind((current) => (current === kind ? null : kind));
  }

  async function openDetails(billId: number) {
    setDetailBusy(true);
    setError("");
    try {
      setDetail(await api<ProfitBill>(`/bill-profits/${billId}`));
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Could not load bill details.");
    } finally {
      setDetailBusy(false);
    }
  }

  const periodLabel = useMemo(() => {
    if (!report) return "";
    return `${formatDate(report.period.date_from)} – ${formatDate(report.period.date_to)}`;
  }, [report]);

  const summary = useMemo(() => {
    if (!report) return null;
    if (jobKind === "service") {
      return {
        title: "Service",
        revenue: report.service_revenue,
        cogs: report.service_cogs,
        profit: report.service_gross_profit,
        margin: report.service_margin,
        count: report.service_count,
      };
    }
    if (jobKind === "repair") {
      return {
        title: "Repair",
        revenue: report.repair_revenue,
        cogs: report.repair_cogs,
        profit: report.repair_gross_profit,
        margin: report.repair_margin,
        count: report.repair_count,
      };
    }
    if (jobKind === "parts_sale") {
      return {
        title: "Instant bills",
        revenue: report.parts_sale_revenue,
        cogs: report.parts_sale_cogs,
        profit: report.parts_sale_gross_profit,
        margin: report.parts_sale_margin,
        count: report.parts_sale_count,
      };
    }
    return {
      title: "All",
      revenue: report.total_revenue,
      cogs: report.total_cogs,
      profit: report.gross_profit,
      margin: report.margin,
      count: report.service_count + report.repair_count + (report.parts_sale_count || 0),
    };
  }, [jobKind, report]);

  const kindButton = (kind: "service" | "repair" | "parts_sale", label: string) => {
    const selected = jobKind === kind;
    return (
      <button
        type="button"
        onClick={() => toggleKind(kind)}
        className={`inline-flex h-9 items-center border px-3 text-[13px] font-semibold ${
          selected
            ? "border-[#20221f] bg-[#20221f] text-white"
            : "border-[#c9c5b9] bg-white hover:border-[#20221f]"
        }`}
      >
        {label}
      </button>
    );
  };

  return (
    <AppShell title="Bill Profits Analysis" eyebrow="Revenue, inventory cost & credit bills">
      <div className="mb-5 flex flex-wrap items-end gap-3">
        <label className="block">
          <span className="mb-1 block text-[10px] font-bold uppercase text-[#6f746e]">From</span>
          <input type="date" value={dateFrom} max={dateTo || undefined} onChange={(event) => setDateFrom(event.target.value)} className={`${inputClass} w-auto min-w-40`} />
        </label>
        <label className="block">
          <span className="mb-1 block text-[10px] font-bold uppercase text-[#6f746e]">To</span>
          <input type="date" value={dateTo} min={dateFrom || undefined} onChange={(event) => setDateTo(event.target.value)} className={`${inputClass} w-auto min-w-40`} />
        </label>
        <button type="button" onClick={load} className={buttonClass}>Apply period</button>
        {isGarage && (
          <div className="flex flex-wrap gap-2">
            {kindButton("service", "Services")}
            {kindButton("repair", "Repair")}
            {kindButton("parts_sale", "Instant bills")}
          </div>
        )}
      </div>

      {error && <div className="mb-5"><ErrorMessage message={error} /></div>}
      {loading && !report ? <PageState message="Loading bill profits..." /> : report && summary && (
        <>
          <p className="mb-3 text-xs font-bold uppercase text-[#6f746e]">
            {periodLabel}
            {jobKind === "service" ? " · Service bills" : jobKind === "repair" ? " · Repair bills" : ""}
          </p>
          <div className="grid gap-3 sm:grid-cols-3">
            <Panel className="p-5">
              <p className="text-xs font-bold uppercase text-[#6f746e]">
                {jobKind ? `${summary.title} revenue` : "Total revenue (bills)"}
              </p>
              <p className="mt-3 font-display text-3xl font-semibold">{money(summary.revenue)}</p>
              <p className="mt-2 text-xs text-[#6f746e]">
                {summary.count} bill{summary.count === 1 ? "" : "s"}
              </p>
            </Panel>
            <Panel className="p-5">
              <p className="text-xs font-bold uppercase text-[#6f746e]">
                {jobKind ? `${summary.title} cost of goods` : "Cost of goods sold"}
              </p>
              <p className="mt-3 font-display text-3xl font-semibold">{money(summary.cogs)}</p>
            </Panel>
            <Panel className="bg-[#242723] p-5 text-white">
              <p className="text-xs font-bold uppercase text-white/50">
                {jobKind ? `${summary.title} gross profit` : "Gross profit"}
              </p>
              <p className="mt-3 font-display text-3xl font-semibold">{money(summary.profit)}</p>
              <p className="mt-2 text-xs text-white/50">Gross margin {summary.margin}%</p>
            </Panel>
          </div>

          <Panel className="mt-5 p-5">
            <h2 className="font-display text-2xl font-semibold uppercase">Credit bills</h2>
            <div className="mt-4 grid gap-4 sm:grid-cols-3">
              <div>
                <p className="text-[10px] font-bold uppercase text-[#6f746e]">Generated · {report.credit_count} bills</p>
                <p className="mt-1 text-xl font-semibold">{money(report.credit_generated)}</p>
              </div>
              <div>
                <p className="text-[10px] font-bold uppercase text-[#6f746e]">Collected</p>
                <p className="mt-1 text-xl font-semibold text-[#167c73]">{money(report.credit_collected)}</p>
              </div>
              <div>
                <p className="text-[10px] font-bold uppercase text-[#6f746e]">Pending balance</p>
                <p className="mt-1 text-xl font-semibold text-[#b84837]">{money(report.credit_pending)}</p>
              </div>
            </div>
          </Panel>

          <Panel className="mt-5 overflow-hidden">
            <div className="border-b border-[#d7d3c8] px-5 py-4">
              <h2 className="font-display text-2xl font-semibold uppercase">
                {jobKind === "service" ? "Service bills" : jobKind === "repair" ? "Repair bills" : "Bills"}
              </h2>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full min-w-[960px] text-left text-sm">
                <thead className="bg-[#eeece5] text-[10px] uppercase text-[#6f746e]">
                  <tr>
                    <th className="px-5 py-3">Bill</th>
                    <th>Date</th>
                    {isGarage && <th>Type</th>}
                    <th>Customer</th>
                    <th>Payment</th>
                    <th>Billing type</th>
                    <th className="text-right">Total</th>
                    <th className="text-right">COGS</th>
                    <th className="text-right">Profit</th>
                    <th className="pr-5 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {report.bills.data.map((bill) => (
                    <tr key={bill.id} className="border-t border-[#e2ded4]">
                      <td className="px-5 py-4 font-semibold">{bill.bill_number}</td>
                      <td>{formatDate(bill.admission_date)}</td>
                      {isGarage && (
                        <td className="capitalize">{bill.job_kind === "service" ? "Service" : "Repair"}</td>
                      )}
                      <td>{bill.customer?.name ?? "Walk-in"}</td>
                      <td>
                        <span className={`px-2 py-1 text-[10px] font-bold uppercase ${billStatusClass(bill.status, bill.owe_in_due_date)}`}>
                          {billStatusLabel(bill.payment_status)}
                        </span>
                      </td>
                      <td className="capitalize">{bill.billing_type}</td>
                      <td className="text-right tabular-nums">{money(bill.revenue)}</td>
                      <td className="text-right tabular-nums">{money(bill.cogs)}</td>
                      <td className="text-right font-semibold tabular-nums text-[#167c73]">{money(bill.profit)}</td>
                      <td className="pr-5 text-right">
                        <button type="button" onClick={() => openDetails(bill.id)} className="text-sm font-semibold text-[#167c73]">
                          View details
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
              {report.bills.data.length === 0 && (
                <p className="p-8 text-center text-sm text-[#6f746e]">No bills in this date range.</p>
              )}
            </div>
          </Panel>
        </>
      )}

      {detail && (
        <div className="fixed inset-0 z-[80] flex items-center justify-center p-4">
          <button type="button" aria-label="Close dialog" className="absolute inset-0 bg-[#181b19]/55" onClick={() => setDetail(null)} />
          <div className="relative z-10 max-h-[90vh] w-full max-w-2xl overflow-y-auto border border-[#d7d3c8] bg-[#fbfaf6]">
            <div className="flex items-start justify-between border-b border-[#e2ded4] px-5 py-4">
              <div>
                <p className="text-[10px] font-bold uppercase tracking-wide text-[#167c73]">Bill details</p>
                <h2 className="mt-1 font-display text-2xl font-semibold uppercase">{detail.bill_number}</h2>
                <p className="mt-1 text-sm text-[#6f746e]">
                  {detail.customer?.name ?? "Walk-in"} · {detail.vehicle?.number_plate ?? "—"} · {formatDate(detail.admission_date)}
                  {detail.job_kind ? ` · ${detail.job_kind === "service" ? "Service" : "Repair"}` : ""}
                </p>
              </div>
              <button type="button" onClick={() => setDetail(null)} className="grid size-9 place-items-center border border-[#d7d3c8]" aria-label="Close">
                <X size={16} />
              </button>
            </div>
            <div className="space-y-4 p-5">
              {detailBusy ? <PageState message="Loading..." /> : (
                <>
                  <div className="grid gap-3 sm:grid-cols-3 text-sm">
                    <div className="border border-[#e2ded4] p-3"><p className="text-[10px] font-bold uppercase text-[#6f746e]">Revenue</p><p className="mt-1 font-semibold">{money(detail.revenue)}</p></div>
                    <div className="border border-[#e2ded4] p-3"><p className="text-[10px] font-bold uppercase text-[#6f746e]">COGS</p><p className="mt-1 font-semibold">{money(detail.cogs)}</p></div>
                    <div className="border border-[#e2ded4] p-3"><p className="text-[10px] font-bold uppercase text-[#6f746e]">Profit</p><p className="mt-1 font-semibold text-[#167c73]">{money(detail.profit)}</p></div>
                  </div>
                  <table className="w-full text-left text-sm">
                    <thead className="bg-[#eeece5] text-[10px] uppercase text-[#6f746e]">
                      <tr>
                        <th className="px-3 py-2">Line</th>
                        <th className="text-right">Sell</th>
                        <th className="text-right">Cost</th>
                        <th className="text-right">Profit</th>
                      </tr>
                    </thead>
                    <tbody>
                      {(detail.lines ?? []).map((line) => (
                        <tr key={line.id} className="border-t border-[#e2ded4]">
                          <td className="px-3 py-2">
                            <p className="font-semibold">{line.description}</p>
                            <p className="text-[10px] uppercase text-[#6f746e]">{line.type.replaceAll("_", " ")} · qty {Number(line.quantity)}</p>
                          </td>
                          <td className="text-right tabular-nums">{money(line.line_total)}</td>
                          <td className="text-right tabular-nums">{money(line.cogs)}</td>
                          <td className="text-right font-semibold tabular-nums">{money(line.profit)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                  {(detail.payments?.length ?? 0) > 0 && (
                    <div>
                      <p className="text-[10px] font-bold uppercase text-[#6f746e]">Payments</p>
                      <div className="mt-2 space-y-1 text-sm">
                        {detail.payments?.map((payment) => (
                          <div key={payment.id} className="flex justify-between">
                            <span className="uppercase text-[#6f746e]">{payment.method.replace("_", " ")} · {formatDate(payment.paid_at)}</span>
                            <strong>{money(payment.amount)}</strong>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </>
              )}
            </div>
          </div>
        </div>
      )}
    </AppShell>
  );
}
