"use client";

import Link from "next/link";
import { FormEvent, useEffect, useState } from "react";
import { ArrowRight, Plus, Search } from "lucide-react";
import { AppShell } from "@/components/app-shell";
import { ErrorMessage, PageState, Panel, SuccessMessage, buttonClass, inputClass } from "@/components/ui";
import { api, formatDate, money } from "@/lib/api";

type LastBill = {
  id: number;
  bill_number: string;
  admission_date: string;
  status: string;
  balance_due: string | number;
};

type Customer = {
  id: number;
  name: string;
  phone?: string | null;
  address?: string | null;
  sms_opt_in?: boolean;
  vehicles_count: number;
  bills_count: number;
  outstanding_balance?: number | string;
  outstanding_days?: number;
  last_bill?: LastBill | null;
};

export default function CustomersPage() {
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [search, setSearch] = useState("");
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [loading, setLoading] = useState(true);
  const [adding, setAdding] = useState(false);
  const [saving, setSaving] = useState(false);

  function load(term = search) {
    setLoading(true);
    const params = new URLSearchParams({ per_page: "50" });
    if (term.trim()) params.set("search", term.trim());
    api<{ data: Customer[] }>(`/customers?${params}`)
      .then((result) => setCustomers(result.data))
      .catch((caught) => setError(caught.message))
      .finally(() => setLoading(false));
  }

  useEffect(() => {
    const timer = setTimeout(() => load(), 250);
    return () => clearTimeout(timer);
  }, [search]);

  async function createCustomer(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSaving(true);
    setError("");
    const form = new FormData(event.currentTarget);
    try {
      await api("/customers", {
        method: "POST",
        body: JSON.stringify({
          name: form.get("name") || null,
          phone: form.get("phone") || null,
          address: form.get("address") || null,
          sms_opt_in: form.get("sms_opt_in") === "on",
        }),
      });
      setNotice("Customer added.");
      setAdding(false);
      event.currentTarget.reset();
      load();
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Could not add customer.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <AppShell
      title="Customers"
      eyebrow="Directory"
      action={
        <button type="button" onClick={() => setAdding((value) => !value)} className={buttonClass}>
          <Plus size={14} /> {adding ? "Close" : "Add customer"}
        </button>
      }
    >
      {error && <div className="mb-5"><ErrorMessage message={error} /></div>}
      {notice && <div className="mb-5"><SuccessMessage message={notice} /></div>}

      {adding && (
        <Panel className="mb-5 p-5">
          <h2 className="font-display text-2xl font-semibold uppercase">New customer</h2>
          <form onSubmit={createCustomer} className="mt-4 grid gap-3 sm:grid-cols-2">
            <label className="text-xs font-bold uppercase">Name<input name="name" required className={`${inputClass} mt-2`} /></label>
            <label className="text-xs font-bold uppercase">Phone<input name="phone" type="tel" required className={`${inputClass} mt-2`} /></label>
            <label className="text-xs font-bold uppercase sm:col-span-2">Address<input name="address" className={`${inputClass} mt-2`} /></label>
            <label className="flex items-center gap-2 text-sm sm:col-span-2">
              <input type="checkbox" name="sms_opt_in" defaultChecked className="size-4 accent-[#167c73]" />
              SMS bills and reminders
            </label>
            <div className="sm:col-span-2">
              <button disabled={saving} className={buttonClass}>{saving ? "Saving..." : "Save customer"}</button>
            </div>
          </form>
        </Panel>
      )}

      <div className="mb-5 max-w-xl">
        <label className="relative block">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-[#6f746e]" size={16} />
          <input
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            className={`${inputClass} pl-10`}
            placeholder="Phone number or customer name"
          />
        </label>
      </div>

      {loading ? (
        <PageState message="Loading customers..." />
      ) : customers.length === 0 ? (
        <PageState message="No customers found." />
      ) : (
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {customers.map((customer) => {
            const outstanding = Number(customer.outstanding_balance ?? 0);
            return (
              <Link key={customer.id} href={`/customers/${customer.id}`}>
                <Panel className="h-full p-5 transition hover:border-[#167c73]">
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <h2 className="font-display text-2xl font-semibold uppercase">{customer.name}</h2>
                      <p className="mt-1 text-sm text-[#167c73]">{customer.phone || "No phone"}</p>
                      {customer.address && <p className="mt-2 text-xs text-[#6f746e]">{customer.address}</p>}
                    </div>
                    <ArrowRight className="text-[#6f746e]" size={18} />
                  </div>
                  <div className="mt-5 grid grid-cols-2 gap-3 border-t border-[#d7d3c8] pt-4 text-xs">
                    <div>
                      <p className="text-[#6f746e]">Outstanding</p>
                      <strong className={outstanding > 0 ? "text-[#b84837]" : ""}>{money(outstanding)}</strong>
                      {outstanding > 0 && customer.outstanding_days != null && (
                        <p className="mt-0.5 text-[#6f746e]">{customer.outstanding_days} day{customer.outstanding_days === 1 ? "" : "s"}</p>
                      )}
                    </div>
                    <div>
                      <p className="text-[#6f746e]">Last job</p>
                      <strong>{customer.last_bill ? customer.last_bill.bill_number : "—"}</strong>
                      {customer.last_bill && (
                        <p className="mt-0.5 text-[#6f746e]">{formatDate(customer.last_bill.admission_date)}</p>
                      )}
                    </div>
                  </div>
                </Panel>
              </Link>
            );
          })}
        </div>
      )}
    </AppShell>
  );
}
