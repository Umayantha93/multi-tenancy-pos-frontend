"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { FormEvent, Suspense, useEffect, useState } from "react";
import { ArrowRight, Search } from "lucide-react";
import { PlatformShell } from "@/components/platform-shell";
import { ErrorMessage, PageState, Panel, inputClass } from "@/components/ui";
import { api, formatDate, money, Tenant } from "@/lib/api";
import { billStatusClass, billStatusLabel } from "@/lib/bill-stamp";

type TenantRow = Tenant & { owner_email?: string | null };
type TenantPage = { data: TenantRow[] };
type BillRow = {
  id: number;
  bill_number: string;
  admission_date: string;
  status: string;
  subtotal: string;
  amount_paid: string;
  balance_due: string;
  customer: { name: string; phone: string } | null;
  vehicle: { number_plate: string } | null;
};
type BillPage = { data: BillRow[]; total: number };

function statusClass(status: string) {
  return billStatusClass(status);
}

function InvoicesPageInner() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const tenantParam = searchParams.get("tenant") || "";
  const [tenants, setTenants] = useState<TenantRow[]>([]);
  const [tenantId, setTenantId] = useState(tenantParam);
  const [bills, setBills] = useState<BillPage | null>(null);
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    api<TenantPage>("/super-admin/tenants?per_page=100&status=")
      .then((page) => setTenants(page.data))
      .catch((caught) => setError(caught.message));
  }, []);

  useEffect(() => {
    setTenantId(tenantParam);
  }, [tenantParam]);

  useEffect(() => {
    if (!tenantId) {
      setBills(null);
      return;
    }
    setLoading(true);
    setError("");
    const timer = setTimeout(() => {
      const params = new URLSearchParams({ per_page: "50" });
      if (search) params.set("search", search);
      if (status) params.set("status", status);
      api<BillPage>(`/super-admin/tenants/${tenantId}/bills?${params}`)
        .then(setBills)
        .catch((caught) => setError(caught.message))
        .finally(() => setLoading(false));
    }, 250);
    return () => clearTimeout(timer);
  }, [tenantId, search, status]);

  function selectTenant(id: string) {
    setTenantId(id);
    const next = new URLSearchParams();
    if (id) next.set("tenant", id);
    router.replace(id ? `/super-admin/invoices?${next}` : "/super-admin/invoices");
  }

  function submit(event: FormEvent) {
    event.preventDefault();
  }

  const selected = tenants.find((tenant) => String(tenant.id) === tenantId);

  return (
    <PlatformShell title="Tenants invoices" eyebrow="Platform control">
      <form onSubmit={submit} className="mb-5 grid gap-3 lg:grid-cols-[1.4fr_1fr_180px]">
        <label>
          <span className="mb-1 block text-[10px] font-bold uppercase text-[#6f746e]">Tenant</span>
          <select
            value={tenantId}
            onChange={(event) => selectTenant(event.target.value)}
            className={inputClass}
          >
            <option value="">Select a business</option>
            {tenants.map((tenant) => (
              <option key={tenant.id} value={tenant.id}>
                {tenant.business_name}
              </option>
            ))}
          </select>
        </label>
        <label className="relative">
          <span className="mb-1 block text-[10px] font-bold uppercase text-[#6f746e]">Search bills</span>
          <Search size={17} className="absolute left-3 top-9 text-[#6f746e]" />
          <input
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            placeholder="Bill number, customer, plate"
            className={`${inputClass} pl-10`}
            disabled={!tenantId}
          />
        </label>
        <label>
          <span className="mb-1 block text-[10px] font-bold uppercase text-[#6f746e]">Status</span>
          <select
            value={status}
            onChange={(event) => setStatus(event.target.value)}
            className={inputClass}
            disabled={!tenantId}
          >
            <option value="">All</option>
            <option value="open">Open</option>
            <option value="partially_paid">Partially paid</option>
            <option value="paid">Paid</option>
            <option value="closed">Closed</option>
          </select>
        </label>
      </form>

      {error && <ErrorMessage message={error} />}

      {!tenantId ? (
        <PageState message="Select a tenant to view and manage their bills." />
      ) : loading && !bills ? (
        <PageState message="Loading invoices..." />
      ) : (
        <Panel>
          <div className="flex items-center justify-between border-b border-[#d7d3c8] px-5 py-4">
            <div>
              <h2 className="font-display text-2xl font-semibold uppercase">{selected?.business_name ?? "Bills"}</h2>
              <p className="text-xs text-[#6f746e]">{bills?.total ?? 0} invoices · reopen, edit, close, or delete</p>
            </div>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full min-w-[860px] text-left text-sm">
              <thead className="bg-[#eeece5] text-[10px] uppercase text-[#6f746e]">
                <tr>
                  <th className="px-5 py-3">Ref</th>
                  <th>Date</th>
                  <th>Customer</th>
                  <th>Detail</th>
                  <th>Status</th>
                  <th className="text-right">Total</th>
                  <th className="pr-5 text-right">Due</th>
                  <th />
                </tr>
              </thead>
              <tbody>
                {(bills?.data ?? []).map((bill) => (
                  <tr key={bill.id} className="border-t border-[#e2ded4]">
                    <td className="px-5 py-4 font-semibold">{bill.bill_number}</td>
                    <td>{formatDate(bill.admission_date)}</td>
                    <td>{bill.customer?.name ?? "Walk-in"}</td>
                    <td>{bill.vehicle?.number_plate ?? "—"}</td>
                    <td>
                      <span className={`px-2 py-1 text-[10px] font-bold uppercase ${statusClass(bill.status)}`}>
                        {billStatusLabel(bill.status)}
                      </span>
                    </td>
                    <td className="text-right tabular-nums">{money(bill.subtotal)}</td>
                    <td className="pr-5 text-right font-semibold tabular-nums">{money(bill.balance_due)}</td>
                    <td className="pr-4">
                      <Link
                        href={`/super-admin/invoices/${tenantId}/${bill.id}`}
                        className="text-[#167c73]"
                        aria-label={`Manage ${bill.bill_number}`}
                      >
                        <ArrowRight size={18} />
                      </Link>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            {bills && bills.data.length === 0 && (
              <p className="p-8 text-center text-sm text-[#6f746e]">No invoices for this tenant.</p>
            )}
          </div>
        </Panel>
      )}
    </PlatformShell>
  );
}

export default function InvoicesPage() {
  return (
    <Suspense fallback={<PlatformShell title="Tenants invoices"><PageState message="Loading..." /></PlatformShell>}>
      <InvoicesPageInner />
    </Suspense>
  );
}
