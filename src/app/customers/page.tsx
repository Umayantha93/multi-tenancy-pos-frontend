"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { ArrowRight, Search } from "lucide-react";
import { AppShell } from "@/components/app-shell";
import { ErrorMessage, inputClass, PageState, Panel } from "@/components/ui";
import { api } from "@/lib/api";

type Customer = {
  id: number;
  name: string;
  phone?: string | null;
  address?: string | null;
  vehicles_count: number;
  bills_count: number;
};

export default function CustomersPage() {
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [search, setSearch] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setLoading(true);
    const timer = setTimeout(() => {
      const params = new URLSearchParams({ per_page: "50" });
      if (search.trim()) params.set("search", search.trim());
      api<{ data: Customer[] }>(`/customers?${params}`)
        .then((result) => setCustomers(result.data))
        .catch((caught) => setError(caught.message))
        .finally(() => setLoading(false));
    }, 250);
    return () => clearTimeout(timer);
  }, [search]);

  return (
    <AppShell title="Customers" eyebrow="Search by phone or name">
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

      {error && <div className="mb-5"><ErrorMessage message={error} /></div>}
      {loading ? (
        <PageState message="Loading customers..." />
      ) : customers.length === 0 ? (
        <PageState message="No customers found." />
      ) : (
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {customers.map((customer) => (
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
                    <p className="text-[#6f746e]">Vehicles</p>
                    <strong>{customer.vehicles_count}</strong>
                  </div>
                  <div>
                    <p className="text-[#6f746e]">Jobs done</p>
                    <strong>{customer.bills_count}</strong>
                  </div>
                </div>
              </Panel>
            </Link>
          ))}
        </div>
      )}
    </AppShell>
  );
}
