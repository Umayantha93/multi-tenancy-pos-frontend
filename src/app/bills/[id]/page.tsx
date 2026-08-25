"use client";

import { FormEvent, useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useParams } from "next/navigation";
import { ChevronDown, CreditCard, Lock, MessageSquare, Plus, Printer, Trash2 } from "lucide-react";
import { AppShell } from "@/components/app-shell";
import { buttonClass, ConfirmModal, ErrorMessage, inputClass, PageState, Panel } from "@/components/ui";
import { api, currentFeatures, currentUser, formatDate, mediaUrl, money, storeSession, Tenant, User } from "@/lib/api";
import { billItemLabel, billLinePresentation, profileFor, sortBillItems } from "@/lib/business-profiles";
import { billStamp, billStampDateLabel, latestPaymentAt } from "@/lib/bill-stamp";
import { BillStatusSeal } from "@/components/bill-status-seal";

type Part = { id: number; name: string; price: string; stock_qty: number; sku?: string | null; barcode?: string | null; brand?: string };
type ServiceAddon = {
  id: number;
  name: string;
  price: string;
  is_full_service: boolean;
  active: boolean;
  inclusions?: Array<{ id: number; name: string }>;
};
type Bill = {
  id: number;
  bill_number: string;
  share_token?: string | null;
  status: string;
  job_kind?: string | null;
  owe_in_due_date?: string | null;
  subtotal: string;
  total_deductions: string;
  vat_rate?: string | number | null;
  sscl_rate?: string | number | null;
  vat_amount?: string | number | null;
  sscl_amount?: string | number | null;
  amount_paid: string;
  balance_due: string;
  customer_balance?: string | number;
  mileage?: number | string | null;
  odometer?: number | string | null;
  customer: { name: string; phone: string; address?: string | null } | null;
  vehicle: { number_plate: string; chassis_number?: string | null; make?: string; model?: string } | null;
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
};

type PendingDelete =
  | { kind: "item"; id: number; label: string }
  | { kind: "payment"; id: number; method: string; amount: string };

