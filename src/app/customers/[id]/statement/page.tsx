"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { useEffect, useState } from "react";
import { ArrowLeft, Printer } from "lucide-react";
import { AppShell } from "@/components/app-shell";
import { ErrorMessage, PageState, buttonClass } from "@/components/ui";
import { api, currentUser, formatDate, mediaUrl, money } from "@/lib/api";
import { billStatusLabel } from "@/lib/bill-stamp";

type Statement = {
  id: number;
  name: string;
  phone?: string | null;
  address?: string | null;
  outstanding_balance?: number | string;
  bills: Array<{
    id: number;
    bill_number: string;
    admission_date: string;
    status: string;
    subtotal: string;
    balance_due: string;
    vehicle?: { number_plate: string } | null;
  }>;
};

export default function CustomerStatementPage() {
  const { id } = useParams<{ id: string }>();
  const [customer, setCustomer] = useState<Statement | null>(null);
  const [error, setError] = useState("");
  const tenant = currentUser()?.tenant;
  const logoUrl = mediaUrl(tenant?.logo_url || tenant?.logo);

  useEffect(() => {
    api<Statement>(`/customers/${id}/statement`)
      .then(setCustomer)
      .catch((caught) => setError(caught.message));
  }, [id]);

  if (!customer && !error) {
    return <AppShell title="Statement"><PageState message="Loading statement..." /></AppShell>;
  }
  if (error || !customer) {
    return <AppShell title="Statement"><ErrorMessage message={error || "Customer not found."} /></AppShell>;
  }

  const outstanding = Number(customer.outstanding_balance ?? 0);

  return (
    <AppShell
      title="Statement"
      eyebrow={customer.name}
      action={
        <button type="button" onClick={() => window.print()} className={buttonClass}>
          <Printer size={14} /> Print
        </button>
      }
    >
      <div className="no-print mb-5">
        <Link href={`/customers/${customer.id}`} className="inline-flex items-center gap-2 text-xs font-bold uppercase text-[#6f746e] hover:text-[#167c73]">
          <ArrowLeft size={14} /> Back to customer
        </Link>
      </div>
      <section className="border border-[#d7d3c8] bg-[#fbfaf6] p-6 print:border-0">
        <div className="flex items-start justify-between gap-4">
          <div>
            {logoUrl ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={logoUrl} alt="" className="mb-3 h-14 w-14 object-contain" />
            ) : null}
            <h2 className="font-display text-3xl font-semibold uppercase">{tenant?.business_name ?? "Statement"}</h2>
            <p className="mt-1 text-sm text-[#6f746e]">{tenant?.address}</p>
          </div>
          <div className="text-right text-sm">
            <p className="text-[10px] font-bold uppercase text-[#6f746e]">Customer</p>
            <p className="font-semibold">{customer.name}</p>
            <p>{customer.phone || "—"}</p>
            <p>{customer.address || "—"}</p>
          </div>
        </div>
        <div className="mt-6 flex justify-between border-y border-[#20221f] py-3">
          <span className="text-xs font-bold uppercase">Outstanding</span>
          <strong className={`tabular-nums ${outstanding > 0 ? "text-[#b84837]" : ""}`}>{money(outstanding)}</strong>
        </div>
        <table className="mt-4 w-full text-left text-sm">
          <thead className="text-[10px] uppercase text-[#6f746e]">
            <tr>
              <th className="py-2">Ref</th>
              <th>Date</th>
              <th>Detail</th>
              <th>Status</th>
              <th className="text-right">Total</th>
              <th className="text-right">Due</th>
            </tr>
          </thead>
          <tbody>
            {customer.bills.map((bill) => (
              <tr key={bill.id} className="border-t border-[#e2ded4]">
                <td className="py-2 font-semibold">{bill.bill_number}</td>
                <td>{formatDate(bill.admission_date)}</td>
                <td>{bill.vehicle?.number_plate ?? "—"}</td>
                <td>{billStatusLabel(bill.status)}</td>
                <td className="text-right tabular-nums">{money(bill.subtotal)}</td>
                <td className="text-right tabular-nums">{money(bill.balance_due)}</td>
              </tr>
            ))}
          </tbody>
        </table>
        {customer.bills.length === 0 && <p className="py-6 text-sm text-[#6f746e]">No jobs on this account.</p>}
      </section>
    </AppShell>
  );
}
