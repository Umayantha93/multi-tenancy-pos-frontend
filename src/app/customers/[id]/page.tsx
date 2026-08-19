"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { useEffect, useState } from "react";
import { ArrowLeft, ArrowRight } from "lucide-react";
import { AppShell } from "@/components/app-shell";
import { ErrorMessage, PageState, Panel } from "@/components/ui";
import { api, formatDate, money } from "@/lib/api";
import { billStatusClass, billStatusLabel } from "@/lib/bill-stamp";

type CustomerDetail = {
  id: number;
  name: string;
  phone: string;
  address?: string | null;
  vehicles_count: number;
  bills_count: number;
  vehicles: Array<{ id: number; number_plate: string; make?: string; model?: string; chassis_number: string }>;
  bills: Array<{
    id: number;
    bill_number: string;
    admission_date: string;
    status: string;
    subtotal: string;
    balance_due: string;
    vehicle?: { number_plate: string; make?: string; model?: string };
  }>;
};

export default function CustomerDetailPage() {
  const { id } = useParams<{ id: string }>();
  const [customer, setCustomer] = useState<CustomerDetail | null>(null);
  const [error, setError] = useState("");

  useEffect(() => {
    api<CustomerDetail>(`/customers/${id}`)
      .then(setCustomer)
      .catch((caught) => setError(caught.message));
  }, [id]);

  if (!customer && !error) {
    return <AppShell title="Customer" eyebrow="Details"><PageState message="Loading customer..." /></AppShell>;
  }

  if (error || !customer) {
    return <AppShell title="Customer" eyebrow="Details"><ErrorMessage message={error || "Customer not found."} /></AppShell>;
  }

  return (
    <AppShell title={customer.name} eyebrow={customer.phone}>
      <div className="mb-5">
        <Link href="/customers" className="inline-flex items-center gap-2 text-xs font-bold uppercase text-[#6f746e] hover:text-[#167c73]">
          <ArrowLeft size={14} /> All customers
        </Link>
      </div>

      <div className="grid gap-5 xl:grid-cols-[0.8fr_1.2fr]">
        <div className="space-y-5">
          <Panel className="p-5">
            <p className="text-[10px] font-bold uppercase text-[#167c73]">Customer</p>
            <h2 className="mt-1 font-display text-3xl font-semibold uppercase">{customer.name}</h2>
            <dl className="mt-6 space-y-3 text-sm">
              <div className="flex justify-between border-b border-[#e2ded4] pb-3">
                <dt className="text-[#6f746e]">Phone</dt>
                <dd className="font-semibold">{customer.phone}</dd>
              </div>
              <div className="flex justify-between border-b border-[#e2ded4] pb-3">
                <dt className="text-[#6f746e]">Address</dt>
                <dd className="text-right">{customer.address || "—"}</dd>
              </div>
              <div className="flex justify-between border-b border-[#e2ded4] pb-3">
                <dt className="text-[#6f746e]">Vehicles</dt>
                <dd className="font-semibold">{customer.vehicles_count}</dd>
              </div>
              <div className="flex justify-between">
                <dt className="text-[#6f746e]">Jobs done</dt>
                <dd className="font-semibold">{customer.bills_count}</dd>
              </div>
            </dl>
          </Panel>

          <Panel>
            <div className="border-b border-[#d7d3c8] px-5 py-4">
              <h2 className="font-display text-2xl font-semibold uppercase">Vehicles</h2>
            </div>
            <div className="divide-y divide-[#e2ded4]">
              {customer.vehicles.map((vehicle) => (
                <div key={vehicle.id} className="px-5 py-3 text-sm">
                  <p className="font-semibold">{vehicle.number_plate}</p>
                  <p className="text-xs text-[#6f746e]">
                    {vehicle.make} {vehicle.model} · {vehicle.chassis_number || "No chassis"}
                  </p>
                </div>
              ))}
              {customer.vehicles.length === 0 && (
                <p className="p-5 text-sm text-[#6f746e]">No vehicles on record.</p>
              )}
            </div>
          </Panel>
        </div>

        <Panel className="overflow-hidden">
          <div className="border-b border-[#d7d3c8] px-5 py-4">
            <h2 className="font-display text-2xl font-semibold uppercase">Job history</h2>
            <p className="text-xs text-[#6f746e]">{customer.bills_count} job card{customer.bills_count === 1 ? "" : "s"}</p>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full min-w-[640px] text-left text-sm">
              <thead className="bg-[#eeece5] text-[10px] uppercase text-[#6f746e]">
                <tr>
                  <th className="px-5 py-3">Job</th>
                  <th>Vehicle</th>
                  <th>Status</th>
                  <th>Total</th>
                  <th>Due</th>
                  <th />
                </tr>
              </thead>
              <tbody>
                {customer.bills.map((bill) => (
                  <tr key={bill.id} className="border-t border-[#e2ded4]">
                    <td className="px-5 py-4">
                      <p className="font-semibold">{bill.bill_number}</p>
                      <p className="text-xs text-[#6f746e]">{formatDate(bill.admission_date)}</p>
                    </td>
                    <td>{bill.vehicle?.number_plate ?? "—"}</td>
                    <td>
                      <span className={`px-2 py-1 text-[10px] font-bold uppercase ${billStatusClass(bill.status)}`}>
                        {billStatusLabel(bill.status)}
                      </span>
                    </td>
                    <td>{money(bill.subtotal)}</td>
                    <td className="font-semibold">{money(bill.balance_due)}</td>
                    <td>
                      <Link href={`/bills/${bill.id}`} className="text-[#167c73]" aria-label={`Open ${bill.bill_number}`}>
                        <ArrowRight size={18} />
                      </Link>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            {customer.bills.length === 0 && (
              <p className="p-8 text-center text-sm text-[#6f746e]">No jobs for this customer yet.</p>
            )}
          </div>
        </Panel>
      </div>
    </AppShell>
  );
}