export default function BillDetailPage() {
  const { id } = useParams<{ id: string }>();
  const [bill, setBill] = useState<Bill | null>(null);
  const [parts, setParts] = useState<Part[]>([]);
  const [addons, setAddons] = useState<ServiceAddon[]>([]);
  const [addonQty, setAddonQty] = useState("1");
  const [addingAddonId, setAddingAddonId] = useState<number | null>(null);
  const [serviceAddMode, setServiceAddMode] = useState<"services" | "inventory" | "discount">("services");
  const [tenant, setTenant] = useState<Tenant | null>(currentUser()?.tenant ?? null);
  const [error, setError] = useState("");
  const [mode, setMode] = useState<"item" | "payment">("item");
  const [type, setType] = useState<string>("");
  const [partQuery, setPartQuery] = useState("");
  const [selectedPartId, setSelectedPartId] = useState("");
  const [outsidePart, setOutsidePart] = useState(false);
  const [customerPart, setCustomerPart] = useState(false);
  const [formKey, setFormKey] = useState(0);
  const [pendingDelete, setPendingDelete] = useState<PendingDelete | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [pendingClose, setPendingClose] = useState(false);
  const [pendingOweIn, setPendingOweIn] = useState(false);
  const [oweInDate, setOweInDate] = useState("");
  const [oweInMenu, setOweInMenu] = useState(false);
  const closeMenuRef = useRef<HTMLDivElement>(null);
  const [closing, setClosing] = useState(false);
  const [markingOweIn, setMarkingOweIn] = useState(false);
  const [sendingSms, setSendingSms] = useState(false);
  const [smsNotice, setSmsNotice] = useState("");
  const [mileageDraft, setMileageDraft] = useState("");
  const [savingMileage, setSavingMileage] = useState(false);
  const [features, setFeatures] = useState<string[]>(() => currentFeatures());
  const canSendSms = features.includes("bill_sms");

  const logoUrl = mediaUrl(tenant?.logo_url || tenant?.logo);
  const contactEmail = tenant?.contact_email || tenant?.owner_email || "";
  const contactPhones = (tenant?.contact_phones?.length
    ? tenant.contact_phones.map((p) => p.number)
    : [tenant?.contact_phone || tenant?.owner_phone].filter(Boolean)) as string[];
  const profile = profileFor(tenant?.business_type);
  const itemTypes = profile.billItemTypes.filter((option) => option.value !== "charge");
  const selectedType = itemTypes.find((option) => option.value === type) ?? itemTypes[0];
  const activeType = type || selectedType?.value || "labor";
  const isServiceJob = profile.type === "garage" && bill?.job_kind === "service";
  const billItems = useMemo(() => sortBillItems(bill?.items ?? []), [bill?.items]);
  const chargeItems = useMemo(() => billItems.filter((item) => item.type !== "discount"), [billItems]);
  const discountItems = useMemo(() => billItems.filter((item) => item.type === "discount"), [billItems]);
  const isClosed = bill?.status === "closed";
  const isOweIn = bill?.status === "owe_in";
  const isLocked = isClosed || isOweIn;
  const isPaid = Boolean(bill && Number(bill.amount_paid) > 0 && Number(bill.balance_due) <= 0);
  const stamp = bill ? billStamp(bill) : "quote";
  const paymentDate = bill ? billStampDateLabel(latestPaymentAt(bill.payments)) : null;

  useEffect(() => {
    if (!itemTypes.length) return;
    if (!type || !itemTypes.some((option) => option.value === type)) {
      setType(itemTypes[0].value);
    }
  }, [itemTypes, type]);

  useEffect(() => {
    if (isOweIn) setMode("payment");
  }, [isOweIn]);

  useEffect(() => {
    function onPointer(event: MouseEvent) {
      if (!closeMenuRef.current?.contains(event.target as Node)) {
        setOweInMenu(false);
      }
    }
    window.addEventListener("mousedown", onPointer);
    return () => window.removeEventListener("mousedown", onPointer);
  }, []);

  function resetItemForm(nextType?: string) {
    setType(nextType || itemTypes[0]?.value || "");
    setPartQuery("");
    setSelectedPartId("");
    setOutsidePart(false);
    setCustomerPart(false);
    setFormKey((value) => value + 1);
  }

  function switchServiceAddMode(next: "services" | "inventory" | "discount") {
    setServiceAddMode(next);
    setSelectedPartId("");
    setPartQuery("");
    setOutsidePart(false);
    setCustomerPart(false);
    setError("");
    if (next === "inventory") setType("part");
    if (next === "discount") setType("discount");
    setFormKey((value) => value + 1);
  }

  async function sendBillSms() {
    if (!bill?.customer?.phone) {
      setError("Add a customer phone number before sending the bill.");
      return;
    }

    setError("");
    setSmsNotice("");
    setSendingSms(true);
    try {
      const result = await api<{ message: string; share_token?: string }>(`/bills/${bill.id}/send-sms`, {
        method: "POST",
      });
      if (result.share_token && result.share_token !== bill.share_token) {
        setBill({ ...bill, share_token: result.share_token });
      }
      setSmsNotice(result.message || "Bill link sent by SMS.");
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Could not send SMS.");
    } finally {
      setSendingSms(false);
    }
  }

  const load = useCallback(() => {
    api<Bill>(`/bills/${id}`)
      .then((result) => {
        setBill(result);
        setMileageDraft(result.mileage != null && result.mileage !== "" ? String(result.mileage) : "");
      })
      .catch((caught) => setError(caught.message));
  }, [id]);

  useEffect(() => {
    load();
    api<{ data: Part[] }>("/parts?per_page=100")
      .then((result) => setParts(result.data))
      .catch(() => undefined);
    if (profile.type === "garage") {
      api<ServiceAddon[]>("/service-addons")
        .then((result) => setAddons(result.filter((addon) => addon.active !== false)))
        .catch(() => undefined);
    }
    api<{ user: User; features: string[] }>("/user")
      .then((result) => {
        setTenant(result.user.tenant ?? null);
        setFeatures(result.features);
        const token = localStorage.getItem("garage_token");
        if (token) storeSession(token, result.user, result.features);
      })
      .catch(() => undefined);
  }, [load]);

  const filteredParts = useMemo(() => {
    const query = partQuery.trim().toLowerCase();
    return parts
      .filter((part) => part.stock_qty > 0)
      .filter((part) => {
        if (!query) return true;
        return [part.name, part.sku, part.barcode, part.brand].filter(Boolean).join(" ").toLowerCase().includes(query);
      });
  }, [partQuery, parts]);

  const selectedPart = parts.find((part) => String(part.id) === selectedPartId);
  const isStockType = selectedType?.kind === "stock" || (isServiceJob && serviceAddMode === "inventory");
  const showQuantity = isStockType || Boolean(selectedType?.allowQty);
  const showCost = !isStockType || outsidePart;
  const useStockSearch = isStockType && !outsidePart && !customerPart;

  function findPartByCode(code: string, catalog: Part[] = parts) {
    const needle = code.trim().toLowerCase();
    if (!needle) return null;
    return catalog.find((part) => {
      if (part.stock_qty <= 0) return false;
      return part.barcode?.toLowerCase() === needle || part.sku?.toLowerCase() === needle;
    }) ?? null;
  }

  async function selectPartByScan(code: string) {
    const trimmed = code.trim();
    if (!trimmed) return false;

    const local = findPartByCode(trimmed);
    if (local) {
      setSelectedPartId(String(local.id));
      setPartQuery(local.name);
      setError("");
      return true;
    }

    try {
      const result = await api<{ data: Part[] }>(`/parts?barcode=${encodeURIComponent(trimmed)}&per_page=5`);
      const match = result.data.find((part) => part.stock_qty > 0) ?? null;
      if (match) {
        setParts((current) => (current.some((part) => part.id === match.id) ? current : [...current, match]));
        setSelectedPartId(String(match.id));
        setPartQuery(match.name);
        setError("");
        return true;
      }
    } catch {
      // Fall through to filtered name match / barcode error below.
    }

    const matches = parts
      .filter((part) => part.stock_qty > 0)
      .filter((part) =>
        [part.name, part.sku, part.barcode, part.brand]
          .filter(Boolean)
          .join(" ")
          .toLowerCase()
          .includes(trimmed.toLowerCase()),
      );
    if (matches.length === 1) {
      setSelectedPartId(String(matches[0].id));
      setPartQuery(matches[0].name);
      setError("");
      return true;
    }

    if (!/\s/.test(trimmed)) {
      setError(`No in-stock part found for barcode "${trimmed}".`);
      setSelectedPartId("");
    }
    return false;
  }

  async function addItem(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (isLocked) return;
    setError("");
    const form = event.currentTarget;
    const formData = new FormData(form);
    const lineType = activeType;
    const payload: Record<string, string> = {
      type: String(formData.get("type") || lineType),
    };

    if (isStockType) {
      if (customerPart) {
        payload.type = "customer_part";
        payload.description = String(formData.get("description") || "");
        payload.quantity = String(formData.get("quantity") || "1");
        payload.unit_price = "0";
      } else if (outsidePart) {
        payload.description = String(formData.get("description") || "");
        payload.unit_price = String(formData.get("unit_price") || "");
        payload.purchase_unit_cost = String(formData.get("purchase_unit_cost") || "");
        payload.quantity = String(formData.get("quantity") || "1");
      } else {
        if (!selectedPartId) {
          setError("Select a part from stock, or choose Bought outside / Customer supplied.");
          return;
        }
        payload.part_id = selectedPartId;
        payload.quantity = String(formData.get("quantity") || "1");
      }
    } else {
      payload.description = String(formData.get("description") || "");
      payload.unit_price = String(formData.get("unit_price") || "");
      payload.quantity = showQuantity ? String(formData.get("quantity") || "1") : "1";
    }

    try {
      await api(`/bills/${id}/items`, { method: "POST", body: JSON.stringify(payload) });
      resetItemForm(isServiceJob ? (serviceAddMode === "discount" ? "discount" : "part") : itemTypes[0]?.value);
      load();
      api<{ data: Part[] }>("/parts?per_page=100").then((result) => setParts(result.data)).catch(() => undefined);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Could not add item.");
    }
  }

  async function addAddon(addon: ServiceAddon) {
    if (isLocked) return;
    setError("");
    setAddingAddonId(addon.id);
    try {
      await api(`/bills/${id}/items`, {
        method: "POST",
        body: JSON.stringify({
          type: "service_addon",
          service_addon_id: addon.id,
          quantity: addonQty || "1",
        }),
      });
      load();
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Could not add service.");
    } finally {
      setAddingAddonId(null);
    }
  }

  async function addPayment(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (isClosed) return;
    const form = event.currentTarget;
    try {
      await api(`/bills/${id}/payments`, { method: "POST", body: JSON.stringify(Object.fromEntries(new FormData(form))) });
      form.reset();
      load();
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Could not record payment.");
    }
  }

  async function remove(itemId: number) {
    if (isLocked) return;
    const item = bill?.items.find((entry) => entry.id === itemId);
    setPendingDelete({
      kind: "item",
      id: itemId,
      label: item?.description || "this line item",
    });
  }

  async function removePayment(paymentId: number) {
    if (isLocked) return;
    const payment = bill?.payments.find((entry) => entry.id === paymentId);
    if (!payment) return;
    setPendingDelete({
      kind: "payment",
      id: paymentId,
      method: payment.method.replace("_", " "),
      amount: payment.amount,
    });
  }

  async function confirmDelete() {
    if (!pendingDelete) return;
    setDeleting(true);
    setError("");
    try {
      if (pendingDelete.kind === "item") {
        await api(`/bills/${id}/items/${pendingDelete.id}`, { method: "DELETE" });
        api<{ data: Part[] }>("/parts?per_page=100").then((result) => setParts(result.data)).catch(() => undefined);
      } else {
        await api(`/bills/${id}/payments/${pendingDelete.id}`, { method: "DELETE" });
      }
      setPendingDelete(null);
      load();
    } catch (caught) {
      setError(
        caught instanceof Error
          ? caught.message
          : pendingDelete.kind === "item"
            ? "Could not remove item."
            : "Could not remove payment.",
      );
    } finally {
      setDeleting(false);
    }
  }

  async function saveMileage(event: FormEvent) {
    event.preventDefault();
    if (isLocked || !bill) return;
    setSavingMileage(true);
    setError("");
    try {
      const updated = await api<Bill>(`/bills/${id}`, {
        method: "PUT",
        body: JSON.stringify({ mileage: mileageDraft === "" ? null : Number(mileageDraft) }),
      });
      setBill(updated);
      setMileageDraft(updated.mileage != null && updated.mileage !== "" ? String(updated.mileage) : "");
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Could not save mileage.");
    } finally {
      setSavingMileage(false);
    }
  }

  async function confirmClose() {
    if (!bill || isClosed || !isPaid) return;
    setClosing(true);
    setError("");
    try {
      await api(`/bills/${id}/close`, { method: "POST" });
      setPendingClose(false);
      load();
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : `Could not close this ${profile.billingSingular.toLowerCase()}.`);
    } finally {
      setClosing(false);
    }
  }

  async function confirmOweIn() {
    if (!bill || isLocked || isPaid || !oweInDate) return;
    setMarkingOweIn(true);
    setError("");
    try {
      await api(`/bills/${id}/owe-in`, { method: "POST", body: JSON.stringify({ due_date: oweInDate }) });
      setPendingOweIn(false);
      setOweInMenu(false);
      load();
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Could not mark this bill as owe in.");
    } finally {
      setMarkingOweIn(false);
    }
  }

  if (!bill) {
    return (
      <AppShell title={profile.billingSingular} eyebrow="Billing">
        {error ? <ErrorMessage message={error} /> : <PageState message={`Opening ${profile.billingSingular.toLowerCase()}...`} />}
      </AppShell>
    );
  }

  return (
    <AppShell
      title={bill.bill_number}
      eyebrow={`${bill.vehicle?.number_plate ?? bill.customer?.name ?? profile.billingSingular}${profile.type === "garage" ? ` · ${bill.job_kind === "service" ? "Service" : "Repair"}` : ""} · ${bill.status.replace("_", " ")}`}
      action={
        <div className="no-print flex items-center gap-2">
          {canSendSms && (
            <button
              type="button"
              onClick={sendBillSms}
              disabled={sendingSms || !bill.customer?.phone}
              className="grid size-10 place-items-center border border-[#c9c5b9] disabled:cursor-not-allowed disabled:opacity-40"
              title={
                !bill.customer?.phone
                  ? "Customer phone required"
                  : stamp === "paid"
                    ? "Send paid bill link by SMS"
                    : "Send quotation link by SMS"
              }
            >
              <MessageSquare size={19} />
            </button>
          )}
          <button onClick={() => window.print()} className="grid size-10 place-items-center border border-[#c9c5b9]" title="Print bill">
            <Printer size={19} />
          </button>
          {!isClosed && !isOweIn && (
            <div ref={closeMenuRef} className="relative">
              <div className="inline-flex h-10 overflow-hidden border border-[#c9c5b9] bg-white">
                <button
                  type="button"
                  disabled={!isPaid}
                  onClick={() => setPendingClose(true)}
                  className="inline-flex h-10 items-center gap-2 px-3 text-sm font-semibold hover:bg-[#f7f5ef] disabled:cursor-not-allowed disabled:opacity-40"
                  title={
                    isPaid
                      ? `Close this ${profile.billingSingular.toLowerCase()}`
                      : `Pay this ${profile.billingSingular.toLowerCase()} in full before closing`
                  }
                >
                  <Lock size={16} />
                  <span className="hidden sm:inline">Close</span>
                </button>
                <span className="w-px self-stretch bg-[#c9c5b9]" />
                <button
                  type="button"
                  onClick={() => setOweInMenu((open) => !open)}
                  className="grid h-10 w-9 place-items-center hover:bg-[#f7f5ef]"
                  title="More close options"
                  aria-label="More close options"
                  aria-expanded={oweInMenu}
                >
                  <ChevronDown size={16} />
                </button>
              </div>
              {oweInMenu && (
                <div className="absolute right-0 z-30 mt-1 min-w-[160px] border border-[#c9c5b9] bg-white shadow-[0_12px_28px_rgba(24,27,25,0.16)]">
                  <button
                    type="button"
                    disabled={isPaid}
                    onClick={() => {
                      setOweInMenu(false);
                      setOweInDate(new Date(Date.now() + 3 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10));
                      setPendingOweIn(true);
                    }}
                    className="block w-full px-4 py-2.5 text-left text-sm font-semibold hover:bg-[#f7f5ef] disabled:cursor-not-allowed disabled:opacity-40"
                  >
                    Owe In
                  </button>
                </div>
              )}
            </div>
          )}
          {isOweIn && isPaid && (
            <button
              type="button"
              onClick={() => setPendingClose(true)}
              className="inline-flex h-10 items-center gap-2 border border-[#20221f] bg-white px-3 text-sm font-semibold hover:bg-[#20221f] hover:text-white"
            >
              <Lock size={16} />
              <span className="hidden sm:inline">Close</span>
            </button>
          )}
        </div>
      }
    >
      <ConfirmModal
        open={Boolean(pendingDelete)}
        title={pendingDelete?.kind === "payment" ? "Remove payment" : "Remove line item"}
        message={
          pendingDelete?.kind === "payment"
            ? `Remove the ${pendingDelete.method.toUpperCase()} payment of ${money(pendingDelete.amount)} from this bill? The bill balance will be recalculated.`
            : `Remove “${pendingDelete?.label ?? "this line item"}” from the bill? Inventory stock will be restored if this line used stock.`
        }
        confirmLabel={pendingDelete?.kind === "payment" ? "Remove payment" : "Remove item"}
        tone="danger"
        busy={deleting}
        onCancel={() => {
          if (!deleting) setPendingDelete(null);
        }}
        onConfirm={confirmDelete}
      />
      <ConfirmModal
        open={pendingClose}
        title={`Close ${profile.billingSingular.toLowerCase()}`}
        message={`Close this ${profile.billingSingular.toLowerCase()}? Items, payments, and all other details will be locked and cannot be changed.`}
        confirmLabel={`Close ${profile.billingSingular.toLowerCase()}`}
        tone="default"
        busy={closing}
        onCancel={() => {
          if (!closing) setPendingClose(false);
        }}
        onConfirm={confirmClose}
      />
      <ConfirmModal
        open={pendingOweIn}
        title="Mark as Owe In"
        message="The job card will be locked except for payments. Choose the date the customer should settle the balance."
        confirmLabel="Mark owe in"
        tone="teal"
        busy={markingOweIn}
        onCancel={() => {
          if (!markingOweIn) setPendingOweIn(false);
        }}
        onConfirm={confirmOweIn}
      >
        <label className="mt-4 block text-xs font-bold uppercase">
          Due date
          <input
            type="date"
            min={new Date().toISOString().slice(0, 10)}
            value={oweInDate}
            onChange={(event) => setOweInDate(event.target.value)}
            className={`${inputClass} mt-2`}
          />
        </label>
      </ConfirmModal>
      <Panel className="bill-letterhead mb-5 overflow-hidden p-5">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div className="flex min-w-0 items-start gap-4">
            {logoUrl ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={logoUrl}
                alt={tenant?.business_name ?? "Business logo"}
                className="h-20 w-20 shrink-0 object-contain border border-[#d7d3c8] bg-white p-1"
              />
            ) : (
              <div className="grid h-20 w-20 shrink-0 place-items-center border border-dashed border-[#c9c5b9] bg-[#fbfaf6] text-center text-[10px] font-bold uppercase text-[#6f746e]">
                No logo
              </div>
            )}
            <div className="min-w-0">
              <p className="font-display text-3xl font-semibold uppercase leading-none">
                {tenant?.business_name ?? "Business"}
              </p>
              <p className="mt-2 text-sm text-[#6f746e]">{bill.bill_number}</p>
              <div className="mt-3 space-y-1 text-sm">
                {tenant?.address && <p><span className="text-[#6f746e]">Address:</span> {tenant.address}</p>}
                {tenant?.tin && <p><span className="text-[#6f746e]">TIN:</span> {tenant.tin}</p>}
                {contactPhones.map((phone) => (
                  <p key={phone}><span className="text-[#6f746e]">Mobile:</span> {phone}</p>
                ))}
                {contactEmail && <p><span className="text-[#6f746e]">Email:</span> {contactEmail}</p>}
              </div>
            </div>
          </div>
          <div className="flex shrink-0 flex-col items-end text-right text-xs uppercase text-[#6f746e]">
            <p className="font-bold text-[#167c73]">
              Tax invoice / {profile.billingSingular.toLowerCase()}
              {profile.type === "garage" ? ` · ${bill.job_kind === "service" ? "Service" : "Repair"}` : ""}
            </p>
            <p className="mt-1 normal-case">{new Date().toLocaleString("en-LK")}</p>
            <BillStatusSeal stamp={stamp} paymentDate={paymentDate} />
          </div>
        </div>
      </Panel>

      <div className="grid items-start gap-5 xl:grid-cols-[1.55fr_0.75fr] print:block print:space-y-5">
        <div className="space-y-5">
          <Panel>
            <div className="grid gap-4 p-5 sm:grid-cols-2 lg:grid-cols-4">
              <div>
                <p className="text-[10px] font-bold uppercase text-[#6f746e]">Customer</p>
                <p className="mt-1 font-semibold">{bill.customer?.name ?? "Walk-in"}</p>
                <p className="text-sm text-[#6f746e]">{bill.customer?.phone}</p>
                {bill.customer?.address && (
                  <p className="mt-1 text-sm text-[#6f746e]">{bill.customer.address}</p>
                )}
              </div>
              {bill.vehicle ? (
                <>
                  <div>
                    <p className="text-[10px] font-bold uppercase text-[#6f746e]">Vehicle</p>
                    <p className="mt-1 font-semibold">{bill.vehicle.number_plate}</p>
                    <p className="text-sm text-[#6f746e]">{bill.vehicle.make} {bill.vehicle.model}</p>
                  </div>
                  <div>
                    <p className="text-[10px] font-bold uppercase text-[#6f746e]">Chassis</p>
                    <p className="mt-1 break-all text-sm">{bill.vehicle.chassis_number || "—"}</p>
                  </div>
                  <div>
                    <p className="text-[10px] font-bold uppercase text-[#6f746e]">Mileage</p>
                    <p className="mt-1 font-semibold">
                      {bill.mileage != null && bill.mileage !== "" ? `${Number(bill.mileage).toLocaleString()} km` : "—"}
                    </p>
                    {!isLocked && (
                      <form onSubmit={saveMileage} className="no-print mt-2 flex h-11 items-stretch gap-2">
                        <input
                          type="number"
                          min="0"
                          step="1"
                          value={mileageDraft}
                          onChange={(event) => setMileageDraft(event.target.value)}
                          className={inputClass}
                          placeholder="km"
                        />
                        <button type="submit" disabled={savingMileage} className="inline-flex h-11 shrink-0 items-center justify-center border border-[#20221f] px-3 text-[10px] font-bold uppercase">
                          {savingMileage ? "..." : "Save"}
                        </button>
                      </form>
                    )}
                  </div>
                </>
              ) : (
                <div className="sm:col-span-2">
                  <p className="text-[10px] font-bold uppercase text-[#6f746e]">Type</p>
                  <p className="mt-1 font-semibold">{profile.label}</p>
                </div>
              )}
            </div>
          </Panel>

          {error && <div className="no-print"><ErrorMessage message={error} /></div>}
          {smsNotice && (
            <div className="no-print border border-[#167c73]/20 bg-[#167c73]/10 px-4 py-3 text-sm text-[#167c73]">
              {smsNotice}
            </div>
          )}
          {isClosed && (
            <div className="no-print flex items-center gap-2 border border-[#20221f]/15 bg-[#20221f]/5 px-4 py-3 text-sm text-[#20221f]">
              <Lock size={16} />
              This {profile.billingSingular.toLowerCase()} is closed and cannot be edited.
            </div>
          )}
          {isOweIn && (
            <div className="no-print flex items-center gap-2 border border-[#2b6cb0]/20 bg-[#2b6cb0]/8 px-4 py-3 text-sm text-[#2b6cb0]">
              <Lock size={16} />
              This {profile.billingSingular.toLowerCase()} is on owe in{bill.owe_in_due_date ? ` until ${formatDate(bill.owe_in_due_date)}` : ""}. Items are locked; payments can still be recorded.
            </div>
          )}

          <Panel>
            <div className="border-b border-[#d7d3c8] px-5 py-4">
              <h2 className="font-display text-2xl font-semibold uppercase">Bill items</h2>
            </div>
            <div className="overflow-x-auto print:overflow-visible">
              <table className="bill-items-table w-full table-fixed text-left text-sm">
                <colgroup>
                  <col className="w-[36%]" />
                  <col className="w-[14%]" />
                  <col className="w-[10%]" />
                  <col className="w-[18%]" />
                  <col className="w-[18%]" />
                  {!isLocked && <col className="no-print w-10" />}
                </colgroup>
                <thead className="bg-[#eeece5] text-[10px] uppercase text-[#6f746e]">
                  <tr>
                    <th className="px-4 py-3">Description</th>
                    <th className="px-3 py-3">Type</th>
                    <th className="px-3 py-3 text-right">Qty</th>
                    <th className="px-3 py-3 text-right">Rate</th>
                    <th className="px-4 py-3 text-right">Total</th>
                    {!isLocked && <th className="no-print px-2 py-3" />}
                  </tr>
                </thead>
                <tbody>
                  {chargeItems.map((item) => {
                    const fromCustomer = item.type === "customer_part";
                    const isPartLine = item.type === "part" || fromCustomer;
                    const showQty = isPartLine || Number(item.quantity) > 1;
                    return (
                      <tr key={item.id} className="border-t border-[#e2ded4] align-top">
                        <td className="px-4 py-3 break-words whitespace-normal">
                          <BillItemDescription item={item} />
                        </td>
                        <td className="px-3 py-3 text-[#6f746e] break-words whitespace-normal">
                          {billItemLabel(item.type, profile)}
                        </td>
                        <td className="px-3 py-3 text-right tabular-nums">
                          {showQty ? Number(item.quantity) : "—"}
                        </td>
                        <td className="px-3 py-3 text-right break-words whitespace-normal">
                          {fromCustomer ? (
                            <span className="font-semibold text-[#167c73]">—</span>
                          ) : (
                            <span className="tabular-nums">{money(item.unit_price)}</span>
                          )}
                        </td>
                        <td className="px-4 py-3 text-right break-words whitespace-normal">
                          {fromCustomer ? (
                            <span className="inline-block max-w-full font-semibold leading-snug text-[#167c73]">
                              Received from customer
                            </span>
                          ) : (
                            <span className="tabular-nums">{money(item.line_total)}</span>
                          )}
                        </td>
                        {!isLocked && (
                          <td className="no-print px-2 py-3">
                            <button onClick={() => remove(item.id)} className="text-[#b84837]" title="Remove item">
                              <Trash2 size={16} />
                            </button>
                          </td>
                        )}
                      </tr>
                    );
                  })}
                </tbody>
                {discountItems.length > 0 && (
                  <tbody>
                    <tr className="bill-discount-row border-t-2 border-[#167c73]/35 bg-[#e7f4f2]">
                      <td colSpan={5} className="px-4 py-2 text-[10px] font-bold uppercase tracking-wide text-[#167c73]">
                        Discount
                      </td>
                      {!isLocked && <td className="no-print" />}
                    </tr>
                    {discountItems.map((item) => (
                      <tr key={item.id} className="bill-discount-row border-t border-[#167c73]/20 bg-[#e7f4f2] align-top text-[#167c73]">
                        <td className="px-4 py-3 font-semibold break-words whitespace-normal">{item.description}</td>
                        <td className="px-3 py-3 break-words whitespace-normal">
                          {billItemLabel(item.type, profile)}
                        </td>
                        <td className="px-3 py-3 text-right tabular-nums">
                          {Number(item.quantity) > 1 ? Number(item.quantity) : "—"}
                        </td>
                        <td className="px-3 py-3 text-right tabular-nums">{money(item.unit_price)}</td>
                        <td className="px-4 py-3 text-right font-semibold tabular-nums">-{money(item.line_total)}</td>
                        {!isLocked && (
                          <td className="no-print px-2 py-3">
                            <button onClick={() => remove(item.id)} className="text-[#b84837]" title="Remove item">
                              <Trash2 size={16} />
                            </button>
                          </td>
                        )}
                      </tr>
                    ))}
                  </tbody>
                )}
              </table>
              {billItems.length === 0 && <p className="p-8 text-center text-sm text-[#6f746e]">No charges yet.</p>}
            </div>
          </Panel>

          {bill.payments.length > 0 && (
            <Panel>
              <div className="border-b border-[#d7d3c8] px-5 py-4">
                <h2 className="font-display text-2xl font-semibold uppercase">Payments</h2>
              </div>
              <div className="divide-y divide-[#e2ded4]">
                {bill.payments.map((payment) => (
                  <div key={payment.id} className="flex items-center gap-3 px-5 py-3 text-sm">
                    <span className="uppercase text-[#6f746e]">{payment.method.replace("_", " ")}</span>
                    <strong className="ml-auto tabular-nums">{money(payment.amount)}</strong>
                    {!isLocked && (
                      <button
                        type="button"
                        onClick={() => removePayment(payment.id)}
                        className="no-print text-[#b84837]"
                        title="Remove payment"
                      >
                        <Trash2 size={16} />
                      </button>
                    )}
                  </div>
                ))}
              </div>
            </Panel>
          )}
        </div>

        <div className="space-y-5 print:mt-5">
          {!isClosed && (
          <Panel className="no-print xl:sticky xl:top-4">
            {!isOweIn && (
            <div className="grid grid-cols-2 border-b border-[#d7d3c8]">
              <button onClick={() => setMode("item")} className={`h-11 text-sm font-semibold ${mode === "item" ? "bg-[#20221f] text-white" : ""}`}>
                <Plus className="inline" size={16} /> Add item
              </button>
              <button onClick={() => setMode("payment")} className={`h-11 text-sm font-semibold ${mode === "payment" ? "bg-[#167c73] text-white" : ""}`}>
                <CreditCard className="inline" size={16} /> Payment
              </button>
            </div>
            )}
            {isOweIn && (
              <div className="border-b border-[#d7d3c8] px-5 py-3">
                <p className="text-xs font-bold uppercase text-[#2b6cb0]">Record payment</p>
              </div>
            )}

            {mode === "item" && !isOweIn ? (
              isServiceJob && serviceAddMode === "services" ? (
                <div className="flex max-h-[min(78vh,46rem)] flex-col">
                  <div className="space-y-3 overflow-y-auto p-4">
                    <ServiceAddModeToggle
                      mode={serviceAddMode}
                      onChange={switchServiceAddMode}
                    />
                    <label className="block text-xs font-bold uppercase">
                      Quantity
                      <input
                        type="number"
                        min="1"
                        step="1"
                        value={addonQty}
                        onChange={(event) => setAddonQty(event.target.value)}
                        className={`${inputClass} mt-2`}
                      />
                    </label>
                    <p className="text-xs font-bold uppercase">Services</p>
                    <div className="grid grid-cols-2 gap-1.5">
                      {addons.map((addon) => {
                        const busy = addingAddonId === addon.id;
                        return (
                          <button
                            key={addon.id}
                            type="button"
                            disabled={Boolean(addingAddonId)}
                            onClick={() => addAddon(addon)}
                            className={`min-h-16 border px-2 py-2 text-left ${
                              addon.is_full_service
                                ? "border-[#167c73] bg-[#167c73] text-white hover:bg-[#12665f]"
                                : "border-[#d7d3c8] bg-[#fbfaf6] hover:border-[#20221f]"
                            } disabled:opacity-50`}
                          >
                            <span className="block text-[10px] font-bold uppercase leading-tight">{addon.name}</span>
                            <span className={`mt-1 block text-xs tabular-nums ${addon.is_full_service ? "text-white/80" : "text-[#6f746e]"}`}>
                              {busy ? "Adding..." : money(addon.price)}
                            </span>
                          </button>
                        );
                      })}
                    </div>
                    {addons.length === 0 && (
                      <p className="text-sm text-[#6f746e]">No service buttons yet. Ask the owner to add them under Service addons.</p>
                    )}
                  </div>
                </div>
              ) : (
              <form key={formKey} onSubmit={addItem} className="flex max-h-[min(78vh,46rem)] flex-col">
                <div className="space-y-3 overflow-y-auto p-4">
                {isServiceJob && (
                  <ServiceAddModeToggle
                    mode={serviceAddMode}
                    onChange={switchServiceAddMode}
                  />
                )}
                {!isServiceJob && (
                <div>
                  <p className="mb-2 text-xs font-bold uppercase">Type</p>
                  <div className="flex gap-1">
                    {itemTypes.map((option) => {
                      const selected = activeType === option.value;
                      return (
                        <button
                          key={option.value}
                          type="button"
                          onClick={() => {
                            setType(option.value);
                            setSelectedPartId("");
                            setPartQuery("");
                            setOutsidePart(false);
                            setCustomerPart(false);
                          }}
                          className={`h-7 min-w-0 flex-1 border px-1 text-center text-[9px] font-bold uppercase leading-none ${
                            selected
                              ? "border-[#20221f] bg-[#20221f] text-white"
                              : "border-[#d7d3c8] bg-[#fbfaf6] text-[#20221f] hover:border-[#20221f]"
                          }`}
                        >
                          {option.label}
                        </button>
                      );
                    })}
                  </div>
                  <input type="hidden" name="type" value={activeType} />
                </div>
                )}
                {isServiceJob && <input type="hidden" name="type" value={serviceAddMode === "discount" ? "discount" : "part"} />}

                {isStockType ? (
                  <>
                    <div className="grid gap-1.5 sm:grid-cols-2">
                      <label className="flex cursor-pointer items-center gap-2 border border-[#d7d3c8] bg-[#fbfaf6] px-2.5 py-2">
                        <input
                          type="checkbox"
                          checked={outsidePart}
                          onChange={(event) => {
                            const checked = event.target.checked;
                            setOutsidePart(checked);
                            if (checked) {
                              setCustomerPart(false);
                              setSelectedPartId("");
                              setPartQuery("");
                            }
                          }}
                          className="size-4 accent-[#167c73]"
                        />
                        <span className="text-[10px] font-bold uppercase">Bought outside</span>
                      </label>
                      <label className="flex cursor-pointer items-center gap-2 border border-[#d7d3c8] bg-[#fbfaf6] px-2.5 py-2">
                        <input
                          type="checkbox"
                          checked={customerPart}
                          onChange={(event) => {
                            const checked = event.target.checked;
                            setCustomerPart(checked);
                            if (checked) {
                              setOutsidePart(false);
                              setSelectedPartId("");
                              setPartQuery("");
                            }
                          }}
                          className="size-4 accent-[#167c73]"
                        />
                        <span className="text-[10px] font-bold uppercase">Customer supplied</span>
                      </label>
                    </div>

                    {useStockSearch ? (
                      <>
                        <label className="block text-xs font-bold uppercase">
                          Search / scan barcode
                          <input
                            value={partQuery ?? ""}
                            onChange={(event) => {
                              const value = event.target.value;
                              setPartQuery(value);
                              const exact = findPartByCode(value);
                              if (exact) {
                                setSelectedPartId(String(exact.id));
                                setError("");
                              } else {
                                setSelectedPartId("");
                              }
                            }}
                            onKeyDown={(event) => {
                              if (event.key !== "Enter") return;
                              event.preventDefault();
                              void selectPartByScan(partQuery);
                            }}
                            className={`${inputClass} mt-2`}
                            placeholder="Scan barcode or type name / SKU"
                            autoComplete="off"
                          />
                        </label>
                        <div className="max-h-44 overflow-y-auto border border-[#d7d3c8] bg-white">
                          {filteredParts.length === 0 ? (
                            <p className="p-3 text-sm text-[#6f746e]">No matching stock.</p>
                          ) : (
                            filteredParts.map((part) => (
                              <button
                                type="button"
                                key={part.id}
                                onClick={() => {
                                  setSelectedPartId(String(part.id));
                                  setPartQuery(part.name);
                                  setError("");
                                }}
                                className={`flex w-full items-center justify-between border-b border-[#eeeae1] px-3 py-2 text-left text-sm ${selectedPartId === String(part.id) ? "bg-[#167c73]/10" : "hover:bg-[#f7f5ef]"}`}
                              >
                                <span>
                                  <span className="font-semibold">{part.name}</span>
                                  {part.barcode && (
                                    <span className="mt-0.5 block text-[10px] text-[#6f746e]">Barcode: {part.barcode}</span>
                                  )}
                                </span>
                                <span className="text-xs text-[#6f746e]">{part.stock_qty} · {money(part.price)}</span>
                              </button>
                            ))
                          )}
                        </div>
                        {selectedPart && (
                          <p className="text-xs text-[#167c73]">
                            Selected: {selectedPart.name}
                            {selectedPart.barcode ? ` · ${selectedPart.barcode}` : ""}
                          </p>
                        )}
                      </>
                    ) : outsidePart ? (
                      <>
                        <label className="block text-xs font-bold uppercase">
                          Part description
                          <input name="description" required className={`${inputClass} mt-2`} placeholder="e.g. Oil filter bought outside" />
                        </label>
                        <div className="grid grid-cols-2 gap-3">
                          <label className="block text-xs font-bold uppercase">
                            Selling price
                            <input name="unit_price" type="number" min="0" step="0.01" required className={`${inputClass} mt-2`} />
                          </label>
                          <label className="block text-xs font-bold uppercase">
                            Purchase cost
                            <input name="purchase_unit_cost" type="number" min="0" step="0.01" required className={`${inputClass} mt-2`} />
                          </label>
                        </div>
                        <p className="text-[11px] text-[#6f746e]">
                          Purchase cost is added to inventory expenses for profit calculation.
                        </p>
                      </>
                    ) : (
                      <label className="block text-xs font-bold uppercase">
                        Part description
                        <input name="description" required className={`${inputClass} mt-2`} placeholder="e.g. Customer brought brake pads" />
                      </label>
                    )}
                  </>
                ) : (
                  <>
                    <label className="block text-xs font-bold uppercase">
                      Description
                      <input name="description" required className={`${inputClass} mt-2`} />
                    </label>
                    {showCost && (
                      <label className="block text-xs font-bold uppercase">
                        Cost
                        <input name="unit_price" type="number" min="0" step="0.01" required className={`${inputClass} mt-2`} />
                      </label>
                    )}
                    {showQuantity && (
                      <label className="block text-xs font-bold uppercase">
                        Quantity
                        <input name="quantity" type="number" min="1" step={selectedType?.allowQty && !isStockType ? "0.01" : "1"} defaultValue="1" required className={`${inputClass} mt-2`} />
                      </label>
                    )}
                  </>
                )}

                {isStockType && showQuantity && (selectedPartId || outsidePart || customerPart) && (
                  <label className="block text-xs font-bold uppercase">
                    Quantity
                    <input name="quantity" type="number" min="1" step="1" defaultValue="1" required className={`${inputClass} mt-2`} />
                  </label>
                )}
                </div>

                <div className="shrink-0 border-t border-[#d7d3c8] bg-white p-4">
                  <button className={`${buttonClass} w-full`}>
                    <Plus size={17} />Add to bill
                  </button>
                </div>
              </form>
              )
            ) : (
              <form onSubmit={addPayment} className="space-y-4 p-5">
                <label className="block text-xs font-bold uppercase">
                  Amount
                  <input name="amount" type="number" min="0.01" step="0.01" required className={`${inputClass} mt-2`} />
                </label>
                <label className="block text-xs font-bold uppercase">
                  Method
                  <select name="method" className={`${inputClass} mt-2`}>
                    <option value="cash">Cash</option>
                    <option value="card">Card</option>
                    <option value="bank_transfer">Bank transfer</option>
                    <option value="other">Other</option>
                  </select>
                </label>
                <label className="block text-xs font-bold uppercase">
                  Reference
                  <input name="reference" className={`${inputClass} mt-2`} />
                </label>
                <button className={`${buttonClass} w-full bg-[#167c73]`}>
                  <CreditCard size={17} />Record payment
                </button>
              </form>
            )}
          </Panel>
          )}

          <Panel className="p-5">
            <p className="text-xs font-bold uppercase text-[#6f746e]">Bill summary</p>
            <div className="mt-5 space-y-3 text-sm">
              <div className="flex justify-between gap-6"><span>Charges</span><strong className="tabular-nums">{money(bill.subtotal)}</strong></div>
              <div className={`flex justify-between gap-6 ${Number(bill.total_deductions) > 0 ? "rounded-sm bg-[#e7f4f2] px-2 py-1.5 text-[#167c73]" : ""}`}>
                <span>Deductions</span>
                <strong className="tabular-nums">- {money(bill.total_deductions)}</strong>
              </div>
              {Number(bill.vat_amount) > 0 && (
                <div className="flex justify-between gap-6"><span>VAT {bill.vat_rate ? `(${bill.vat_rate}%)` : ""}</span><strong className="tabular-nums">{money(bill.vat_amount)}</strong></div>
              )}
              {Number(bill.sscl_amount) > 0 && (
                <div className="flex justify-between gap-6"><span>SSCL {bill.sscl_rate ? `(${bill.sscl_rate}%)` : ""}</span><strong className="tabular-nums">{money(bill.sscl_amount)}</strong></div>
              )}
              <div className="flex justify-between gap-6"><span>Paid</span><strong className="tabular-nums">- {money(bill.amount_paid)}</strong></div>
              <div className="flex justify-between gap-6 border-t border-[#e2ded4] pt-3">
                <span>Due</span>
                <strong className={`tabular-nums ${Number(bill.balance_due) > 0 ? "text-[#b84837]" : ""}`}>
                  {money(bill.balance_due)}
                </strong>
              </div>
              <div className="flex justify-between gap-6 border-t-2 border-[#20221f] pt-4 text-sm uppercase">
                <span>Balance</span>
                <strong className={`tabular-nums ${Number(bill.customer_balance ?? 0) > 0 ? "text-[#167c73]" : ""}`}>
                  {money(bill.customer_balance ?? 0)}
                </strong>
              </div>
            </div>
          </Panel>
        </div>
      </div>
    </AppShell>
  );
}

