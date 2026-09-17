"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { useEffect, useState } from "react";
import { ArrowLeft, Printer } from "lucide-react";
import { AppShell } from "@/components/app-shell";
import { ErrorMessage, PageState, buttonClass } from "@/components/ui";
import { api, currentUser, formatDate } from "@/lib/api";

type Transfer = {
  id: number;
  transfer_number?: string | null;
  status: string;
  notes?: string | null;
  created_at: string;
  received_at?: string | null;
  from_branch?: { name: string; address?: string | null };
  to_branch?: { name: string; address?: string | null };
  creator?: { name: string } | null;
  receiver?: { name: string } | null;
  items?: Array<{
    id: number;
    quantity: number;
    part?: { name: string; sku?: string | null } | null;
    product?: { name: string; sku?: string | null } | null;
  }>;
};

export default function TransferPrintPage() {
  const { id } = useParams<{ id: string }>();
  const [transfer, setTransfer] = useState<Transfer | null>(null);
  const [error, setError] = useState("");
  const tenant = currentUser()?.tenant;

  useEffect(() => {
    api<Transfer>(`/stock-transfers/${id}`)
      .then(setTransfer)
      .catch((caught) => setError(caught.message));
  }, [id]);

  if (!transfer && !error) {
    return <AppShell title="Transfer"><PageState message="Loading transfer..." /></AppShell>;
  }
  if (error || !transfer) {
    return <AppShell title="Transfer"><ErrorMessage message={error || "Transfer not found."} /></AppShell>;
  }

  return (
    <AppShell
      title={transfer.transfer_number || `TRF-${transfer.id}`}
      eyebrow="Stock transfer"
      action={<button type="button" onClick={() => window.print()} className={buttonClass}><Printer size={14} /> Print</button>}
    >
      <div className="no-print mb-5">
        <Link href="/shops" className="inline-flex items-center gap-2 text-xs font-bold uppercase text-[#6f746e] hover:text-[#167c73]">
          <ArrowLeft size={14} /> Back to shops
        </Link>
      </div>
      <section className="border border-[#d7d3c8] bg-[#fbfaf6] p-6 print:border-0">
        <h2 className="font-display text-3xl font-semibold uppercase">{tenant?.business_name}</h2>
        <p className="mt-1 text-sm text-[#6f746e]">Stock transfer {transfer.transfer_number}</p>
        <div className="mt-4 grid gap-4 sm:grid-cols-2 text-sm">
          <div>
            <p className="text-[10px] font-bold uppercase text-[#6f746e]">From</p>
            <p className="font-semibold">{transfer.from_branch?.name}</p>
            <p>{transfer.from_branch?.address}</p>
          </div>
          <div>
            <p className="text-[10px] font-bold uppercase text-[#6f746e]">To</p>
            <p className="font-semibold">{transfer.to_branch?.name}</p>
            <p>{transfer.to_branch?.address}</p>
          </div>
        </div>
        <p className="mt-4 text-sm">Created {formatDate(transfer.created_at)} · {transfer.status}{transfer.received_at ? ` · received ${formatDate(transfer.received_at)}` : ""}</p>
        {transfer.notes && <p className="mt-2 text-sm">{transfer.notes}</p>}
        <table className="mt-4 w-full text-left text-sm">
          <thead className="text-[10px] uppercase text-[#6f746e]">
            <tr><th className="py-2">Item</th><th>SKU</th><th className="text-right">Qty</th></tr>
          </thead>
          <tbody>
            {(transfer.items ?? []).map((item) => {
              const stock = item.part || item.product;
              return (
                <tr key={item.id} className="border-t border-[#e2ded4]">
                  <td className="py-2 font-semibold">{stock?.name ?? "—"}</td>
                  <td>{stock?.sku ?? "—"}</td>
                  <td className="text-right tabular-nums">{item.quantity}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
        <div className="mt-10 grid grid-cols-2 gap-8 text-sm">
          <p>Sent by: {transfer.creator?.name ?? "—"}</p>
          <p>Received by: {transfer.receiver?.name ?? "—"}</p>
        </div>
      </section>
    </AppShell>
  );
}
