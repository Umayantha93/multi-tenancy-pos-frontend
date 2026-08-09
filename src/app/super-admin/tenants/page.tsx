"use client";

import Link from "next/link";
import { FormEvent, useEffect, useState } from "react";
import { ArrowRight, Plus, Search } from "lucide-react";
import { PlatformShell } from "@/components/platform-shell";
import { ErrorMessage, PageState, Panel, inputClass } from "@/components/ui";
import { api, Tenant } from "@/lib/api";

type TenantRow = Tenant & {
  owner_name: string;
  owner_email: string;
  plan: string | null;
  users_count: number;
  features: Array<{ id: number; key: string; name: string; pivot?: { is_enabled: boolean } }>;
};
type Page = { data: TenantRow[]; current_page: number; last_page: number; total: number };

function money(value: number | string | null | undefined) {
  if (value == null) return "—";
  return `LKR ${Number(value).toLocaleString("en-LK", { minimumFractionDigits: 2 })}`;
}

export default function TenantsPage() {
  const [page, setPage] = useState<Page | null>(null);
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState("");
  const [error, setError] = useState("");
  const [togglingId, setTogglingId] = useState<number | null>(null);

  function load(query = search, state = status) {
    setError("");
    api<Page>(`/super-admin/tenants?search=${encodeURIComponent(query)}&status=${state}`)
      .then(setPage)
      .catch((caught) => setError(caught.message));
  }

  useEffect(() => {
    api<Page>("/super-admin/tenants?search=&status=")
      .then(setPage)
      .catch((caught) => setError(caught.message));
  }, []);

  function submit(event: FormEvent) {
    event.preventDefault();
    load();
  }

  async function toggleFeePaid(tenant: TenantRow) {
    if (tenant.payment_plan !== "monthly") return;
    const now = new Date();
    const year = now.getFullYear();
    const month = now.getMonth() + 1;
    const nextPaid = !tenant.current_month_paid;
    setTogglingId(tenant.id);
    setError("");
    try {
      await api(`/super-admin/tenants/${tenant.id}/fee-payments/${year}/${month}`, {
        method: "PUT",
        body: JSON.stringify({ paid: nextPaid }),
      });
      setPage((current) =>
        current
          ? {
              ...current,
              data: current.data.map((row) =>
                row.id === tenant.id ? { ...row, current_month_paid: nextPaid } : row,
              ),
            }
          : current,
      );
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Unable to update fee payment.");
    } finally {
      setTogglingId(null);
    }
  }

  return (
    <PlatformShell
      title="Business registry"
      action={
        <Link href="/super-admin/tenants/new" className="flex h-10 items-center gap-2 bg-[#f5c842] px-4 text-sm font-semibold">
          <Plus size={18} />
          Onboard
        </Link>
      }
    >
      <form onSubmit={submit} className="mb-5 grid gap-3 sm:grid-cols-[1fr_180px_auto]">
        <label className="relative">
          <Search size={17} className="absolute left-3 top-3 text-[#6f746e]" />
          <input
            aria-label="Search tenants"
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            placeholder="Business or owner email"
            className={`${inputClass} pl-10`}
          />
        </label>
        <select
          aria-label="Tenant status"
          value={status}
          onChange={(event) => setStatus(event.target.value)}
          className={inputClass}
        >
          <option value="">All statuses</option>
          <option value="active">Active</option>
          <option value="inactive">Inactive</option>
        </select>
        <button className="h-11 bg-[#20221f] px-5 text-sm font-semibold text-white">Filter</button>
      </form>
      {error && <ErrorMessage message={error} />}
      {!page && !error ? (
        <PageState message="Loading businesses..." />
      ) : (
        page && (
          <Panel>
            <div className="flex items-center justify-between border-b border-[#d7d3c8] px-5 py-4">
              <div>
                <h2 className="font-display text-2xl font-semibold uppercase">{page.total} tenants</h2>
                <p className="text-xs text-[#6f746e]">Shared-schema businesses and their enabled modules</p>
              </div>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full min-w-[980px] text-left text-sm">
                <thead className="bg-[#e7e4db] text-[10px] uppercase text-[#6f746e]">
                  <tr>
                    <th className="px-5 py-3">Business</th>
                    <th>Type</th>
                    <th>Plan</th>
                    <th>Amount</th>
                    <th>Fee</th>
                    <th>Users</th>
                    <th>Modules</th>
                    <th>Status</th>
                    <th className="pr-5" />
                  </tr>
                </thead>
                <tbody>
                  {page.data.map((tenant) => (
                    <tr key={tenant.id} className="border-t border-[#dedad0]">
                      <td className="px-5 py-4">
                        <strong className="block">{tenant.business_name}</strong>
                        <span className="text-xs text-[#6f746e]">{tenant.owner_email}</span>
                      </td>
                      <td className="capitalize">
                        {tenant.business_type === "cottage"
                          ? "Cottages"
                          : tenant.business_type === "clothing"
                            ? "Garments"
                            : tenant.business_type === "photography"
                              ? "Studios"
                              : tenant.business_type === "garage"
                                ? "Garages"
                                : tenant.business_type}
                      </td>
                      <td>{tenant.plan ?? "Custom"}</td>
                      <td>
                        <span className="block">{money(tenant.plan_amount)}</span>
                        <span className="text-[10px] uppercase text-[#6f746e]">{tenant.payment_plan ?? "monthly"}</span>
                      </td>
                      <td>
                        {tenant.payment_plan === "monthly" ? (
                          <button
                            type="button"
                            disabled={togglingId === tenant.id}
                            onClick={() => toggleFeePaid(tenant)}
                            className={`px-2 py-1 text-[10px] font-bold uppercase ${
                              tenant.current_month_paid
                                ? "bg-[#167c73]/10 text-[#167c73]"
                                : "bg-[#b84837]/10 text-[#b84837]"
                            }`}
                            aria-label={`Mark ${tenant.business_name} fee as ${tenant.current_month_paid ? "unpaid" : "paid"}`}
                          >
                            {togglingId === tenant.id
                              ? "Saving..."
                              : tenant.current_month_paid
                                ? "Paid"
                                : "Unpaid"}
                          </button>
                        ) : (
                          <span className="text-xs text-[#6f746e]">N/A</span>
                        )}
                      </td>
                      <td>{tenant.users_count}</td>
                      <td>{tenant.features.filter((feature) => feature.pivot?.is_enabled !== false).length}</td>
                      <td>
                        <span
                          className={`px-2 py-1 text-[10px] font-bold uppercase ${
                            tenant.status === "active"
                              ? "bg-[#167c73]/10 text-[#167c73]"
                              : "bg-[#b84837]/10 text-[#b84837]"
                          }`}
                        >
                          {tenant.status}
                        </span>
                      </td>
                      <td className="pr-5 text-right">
                        <Link
                          href={`/super-admin/tenants/${tenant.id}`}
                          aria-label={`Manage ${tenant.business_name}`}
                          className="inline-grid size-9 place-items-center border border-[#cbc7bc] hover:bg-[#f5c842]"
                        >
                          <ArrowRight size={17} />
                        </Link>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
              {page.data.length === 0 && (
                <p className="p-10 text-center text-sm text-[#6f746e]">No businesses match this filter.</p>
              )}
            </div>
          </Panel>
        )
      )}
    </PlatformShell>
  );
}