function BillItemDescription({ item }: { item: { description: string; included_services?: string[] | null } }) {
  const { title, inclusions } = billLinePresentation(item);
  return (
    <>
      <p className="font-semibold">{title}</p>
      {inclusions.length > 0 && (
        <ul className="mt-1.5 space-y-0.5 text-xs font-normal text-[#6f746e]">
          {inclusions.map((name) => (
            <li key={name} className="pl-0.5">– {name}</li>
          ))}
        </ul>
      )}
    </>
  );
}

function ServiceAddModeToggle({
  mode,
  onChange,
}: {
  mode: "services" | "inventory" | "discount";
  onChange: (mode: "services" | "inventory" | "discount") => void;
}) {
  const options = [
    ["services", "Services"],
    ["inventory", "Inventory"],
    ["discount", "Discount"],
  ] as const;

  return (
    <div>
      <p className="mb-2 text-xs font-bold uppercase">Add</p>
      <div className="flex gap-1">
        {options.map(([value, label]) => (
          <button
            key={value}
            type="button"
            onClick={() => onChange(value)}
            className={`h-7 min-w-0 flex-1 border px-1 text-center text-[9px] font-bold uppercase leading-none ${
              mode === value
                ? "border-[#20221f] bg-[#20221f] text-white"
                : "border-[#d7d3c8] bg-[#fbfaf6] hover:border-[#20221f]"
            }`}
          >
            {label}
          </button>
        ))}
      </div>
    </div>
  );
}
