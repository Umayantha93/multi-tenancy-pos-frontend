"use client";

import { FormEvent, Fragment, useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useParams } from "next/navigation";
import { ChevronDown, CreditCard, Lock, MessageCircle, MessageSquare, Plus, Printer, RotateCcw, ShieldCheck, Trash2 } from "lucide-react";
import { AppShell } from "@/components/app-shell";
import { EmployeePicker } from "@/components/employee-picker";
import { LaborCatalogPicker, type LaborCategory } from "@/components/labor-catalog-picker";
import { buttonClass, ConfirmModal, ErrorMessage, inputClass, PageState, Panel } from "@/components/ui";
import { api, formatDate, isMultiBranch, mediaUrl, money, SessionPayload, storeSession, Tenant } from "@/lib/api";
import { billItemLabel, billLinePresentation, PAINT_PANEL_NAMES, profileFor, sortBillItems, usesLaborCatalog, usesServiceAddonWorkspace, usesStoreCounter, usesVehicleJobs } from "@/lib/business-profiles";
import { warrantyLabel } from "@/lib/warranty";
import { billStamp, billStampDateLabel, billStatusLabel, latestPaymentAt } from "@/lib/bill-stamp";
import { BillStatusSeal } from "@/components/bill-status-seal";
import { BillWatermark } from "@/components/bill-watermark";
import { BillingBranchBanner } from "@/components/branch-chip";
import { WarrantyFields, warrantyFromForm } from "@/components/warranty-fields";
import { JobPhotos } from "@/components/job-photos";
import { JobVideos } from "@/components/job-videos";
import { useLocale, useT } from "@/lib/locale";
import { formatStockQty, stockUnitLabel } from "@/lib/stock-unit";
import { billShareUrl, whatsappHref } from "@/lib/whatsapp";

type Part = { id: number; name: string; price: string; stock_qty: number; stock_unit?: string | null; sku?: string | null; barcode?: string | null; brand?: string; serialized?: boolean };
type ComposerLabor = { key: string; laborItemId: string; name: string; hours: string; rate: number };
type ComposerMaterial = { key: string; partId: number; name: string; qty: string; unitPrice: number; stock: number };
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
  admission_date?: string | null;
  job_kind?: string | null;
  hide_amounts?: boolean;
  owe_in_due_date?: string | null;
  subtotal: string;
  total_deductions: string;
  vat_rate?: string | number | null;
  sscl_rate?: string | number | null;
  vat_amount?: string | number | null;
  sscl_amount?: string | number | null;
  amount_paid: string;
  amount_refunded?: string | number;
  balance_due: string;
  customer_balance?: string | number;
  mileage?: number | string | null;
  next_service_mileage?: number | string | null;
  next_service_due_on?: string | null;
  floor_status?: string | null;
  odometer?: number | string | null;
  notes?: string | null;
  internal_notes?: string | null;
  additional_note_color?: string | null;
  warranty_months?: number | null;
  warranty_starts_on?: string | null;
  warranty_until?: string | null;
  customer: { name: string; phone: string; address?: string | null } | null;
  vehicle: { number_plate: string; chassis_number?: string | null; make?: string; model?: string } | null;
  employees?: Array<{ id: number; name: string; position?: string | null }>;
  items: Array<{
    id: number;
    type: string;
    description: string;
    included_services?: string[] | null;
    quantity: string;
    unit_price: string;
    line_total: string;
    part_id?: number | null;
    part?: { id?: number; stock_unit?: string | null } | null;
    panel_group_id?: string | null;
    panel_name?: string | null;
    warranty_months?: number | null;
    warranty_starts_on?: string | null;
    warranty_until?: string | null;
  }>;
  payments: Array<{
    id: number;
    amount: string;
    method: string;
    paid_at: string;
    reference?: string | null;
    cheque_number?: string | null;
    cheque_date?: string | null;
    cheque_status?: string | null;
    cleared_on?: string | null;
  }>;
  refunds?: Array<{
    id: number;
    refunded_at: string;
    reason: string;
    method: string;
    amount: string;
    items?: Array<{
      id: number;
      bill_item_id: number;
      quantity: string;
      amount: string;
      disposition: string;
      bill_item?: { description?: string | null; type?: string } | null;
    }>;
  }>;
  has_pending_cheque?: boolean;
  pending_cheque_date?: string | null;
  refund_status?: string;
  branch?: { id: number; name: string; address?: string | null; phone?: string | null } | null;
};

type RefundDraftLine = {
  bill_item_id: number;
  selected: boolean;
  quantity: string;
  disposition: "restock" | "write_off" | "none";
  maxQty: number;
  unitPrice: number;
  description: string;
  type: string;
  canRestock: boolean;
};

type PendingDelete =
  | { kind: "item"; id: number; label: string }
  | { kind: "payment"; id: number; method: string; amount: string };

export default function BillDetailPage() {
  const { id } = useParams<{ id: string }>();
  const t = useT();
  const { locale } = useLocale();
  const [bill, setBill] = useState<Bill | null>(null);
  const [parts, setParts] = useState<Part[]>([]);
  const [addons, setAddons] = useState<ServiceAddon[]>([]);
  const [addonQty, setAddonQty] = useState("1");
  const [itemQty, setItemQty] = useState("1");
  const [itemSerials, setItemSerials] = useState("");
  const [addingAddonId, setAddingAddonId] = useState<number | null>(null);
  const [serviceAddMode, setServiceAddMode] = useState<"services" | "inventory" | "discount">("services");
  const [tenant, setTenant] = useState<Tenant | null>(null);
  const [error, setError] = useState("");
  const [mode, setMode] = useState<"item" | "payment">("item");
  const [floorPane, setFloorPane] = useState<"work" | "pay">("work");
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
  const [refundOpen, setRefundOpen] = useState(false);
  const [refunding, setRefunding] = useState(false);
  const [refundDate, setRefundDate] = useState("");
  const [refundReason, setRefundReason] = useState("");
  const [refundMethod, setRefundMethod] = useState("cash");
  const [refundLines, setRefundLines] = useState<RefundDraftLine[]>([]);
  const [paymentMethod, setPaymentMethod] = useState("cash");
  const [clearingPaymentId, setClearingPaymentId] = useState<number | null>(null);
  const [mileageDraft, setMileageDraft] = useState("");
  const [nextServiceMileageDraft, setNextServiceMileageDraft] = useState("");
  const [nextServiceDueDraft, setNextServiceDueDraft] = useState("");
  const [savingMileage, setSavingMileage] = useState(false);
  const [savingFloor, setSavingFloor] = useState(false);
  const [internalNotes, setInternalNotes] = useState("");
  const [noteColor, setNoteColor] = useState<"blue" | "red">("blue");
  const [savingNotes, setSavingNotes] = useState(false);
  const [employees, setEmployees] = useState<Array<{ id: number; name: string; position?: string | null }>>([]);
  const [employeeIds, setEmployeeIds] = useState<number[]>([]);
  const [savingEmployees, setSavingEmployees] = useState(false);
  const [laborCategories, setLaborCategories] = useState<LaborCategory[]>([]);
  const [selectedLaborId, setSelectedLaborId] = useState("");
  const [laborHours, setLaborHours] = useState("1");
  const [panelName, setPanelName] = useState("");
  const [panelCustom, setPanelCustom] = useState(false);
  const [composerLabor, setComposerLabor] = useState<ComposerLabor[]>([]);
  const [composerMaterials, setComposerMaterials] = useState<ComposerMaterial[]>([]);
  const [mixQuery, setMixQuery] = useState("");
  const [addingPanel, setAddingPanel] = useState(false);
  const [expandedPanels, setExpandedPanels] = useState<Record<string, boolean>>({});
  const composerKey = useRef(0);
  const [savingLaborHours, setSavingLaborHours] = useState<number | null>(null);
  const [features, setFeatures] = useState<string[]>([]);
  const [warrantyItem, setWarrantyItem] = useState<Bill["items"][number] | null>(null);
  const [savingWarranty, setSavingWarranty] = useState(false);
  const [savingJobWarranty, setSavingJobWarranty] = useState(false);
  const [printWithLogo, setPrintWithLogo] = useState(true);
  const [printThermal, setPrintThermal] = useState(false);
  const canSendSms = features.includes("bill_sms");
  const canWhatsapp = features.includes("bill_whatsapp");
  const canOwnerSms = features.includes("owner_bill_sms");
  const canJobVideos = features.includes("job_videos");
  const canJobPhotos = features.includes("job_photos");
  const canJobBoard = features.includes("job_board");
  const canReminders = features.includes("service_reminders");
  const canAssignEmployees = features.includes("employees_management") || features.includes("attendance");
  const canWarranty = features.includes("warranties");
  const canSerial = features.includes("serial_inventory");

  const logoUrl = mediaUrl(tenant?.logo_url || tenant?.logo);
  const contactEmail = tenant?.contact_email || tenant?.owner_email || "";
  const contactPhones = (tenant?.contact_phones?.length
    ? tenant.contact_phones.map((p) => p.number)
    : [tenant?.contact_phone || tenant?.owner_phone].filter(Boolean)) as string[];
  const profile = profileFor(tenant?.business_type);
  const isPaint = profile.type === "paint";
  const isGarage = profile.type === "garage";
  const isGarageInstant = isGarage && bill?.job_kind === "parts_sale";
  const isStore = usesStoreCounter(profile.type);
  const itemTypes = profile.billItemTypes.filter((option) => {
    if (option.value === "charge") return isStore && bill?.job_kind !== "repair";
    if (isPaint && option.value === "part" && bill?.job_kind !== "parts_sale") return false;
    if (isStore && option.value === "labor" && bill?.job_kind !== "repair") return false;
    if (isGarage && bill?.job_kind === "parts_sale") return option.value === "part";
    return true;
  });
  const selectedType = itemTypes.find((option) => option.value === type) ?? itemTypes[0];
  const activeType = type || selectedType?.value || "labor";
  const isServiceJob = usesServiceAddonWorkspace(profile.type) && bill?.job_kind === "service";
  const isLaborType = activeType === "labor" && usesLaborCatalog(profile.type);
  const selectedLabor = useMemo(() => {
    for (const category of laborCategories) {
      const match = (category.items ?? []).find((item) => String(item.id) === selectedLaborId);
      if (match) return match;
    }
    return null;
  }, [laborCategories, selectedLaborId]);
  const laborAmount = selectedLabor
    ? Number(selectedLabor.hourly_rate) * Number(laborHours || 0)
    : 0;
  const isPanelComposer = isPaint && isLaborType && bill?.job_kind !== "service" && bill?.job_kind !== "parts_sale";
  const composerLaborAmount = composerLabor.reduce((sum, row) => sum + Number(row.hours || 0) * row.rate, 0);
  const composerMaterialAmount = composerMaterials.reduce((sum, row) => sum + Number(row.qty || 0) * row.unitPrice, 0);
  const panelTotal = composerLaborAmount + composerMaterialAmount;
  const jobKindLabel =
    bill?.job_kind === "service"
      ? (isPaint ? t("bills.package") : t("bills.service"))
      : bill?.job_kind === "parts_sale"
        ? (isPaint ? t("bill.counter_sale") : isStore ? t("bill.sale") : t("terms.Instant"))
        : (isPaint ? t("admit.panel_work") : t("bills.repair"));
  const showJobKind = usesVehicleJobs(profile.type) || isStore;
  const billItems = useMemo(() => sortBillItems(bill?.items ?? []), [bill?.items]);
  const chargeItems = useMemo(() => billItems.filter((item) => item.type !== "discount"), [billItems]);
  const chargeGroups = useMemo(() => {
    const seen = new Set<string>();
    const rows: Array<
      | { kind: "group"; groupId: string; name: string; total: number; items: typeof chargeItems }
      | { kind: "line"; item: (typeof chargeItems)[number] }
    > = [];
    for (const item of chargeItems) {
      if (item.panel_group_id) {
        if (seen.has(item.panel_group_id)) continue;
        seen.add(item.panel_group_id);
        const members = chargeItems.filter((line) => line.panel_group_id === item.panel_group_id);
        rows.push({
          kind: "group",
          groupId: item.panel_group_id,
          name: item.panel_name || item.description,
          total: members.reduce((sum, line) => sum + Number(line.line_total), 0),
          items: members,
        });
      } else {
        rows.push({ kind: "line", item });
      }
    }
    return rows;
  }, [chargeItems]);
  const discountItems = useMemo(() => billItems.filter((item) => item.type === "discount"), [billItems]);
  const employeeOptions = useMemo(() => {
    const byId = new Map(employees.map((employee) => [employee.id, employee]));
    for (const assigned of bill?.employees ?? []) {
      if (!byId.has(assigned.id)) byId.set(assigned.id, assigned);
    }
    return [...byId.values()];
  }, [employees, bill?.employees]);
  const isClosed = bill?.status === "closed";
  const isOweIn = bill?.status === "owe_in";
  const isLocked = isClosed || isOweIn;
  const isPaid = Boolean(bill && Number(bill.amount_paid) > 0 && Number(bill.balance_due) <= 0);
  const amountRefunded = Number(bill?.amount_refunded ?? 0);
  const canRefund = Boolean(isClosed && Number(bill?.amount_paid ?? 0) - amountRefunded > 0.00001);
  const hasPendingCheque = Boolean(bill?.has_pending_cheque);
  const canCloseBill = Boolean(isPaid && !hasPendingCheque);
  const stamp = bill ? billStamp(bill) : "quote";
  const hidePrintMoney = Boolean(isGarage && bill?.hide_amounts && Number(bill.amount_paid) <= 0);
  const paymentDate = bill ? billStampDateLabel(latestPaymentAt(bill.payments)) : null;
  const refundTotal = useMemo(
    () => refundLines
      .filter((line) => line.selected)
      .reduce((sum, line) => sum + Number(line.quantity || 0) * line.unitPrice, 0),
    [refundLines],
  );

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
    setPrintThermal((isStore || isGarage) && bill?.job_kind === "parts_sale");
  }, [isStore, isGarage, bill?.job_kind]);

  useEffect(() => {
    if (!itemTypes.length) return;
    if (!type || !itemTypes.some((option) => option.value === type)) {
      setType(itemTypes[0].value);
    }
  }, [itemTypes, type]);

  useEffect(() => {
    if (isPaint && serviceAddMode === "inventory") {
      setServiceAddMode("services");
    }
  }, [isPaint, serviceAddMode]);

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
    setSelectedLaborId("");
    setLaborHours("1");
    setAddonQty("1");
    setItemQty("1");
    setItemSerials("");
    setPanelName("");
    setPanelCustom(false);
    setComposerLabor([]);
    setComposerMaterials([]);
    setMixQuery("");
    setFormKey((value) => value + 1);
  }

  function nextComposerKey() {
    composerKey.current += 1;
    return `row-${composerKey.current}`;
  }

  function addComposerLabor(item: { id: number; name: string; hourly_rate: string; standard_hours: string }) {
    setComposerLabor((current) => {
      if (current.some((row) => row.laborItemId === String(item.id))) return current;
      return [...current, {
        key: nextComposerKey(),
        laborItemId: String(item.id),
        name: item.name,
        hours: String(Number(item.standard_hours) || 1),
        rate: Number(item.hourly_rate),
      }];
    });
    setSelectedLaborId("");
    setError("");
  }

  function addComposerMaterial(part: Part) {
    setComposerMaterials((current) => {
      if (current.some((row) => row.partId === part.id)) return current;
      return [...current, {
        key: nextComposerKey(),
        partId: part.id,
        name: part.name,
        qty: "",
        unitPrice: Number(part.price),
        stock: part.stock_qty,
      }];
    });
    setMixQuery("");
    setError("");
  }

  function switchServiceAddMode(next: "services" | "inventory" | "discount") {
    setServiceAddMode(next);
    setSelectedPartId("");
    setPartQuery("");
    setOutsidePart(false);
    setCustomerPart(false);
    setError("");
    setItemQty("1");
    setAddonQty("1");
    if (next === "inventory") setType("part");
    if (next === "discount") setType("discount");
    setFormKey((value) => value + 1);
  }

  async function sendBillSms() {
    if (!bill?.customer?.phone) {
      setError(t("bill.err_phone_sms"));
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
      setSmsNotice(result.message || t("bill.sms_sent"));
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : t("bill.err_sms"));
    } finally {
      setSendingSms(false);
    }
  }

  function openBillWhatsApp() {
    if (!bill?.customer?.phone) {
      setError(t("bill.whatsapp_need_phone"));
      return;
    }
    const link = billShareUrl(bill.share_token);
    if (!link) {
      setError(t("bill.whatsapp_need_link"));
      return;
    }
    const name = bill.customer.name?.trim();
    const greeting = name ? `Hi ${name},` : "Hi,";
    const kind = stamp === "paid" ? "paid bill" : bill.hide_amounts ? "repair note" : "quotation";
    const href = whatsappHref(bill.customer.phone, `${greeting} ${kind} from ${tenant?.business_name || "us"}: ${link}`);
    if (!href) {
      setError(t("bill.whatsapp_need_phone"));
      return;
    }
    window.open(href, "_blank", "noopener,noreferrer");
  }

  function printBill() {
    document.documentElement.classList.toggle("thermal-print", printThermal);
    const cleanup = () => document.documentElement.classList.remove("thermal-print");
    window.addEventListener("afterprint", cleanup, { once: true });
    window.print();
  }

  async function toggleHideAmounts() {
    if (!bill) return;
    setError("");
    try {
      const updated = await api<Bill>(`/bills/${bill.id}`, {
        method: "PUT",
        body: JSON.stringify({ hide_amounts: !bill.hide_amounts }),
      });
      setBill({ ...bill, hide_amounts: updated.hide_amounts });
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : t("bill.err_repair_note"));
    }
  }

  const load = useCallback(() => {
    api<Bill>(`/bills/${id}`)
      .then((result) => {
        setBill(result);
        setMileageDraft(result.mileage != null && result.mileage !== "" ? String(result.mileage) : "");
        setNextServiceMileageDraft(result.next_service_mileage != null && result.next_service_mileage !== "" ? String(result.next_service_mileage) : "");
        setNextServiceDueDraft(result.next_service_due_on ? String(result.next_service_due_on).slice(0, 10) : "");
        setInternalNotes(result.internal_notes || result.notes || "");
        setNoteColor(result.additional_note_color === "red" ? "red" : "blue");
        setEmployeeIds((result.employees ?? []).map((employee) => employee.id));
      })
      .catch((caught) => setError(caught.message));
  }, [id]);

  const loadParts = useCallback((term = "") => {
    const params = new URLSearchParams({ per_page: "100" });
    const q = term.trim();
    if (q) params.set("search", q);
    return api<{ data: Part[] }>(`/parts?${params}`)
      .then((result) => setParts(result.data))
      .catch(() => undefined);
  }, []);

  useEffect(() => {
    load();
    void loadParts("");
    api<SessionPayload>("/user")
      .then((result) => {
        setTenant(result.user.tenant ?? null);
        setFeatures(result.features);
        const token = localStorage.getItem("garage_token");
        if (token) storeSession(token, result.user, result.features, {
          branches: result.branches,
          active_branch: result.active_branch,
        });
      })
      .catch(() => undefined);
  }, [load, loadParts]);

  useEffect(() => {
    const term = (mixQuery.trim() || partQuery.trim());
    const handle = window.setTimeout(() => {
      void loadParts(term);
    }, term ? 250 : 0);
    return () => window.clearTimeout(handle);
  }, [partQuery, mixQuery, loadParts]);

  useEffect(() => {
    if (!usesLaborCatalog(profile.type) && !usesServiceAddonWorkspace(profile.type)) return;
    api<ServiceAddon[]>("/service-addons")
      .then((result) => setAddons(result.filter((addon) => addon.active !== false)))
      .catch(() => undefined);
    api<LaborCategory[]>("/labor-catalog")
      .then((result) => setLaborCategories(result))
      .catch(() => undefined);
  }, [profile.type]);

  useEffect(() => {
    if (!canAssignEmployees) return;
    api<{ data: Array<{ id: number; name: string; position?: string | null }> }>("/employees?active_only=1&per_page=100")
      .then((result) => setEmployees(result.data))
      .catch(() => undefined);
  }, [canAssignEmployees]);

  const filteredParts = useMemo(() => {
    const query = partQuery.trim().toLowerCase();
    return parts
      .filter((part) => part.stock_qty > 0)
      .filter((part) => {
        if (!query) return true;
        return [part.name, part.sku, part.barcode, part.brand].filter(Boolean).join(" ").toLowerCase().includes(query);
      });
  }, [partQuery, parts]);

  const mixMatches = useMemo(() => {
    const query = mixQuery.trim().toLowerCase();
    const chosen = new Set(composerMaterials.map((row) => row.partId));
    return parts
      .filter((part) => part.stock_qty > 0 && !chosen.has(part.id))
      .filter((part) => {
        if (!query) return true;
        return [part.name, part.sku, part.barcode, part.brand].filter(Boolean).join(" ").toLowerCase().includes(query);
      })
      .slice(0, 8);
  }, [mixQuery, composerMaterials, parts]);

  const selectedPart = parts.find((part) => String(part.id) === selectedPartId);
  const isStockType = selectedType?.kind === "stock" || (isServiceJob && serviceAddMode === "inventory");
  const showQuantity = isStockType || Boolean(selectedType?.allowQty);
  const showCost = !isStockType || outsidePart;
  const useStockSearch = isStockType && !outsidePart && !customerPart;

  async function addGarageStockLine(part: Part, quantity = 1) {
    if (isLocked) return;
    setError("");
    try {
      await api(`/bills/${id}/items`, {
        method: "POST",
        body: JSON.stringify({ type: "part", part_id: part.id, quantity }),
      });
      setSelectedPartId("");
      setPartQuery("");
      load();
      void loadParts(partQuery);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : t("bill.err_item"));
    }
  }

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
      if (isGarageInstant) {
        await addGarageStockLine(local);
        return true;
      }
      setSelectedPartId(String(local.id));
      setPartQuery(local.name);
      setError("");
      return true;
    }

    try {
      const result = await api<{ data: Part[] }>(`/parts?barcode=${encodeURIComponent(trimmed)}&per_page=5`);
      const match = result.data.find((part) => part.stock_qty > 0) ?? null;
      if (match) {
        if (isGarageInstant) {
          setParts((current) => (current.some((part) => part.id === match.id) ? current : [...current, match]));
          await addGarageStockLine(match);
          return true;
        }
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
      if (isGarageInstant) {
        await addGarageStockLine(matches[0]);
        return true;
      }
      setSelectedPartId(String(matches[0].id));
      setPartQuery(matches[0].name);
      setError("");
      return true;
    }

    if (!/\s/.test(trimmed)) {
      setError(t("bill.err_barcode", { code: trimmed }));
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
    const payload: Record<string, unknown> = {
      type: String(formData.get("type") || lineType),
    };

    if (isLaborType && !isPaint) {
      const qty = Number(laborHours);
      if (!Number.isFinite(qty) || qty <= 0) {
        setError(t("bill.err_hours"));
        return;
      }
    }

    if (isPanelComposer) {
      const name = (panelCustom ? String(formData.get("panel_name") || "") : panelName).trim();
      if (!name) {
        setError(t("bill.err_panel"));
        return;
      }
      const labor: Array<Record<string, string>> = [];
      for (const row of composerLabor) {
        const hours = Number(row.hours);
        if (!Number.isFinite(hours) || hours <= 0) {
          setError(t("bill.err_hours_for", { name: row.name }));
          return;
        }
        labor.push({ labor_item_id: row.laborItemId, quantity: row.hours });
      }
      const materials: Array<Record<string, string>> = [];
      for (const row of composerMaterials) {
        const ml = Number(row.qty);
        if (!Number.isFinite(ml) || ml <= 0 || ml !== Math.floor(ml)) {
          setError(t("bill.err_ml_for", { name: row.name }));
          return;
        }
        if (ml > row.stock) {
          setError(t("bill.err_stock_ml", { name: row.name, qty: row.stock }));
          return;
        }
        materials.push({ part_id: String(row.partId), quantity: String(ml) });
      }
      if (labor.length === 0 && materials.length === 0) {
        setError(t("bill.err_panel_lines"));
        return;
      }

      setAddingPanel(true);
      try {
        await api(`/bills/${id}/items/panel`, {
          method: "POST",
          body: JSON.stringify({ panel_name: name, labor, materials }),
        });
        resetItemForm(itemTypes[0]?.value);
        load();
        void loadParts(partQuery);
      } catch (caught) {
        setError(caught instanceof Error ? caught.message : t("bill.err_panel_add"));
        load();
        void loadParts(partQuery);
      } finally {
        setAddingPanel(false);
      }
      return;
    }

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
          setError(t("bill.err_part"));
          return;
        }
        payload.part_id = selectedPartId;
        payload.quantity = String(formData.get("quantity") || "1");
        if (canSerial && selectedPart?.serialized) {
          const serials = itemSerials.split(/[\n,;]+/).map((code) => code.trim()).filter(Boolean);
          if (serials.length === 0) {
            setError(t("serials.need_imei"));
            return;
          }
          payload.serials = serials;
          payload.quantity = String(serials.length);
        }
      }
    } else if (isLaborType && selectedLaborId) {
      payload.type = "labor";
      payload.labor_item_id = selectedLaborId;
      payload.quantity = laborHours || "1";
    } else if (isLaborType) {
      payload.description = String(formData.get("description") || "");
      payload.unit_price = String(formData.get("unit_price") || "");
      payload.quantity = laborHours || "1";
    } else {
      payload.description = String(formData.get("description") || "");
      payload.unit_price = String(formData.get("unit_price") || "");
      payload.quantity = showQuantity ? String(formData.get("quantity") || "1") : "1";
    }

    try {
      const warranty = canWarranty && payload.type !== "discount" ? warrantyFromForm(formData) : null;
      await api(`/bills/${id}/items`, { method: "POST", body: JSON.stringify(warranty ? { ...payload, ...warranty } : payload) });
      resetItemForm(isServiceJob ? (serviceAddMode === "discount" ? "discount" : "part") : itemTypes[0]?.value);
      load();
      void loadParts(partQuery);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : t("bill.err_item"));
    }
  }

  async function saveWarranty(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!warrantyItem || isLocked) return;
    setSavingWarranty(true);
    setError("");
    try {
      await api(`/bills/${id}/items/${warrantyItem.id}/warranty`, {
        method: "PUT",
        body: JSON.stringify(warrantyFromForm(new FormData(event.currentTarget))),
      });
      setWarrantyItem(null);
      load();
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : t("bill.err_warranty"));
    } finally {
      setSavingWarranty(false);
    }
  }

  async function saveJobWarranty(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!bill || isLocked) return;
    setSavingJobWarranty(true);
    setError("");
    try {
      const updated = await api<Bill>(`/bills/${id}/warranty`, {
        method: "PUT",
        body: JSON.stringify(warrantyFromForm(new FormData(event.currentTarget))),
      });
      setBill(updated);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : t("bill.err_warranty"));
    } finally {
      setSavingJobWarranty(false);
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
      setAddonQty("1");
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : t("bill.err_service"));
    } finally {
      setAddingAddonId(null);
    }
  }

  async function saveLaborHours(itemId: number, hours: string) {
    if (isLocked) return;
    const quantity = Number(hours);
    if (!Number.isFinite(quantity) || quantity <= 0) {
      setError(t("bill.err_hours_gt"));
      return;
    }
    setSavingLaborHours(itemId);
    setError("");
    try {
      await api(`/bills/${id}/items/${itemId}`, { method: "PUT", body: JSON.stringify({ quantity: hours }) });
      load();
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : t("bill.err_hours_update"));
    } finally {
      setSavingLaborHours(null);
    }
  }

  async function addPayment(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (isClosed) return;
    const form = event.currentTarget;
    try {
      await api(`/bills/${id}/payments`, { method: "POST", body: JSON.stringify(Object.fromEntries(new FormData(form))) });
      form.reset();
      setPaymentMethod("cash");
      load();
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : t("bill.err_payment"));
    }
  }

  async function clearCheque(paymentId: number) {
    if (isClosed) return;
    setClearingPaymentId(paymentId);
    setError("");
    try {
      await api(`/bills/${id}/payments/${paymentId}/clear`, { method: "POST" });
      load();
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : t("bill.err_clear"));
    } finally {
      setClearingPaymentId(null);
    }
  }

  async function bounceCheque(paymentId: number) {
    if (isClosed) return;
    setClearingPaymentId(paymentId);
    setError("");
    try {
      await api(`/bills/${id}/payments/${paymentId}/bounce`, { method: "POST" });
      load();
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : t("bill.err_bounce"));
    } finally {
      setClearingPaymentId(null);
    }
  }

  async function remove(itemId: number) {
    if (isLocked) return;
    const item = bill?.items.find((entry) => entry.id === itemId);
    const grouped = item?.panel_group_id
      ? bill?.items.filter((entry) => entry.panel_group_id === item.panel_group_id) ?? []
      : [];
    setPendingDelete({
      kind: "item",
      id: itemId,
      label: grouped.length > 1
        ? `${item?.panel_name || item?.description || "this panel"} and its labor/materials`
        : item?.description || "this line item",
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
        void loadParts(partQuery);
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
            ? t("bill.err_remove_item")
            : t("bill.err_remove_payment"),
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
      const payload: Record<string, number | string | null> = {
        mileage: mileageDraft === "" ? null : Number(mileageDraft),
      };
      if (isServiceJob) {
        payload.next_service_mileage = nextServiceMileageDraft === "" ? null : Number(nextServiceMileageDraft);
        if (canReminders) {
          payload.next_service_due_on = nextServiceDueDraft === "" ? null : nextServiceDueDraft;
        }
      }
      const updated = await api<Bill>(`/bills/${id}`, {
        method: "PUT",
        body: JSON.stringify(payload),
      });
      setBill(updated);
      setMileageDraft(updated.mileage != null && updated.mileage !== "" ? String(updated.mileage) : "");
      setNextServiceMileageDraft(
        updated.next_service_mileage != null && updated.next_service_mileage !== ""
          ? String(updated.next_service_mileage)
          : "",
      );
      setNextServiceDueDraft(updated.next_service_due_on ? String(updated.next_service_due_on).slice(0, 10) : "");
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : t("bill.err_mileage"));
    } finally {
      setSavingMileage(false);
    }
  }

  async function saveInternalNotes(event: FormEvent) {
    event.preventDefault();
    if (!bill || isClosed) return;
    setSavingNotes(true);
    setError("");
    try {
      const updated = await api<Bill>(`/bills/${id}`, {
        method: "PUT",
        body: JSON.stringify({
          internal_notes: internalNotes || null,
          additional_note_color: isGarage ? noteColor : null,
        }),
      });
      setBill(updated);
      setInternalNotes(updated.internal_notes || updated.notes || "");
      setNoteColor(updated.additional_note_color === "red" ? "red" : "blue");
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : t("bill.err_note"));
    } finally {
      setSavingNotes(false);
    }
  }

  async function saveEmployees(ids: number[]) {
    if (!bill || isClosed) return;
    setEmployeeIds(ids);
    setSavingEmployees(true);
    setError("");
    try {
      const updated = await api<Bill>(`/bills/${id}/employees`, {
        method: "PUT",
        body: JSON.stringify({ employee_ids: ids }),
      });
      setBill(updated);
      setEmployeeIds((updated.employees ?? []).map((employee) => employee.id));
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : t("bill.err_employees"));
    } finally {
      setSavingEmployees(false);
    }
  }

  function openRefundModal() {
    if (!bill || !canRefund) return;
    const refundedQty = new Map<number, number>();
    for (const refund of bill.refunds ?? []) {
      for (const line of refund.items ?? []) {
        refundedQty.set(line.bill_item_id, (refundedQty.get(line.bill_item_id) ?? 0) + Number(line.quantity));
      }
    }
    const drafts: RefundDraftLine[] = bill.items
      .filter((item) => item.type !== "discount")
      .map((item) => {
        const maxQty = Math.max(0, Number(item.quantity) - (refundedQty.get(item.id) ?? 0));
        const canRestock = item.type === "part" && Boolean(item.part_id);
        const disposition: RefundDraftLine["disposition"] = canRestock ? "restock" : "none";
        return {
          bill_item_id: item.id,
          selected: maxQty > 0,
          quantity: maxQty > 0 ? String(maxQty) : "0",
          disposition,
          maxQty,
          unitPrice: Number(item.unit_price),
          description: item.description,
          type: item.type,
          canRestock,
        };
      })
      .filter((line) => line.maxQty > 0);

    setRefundDate(new Date().toISOString().slice(0, 10));
    setRefundReason("");
    setRefundMethod("cash");
    setRefundLines(drafts);
    setRefundOpen(true);
  }

  async function submitRefund(event: FormEvent) {
    event.preventDefault();
    if (!bill || !canRefund) return;
    const selected = refundLines.filter((line) => line.selected && Number(line.quantity) > 0);
    if (!selected.length) {
      setError(t("bill.err_refund_select"));
      return;
    }
    setRefunding(true);
    setError("");
    try {
      await api(`/bills/${id}/refunds`, {
        method: "POST",
        body: JSON.stringify({
          refunded_at: refundDate,
          reason: refundReason,
          method: refundMethod,
          items: selected.map((line) => ({
            bill_item_id: line.bill_item_id,
            quantity: Number(line.quantity),
            disposition: line.canRestock ? line.disposition : "none",
          })),
        }),
      });
      setRefundOpen(false);
      load();
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : t("bill.err_refund"));
    } finally {
      setRefunding(false);
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
      setError(caught instanceof Error ? caught.message : t("bill.err_close", { kind: t(`terms.${profile.billingSingular}`).toLowerCase() }));
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
      setError(caught instanceof Error ? caught.message : t("bill.err_owe"));
    } finally {
      setMarkingOweIn(false);
    }
  }

  if (!bill) {
    return (
      <AppShell title={t(`terms.${profile.billingSingular}`)} eyebrow={t("bill.eyebrow")}>
        {error ? <ErrorMessage message={error} /> : <PageState message={t("bill.opening", { kind: t(`terms.${profile.billingSingular}`).toLowerCase() })} />}
      </AppShell>
    );
  }

  return (
    <AppShell
      title={bill.bill_number}
      eyebrow={`${bill.vehicle?.number_plate ?? bill.customer?.name ?? t(`terms.${profile.billingSingular}`)}${showJobKind ? ` · ${jobKindLabel}` : ""} · ${billStatusLabel(bill.status, t)}`}
      action={
        <div className="no-print flex w-full min-w-0 flex-wrap items-center gap-2">
          {isGarage && Number(bill.amount_paid) <= 0 && (
            <button
              type="button"
              onClick={() => void toggleHideAmounts()}
              className={`h-8 shrink-0 whitespace-nowrap border px-2.5 text-[11px] font-bold uppercase ${bill.hide_amounts ? "border-[#167c73] bg-[#167c73] text-white" : "border-[#c9c5b9] bg-white"}`}
              title={t("bill.hide_amounts_title")}
            >
              {bill.hide_amounts ? t("bill.repair_note") : t("bill.hide_amounts")}
            </button>
          )}
          {canSendSms && (
            <button
              type="button"
              onClick={sendBillSms}
              disabled={sendingSms || !bill.customer?.phone}
              className="grid size-8 shrink-0 place-items-center border border-[#c9c5b9] disabled:cursor-not-allowed disabled:opacity-40"
              title={
                !bill.customer?.phone
                  ? t("bill.sms_need_phone")
                  : canOwnerSms
                    ? t("bill.sms_owner")
                    : stamp === "paid"
                      ? t("bill.sms_paid")
                      : bill.hide_amounts
                        ? t("bill.sms_note")
                        : t("bill.sms_quote")
              }
            >
              <MessageSquare size={15} />
            </button>
          )}
          {canWhatsapp && (
            <button
              type="button"
              onClick={openBillWhatsApp}
              disabled={!bill.customer?.phone || !bill.share_token}
              className="grid size-8 shrink-0 place-items-center border border-[#c9c5b9] disabled:cursor-not-allowed disabled:opacity-40"
              title={!bill.customer?.phone ? t("bill.whatsapp_need_phone") : t("bill.whatsapp")}
            >
              <MessageCircle size={15} />
            </button>
          )}
          <label className="inline-flex h-8 shrink-0 cursor-pointer items-center gap-2 whitespace-nowrap border border-[#c9c5b9] bg-white px-2.5 text-[11px] font-bold uppercase">
            <input
              type="checkbox"
              checked={printThermal}
              onChange={(event) => setPrintThermal(event.target.checked)}
              className="size-3.5 accent-[#167c73]"
            />
            {t("bill.print_80")}
          </label>
          <label className="inline-flex h-8 shrink-0 cursor-pointer items-center gap-2 whitespace-nowrap border border-[#c9c5b9] bg-white px-2.5 text-[11px] font-bold uppercase">
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
          <button onClick={printBill} className="grid size-8 shrink-0 place-items-center border border-[#c9c5b9]" title={t("bill.print_bill")}>
            <Printer size={15} />
          </button>
          {canRefund && (
            <button
              type="button"
              onClick={openRefundModal}
              className="inline-flex h-8 shrink-0 items-center gap-2 border border-[#b84837]/40 bg-white px-2.5 text-[11px] font-semibold text-[#b84837] hover:bg-[#b84837]/5"
              title={t("bill.refund_title")}
            >
              <RotateCcw size={14} />
              <span className="hidden sm:inline">{t("bill.refund")}</span>
            </button>
          )}
          {!isClosed && !isOweIn && (
            <div ref={closeMenuRef} className="relative shrink-0">
              <div className="inline-flex h-8 overflow-hidden border border-[#c9c5b9] bg-white">
                <button
                  type="button"
                  disabled={!canCloseBill}
                  onClick={() => setPendingClose(true)}
                  className="inline-flex h-8 items-center gap-2 px-2.5 text-[11px] font-semibold hover:bg-[#f7f5ef] disabled:cursor-not-allowed disabled:opacity-40"
                  title={
                    hasPendingCheque
                      ? t("bill.close_cheques")
                      : isPaid
                      ? t("bill.close_title", { kind: t(`terms.${profile.billingSingular}`).toLowerCase() })
                      : t("bill.close_pay_first", { kind: t(`terms.${profile.billingSingular}`).toLowerCase() })
                  }
                >
                  <Lock size={14} />
                  <span className="hidden sm:inline">{t("bill.close")}</span>
                </button>
                <span className="w-px self-stretch bg-[#c9c5b9]" />
                <button
                  type="button"
                  onClick={() => setOweInMenu((open) => !open)}
                  className="grid h-8 w-8 place-items-center hover:bg-[#f7f5ef]"
                  title={t("bill.more_close")}
                  aria-label={t("bill.more_close")}
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
                    {t("bill.owe_in")}
                  </button>
                </div>
              )}
            </div>
          )}
          {isOweIn && canCloseBill && (
            <button
              type="button"
              onClick={() => setPendingClose(true)}
              className="inline-flex h-8 items-center gap-2 border border-[#20221f] bg-white px-2.5 text-[11px] font-semibold hover:bg-[#20221f] hover:text-white"
            >
              <Lock size={16} />
              <span className="hidden sm:inline">{t("bill.close")}</span>
            </button>
          )}
          {isOweIn && hasPendingCheque && (
            <span className="text-[10px] font-semibold uppercase text-[#b8860b]">{t("bill.cheque_pending")}</span>
          )}
        </div>
      }
    >
      <ConfirmModal
        open={Boolean(pendingDelete)}
        title={pendingDelete?.kind === "payment" ? t("bill.remove_payment") : t("bill.remove_line")}
        message={
          pendingDelete?.kind === "payment"
            ? t("bill.remove_payment_msg", { method: pendingDelete.method.toUpperCase(), amount: money(pendingDelete.amount) })
            : t("bill.remove_item_msg", { label: pendingDelete?.label ?? t("bill.this_line") })
        }
        confirmLabel={pendingDelete?.kind === "payment" ? t("bill.remove_payment") : t("bill.remove_item")}
        tone="danger"
        busy={deleting}
        onCancel={() => {
          if (!deleting) setPendingDelete(null);
        }}
        onConfirm={confirmDelete}
      />
      <ConfirmModal
        open={pendingClose}
        title={t("bill.close_kind", { kind: t(`terms.${profile.billingSingular}`).toLowerCase() })}
        message={t("bill.close_msg", { kind: t(`terms.${profile.billingSingular}`).toLowerCase() })}
        confirmLabel={t("bill.close_kind", { kind: t(`terms.${profile.billingSingular}`).toLowerCase() })}
        tone="default"
        busy={closing}
        onCancel={() => {
          if (!closing) setPendingClose(false);
        }}
        onConfirm={confirmClose}
      />
      <ConfirmModal
        open={pendingOweIn}
        title={t("bill.owe_title")}
        message={t("bill.owe_msg", { kind: t(`terms.${profile.billingSingular}`).toLowerCase() })}
        confirmLabel={t("bill.owe_confirm")}
        tone="teal"
        busy={markingOweIn}
        onCancel={() => {
          if (!markingOweIn) setPendingOweIn(false);
        }}
        onConfirm={confirmOweIn}
      >
        <label className="mt-4 block text-xs font-bold uppercase">
          {t("bill.due_date")}
          <input
            type="date"
            min={new Date().toISOString().slice(0, 10)}
            value={oweInDate}
            onChange={(event) => setOweInDate(event.target.value)}
            className={`${inputClass} mt-2`}
          />
        </label>
      </ConfirmModal>
      {refundOpen && (
        <div className="no-print fixed inset-0 z-50 grid place-items-center bg-black/55 p-4" onClick={() => !refunding && setRefundOpen(false)}>
          <form
            onSubmit={submitRefund}
            onClick={(event) => event.stopPropagation()}
            className="max-h-[90vh] w-full max-w-2xl overflow-y-auto bg-[#f3f0e8] p-5"
          >
            <h2 className="font-display text-2xl font-semibold uppercase">{t("bill.refund_bill")}</h2>
            <p className="mt-1 text-sm text-[#6f746e]">
              {t("bill.refund_hint")}
            </p>
            <div className="mt-4 grid gap-3 sm:grid-cols-2">
              <label className="block text-xs font-bold uppercase">
                {t("bill.refund_date")}
                <input
                  type="date"
                  required
                  value={refundDate}
                  onChange={(event) => setRefundDate(event.target.value)}
                  className={`${inputClass} mt-2`}
                />
              </label>
              <label className="block text-xs font-bold uppercase">
                {t("common.method")}
                <select
                  value={refundMethod}
                  onChange={(event) => setRefundMethod(event.target.value)}
                  className={`${inputClass} mt-2`}
                >
                  <option value="cash">{t("method.cash")}</option>
                  <option value="card">{t("method.card")}</option>
                  <option value="bank_transfer">{t("method.bank_transfer")}</option>
                  <option value="other">{t("method.other")}</option>
                </select>
              </label>
            </div>
            <label className="mt-3 block text-xs font-bold uppercase">
              {t("common.reason")}
              <textarea
                required
                rows={3}
                value={refundReason}
                onChange={(event) => setRefundReason(event.target.value)}
                className={`${inputClass} mt-2`}
                placeholder={t("bill.refund_reason_placeholder")}
              />
            </label>
            <div className="mt-4 space-y-3">
              {refundLines.map((line) => (
                <div key={line.bill_item_id} className="border border-[#d7d3c8] bg-white p-3 text-sm">
                  <label className="flex items-start gap-3">
                    <input
                      type="checkbox"
                      checked={line.selected}
                      onChange={(event) => {
                        const checked = event.target.checked;
                        setRefundLines((rows) => rows.map((row) => (
                          row.bill_item_id === line.bill_item_id ? { ...row, selected: checked } : row
                        )));
                      }}
                      className="mt-1 size-4 accent-[#167c73]"
                    />
                    <span className="min-w-0 flex-1">
                      <span className="font-semibold">{line.description}</span>
                      <span className="mt-0.5 block text-[11px] uppercase text-[#6f746e]">
                        {t("bill.up_to", { type: billItemLabel(line.type, profile, t), qty: line.maxQty, price: money(line.unitPrice) })}
                      </span>
                    </span>
                  </label>
                  {line.selected && (
                    <div className="mt-3 grid gap-3 sm:grid-cols-2">
                      <label className="block text-[11px] font-bold uppercase">
                        {t("common.quantity")}
                        <input
                          type="number"
                          min={line.canRestock ? 1 : 0.01}
                          max={line.maxQty}
                          step={line.canRestock ? 1 : 0.01}
                          value={line.quantity}
                          onChange={(event) => {
                            const value = event.target.value;
                            setRefundLines((rows) => rows.map((row) => (
                              row.bill_item_id === line.bill_item_id ? { ...row, quantity: value } : row
                            )));
                          }}
                          className={`${inputClass} mt-1`}
                        />
                      </label>
                      {line.canRestock ? (
                        <div>
                          <p className="text-[11px] font-bold uppercase">{t("common.stock")}</p>
                          <div className="mt-1 flex flex-wrap gap-2">
                            {([
                              ["restock", t("bill.return_stock")],
                              ["write_off", t("bill.write_off")],
                            ] as const).map(([value, label]) => (
                              <button
                                key={value}
                                type="button"
                                onClick={() => setRefundLines((rows) => rows.map((row) => (
                                  row.bill_item_id === line.bill_item_id ? { ...row, disposition: value } : row
                                )))}
                                className={`h-8 border px-2.5 text-[11px] font-semibold ${
                                  line.disposition === value
                                    ? "border-[#20221f] bg-[#20221f] text-white"
                                    : "border-[#c9c5b9] bg-white"
                                }`}
                              >
                                {label}
                              </button>
                            ))}
                          </div>
                        </div>
                      ) : (
                        <p className="self-end text-[11px] text-[#6f746e]">{t("bill.money_only")}</p>
                      )}
                    </div>
                  )}
                </div>
              ))}
              {refundLines.length === 0 && (
                <p className="text-sm text-[#6f746e]">{t("bill.nothing_refund")}</p>
              )}
            </div>
            <div className="mt-4 flex flex-wrap items-center justify-between gap-3 border-t border-[#d7d3c8] pt-4">
              <p className="text-sm font-semibold">{t("bill.refund_total", { amount: money(refundTotal) })}</p>
              <div className="flex gap-2">
                <button type="button" disabled={refunding} onClick={() => setRefundOpen(false)} className={`${buttonClass} bg-white`}>
                  {t("common.cancel")}
                </button>
                <button type="submit" disabled={refunding || refundTotal <= 0} className={buttonClass}>
                  {refunding ? t("bill.refunding") : t("bill.confirm_refund")}
                </button>
              </div>
            </div>
          </form>
        </div>
      )}
      {warrantyItem && (
        <div className="no-print fixed inset-0 z-50 grid place-items-center bg-black/55 p-4" onClick={() => !savingWarranty && setWarrantyItem(null)}>
          <form
            onSubmit={saveWarranty}
            onClick={(event) => event.stopPropagation()}
            className="w-full max-w-md bg-[#f3f0e8] p-5"
          >
            <h2 className="font-display text-2xl font-semibold uppercase">{t("warranty.title")}</h2>
            <p className="mt-1 text-sm text-[#6f746e]">{warrantyItem.description}</p>
            <div className="mt-4">
              <WarrantyFields
                key={warrantyItem.id}
                purchaseDate={bill?.admission_date}
                months={warrantyItem.warranty_months}
                startsOn={warrantyItem.warranty_starts_on}
                until={warrantyItem.warranty_until}
              />
            </div>
            <div className="mt-4 flex gap-2">
              <button type="button" onClick={() => setWarrantyItem(null)} className={`${buttonClass} flex-1 bg-white`}>{t("common.cancel")}</button>
              <button disabled={savingWarranty} className={`${buttonClass} flex-1`}>{savingWarranty ? t("common.saving") : t("warranty.save")}</button>
            </div>
          </form>
        </div>
      )}
      <BillingBranchBanner />
      {!isClosed && (
        <div className="no-print mb-4 grid grid-cols-2 xl:hidden">
          <button
            type="button"
            onClick={() => setFloorPane("work")}
            className={`h-11 text-sm font-semibold ${floorPane === "work" ? "bg-[#20221f] text-white" : "border border-[#d7d3c8] bg-white"}`}
          >
            {t("bill.bill_items")}
          </button>
          <button
            type="button"
            onClick={() => {
              setFloorPane("pay");
              setMode(isOweIn ? "payment" : "item");
            }}
            className={`inline-flex h-11 items-center justify-center gap-1 text-sm font-semibold ${floorPane === "pay" && (isOweIn || mode === "item") ? "bg-[#20221f] text-white" : "border border-[#d7d3c8] bg-white"}`}
          >
            {isOweIn ? t("bill.payment") : (
              <>
                <Plus size={16} />
                {t("bill.add_item")}
              </>
            )}
          </button>
        </div>
      )}
      <div className={`bill-print-sheet min-w-0 max-w-full ${!isClosed && Number(bill.balance_due) > 0 ? "pb-12 xl:pb-0" : ""}`}>
      <BillWatermark src={printWithLogo ? logoUrl : null} printOnly />
      <Panel className="bill-letterhead mb-5 overflow-hidden p-5">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div className="flex min-w-0 items-start gap-4">
            {logoUrl ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={logoUrl}
                alt={tenant?.business_name ?? t("bill.business_logo")}
                className="h-20 w-20 shrink-0 object-contain border border-[#d7d3c8] bg-white p-1"
              />
            ) : (
              <div className="grid h-20 w-20 shrink-0 place-items-center border border-dashed border-[#c9c5b9] bg-[#fbfaf6] text-center text-[10px] font-bold uppercase text-[#6f746e]">
                {t("bill.no_logo")}
              </div>
            )}
            <div className="min-w-0">
              <p className="break-words font-display text-2xl font-semibold uppercase leading-tight sm:text-3xl sm:leading-none">
                {tenant?.business_name ?? t("bill.business")}
              </p>
              {isMultiBranch() && bill.branch?.name && (
                <p className="mt-1 text-sm font-semibold uppercase tracking-wide text-[#167c73]">{bill.branch.name}</p>
              )}
              <p className="mt-1 text-sm text-[#6f746e]">{bill.bill_number}</p>
              <div className="mt-1.5 space-y-0.5 text-sm print:text-xs">
                {(bill.branch?.address || tenant?.address) && <p><span className="text-[#6f746e]">{t("common.address")}:</span> {bill.branch?.address || tenant?.address}</p>}
                {tenant?.tin && <p><span className="text-[#6f746e]">{t("common.tin")}:</span> {tenant.tin}</p>}
                {contactPhones.map((phone) => (
                  <p key={phone}><span className="text-[#6f746e]">{t("common.mobile")}:</span> {phone}</p>
                ))}
                {contactEmail && <p><span className="text-[#6f746e]">{t("common.email")}:</span> {contactEmail}</p>}
              </div>
            </div>
          </div>
          <div className="flex w-full flex-col items-start text-left text-xs uppercase text-[#6f746e] sm:w-auto sm:shrink-0 sm:items-end sm:text-right">
            <p className="font-bold text-[#167c73]">
              {hidePrintMoney ? t("bill.repair_note") : t("bill.tax_invoice", { kind: t(`terms.${profile.billingSingular}`).toLowerCase() })}
              {showJobKind && !hidePrintMoney ? <span className="bill-print-kind">{` · ${jobKindLabel}`}</span> : ""}
            </p>
            <p className="mt-1 normal-case">{new Date().toLocaleString(locale === "si" ? "si-LK" : "en-LK")}</p>
            <BillStatusSeal stamp={stamp} paymentDate={paymentDate} />
          </div>
        </div>
      </Panel>

      <div className="grid min-w-0 items-start gap-5 xl:grid-cols-[1.55fr_0.75fr] print:block print:space-y-2">
        <div className={`min-w-0 space-y-5 print:space-y-2 ${!isClosed && floorPane !== "work" ? "hidden" : "block"} xl:block`}>
          <Panel className={isGarageInstant ? "bill-instant-meta" : undefined}>
            <div className="bill-meta grid gap-4 p-5 sm:grid-cols-2 lg:grid-cols-4">
              <div className="bill-customer">
                <p className="text-[10px] font-bold uppercase text-[#6f746e]">{t("common.customer")}</p>
                <p className="mt-1 font-semibold">{bill.customer?.name ?? t("common.walk_in")}</p>
                {bill.customer?.phone && (
                  <p className="text-sm text-[#6f746e]">{bill.customer.phone}</p>
                )}
                {bill.customer?.address && (
                  <p className="mt-1 text-sm text-[#6f746e]">{bill.customer.address}</p>
                )}
              </div>
              {bill.vehicle ? (
                <>
                  <div>
                    <p className="text-[10px] font-bold uppercase text-[#6f746e]">{profile.type === "device_repair" ? t("admit.device") : t("common.vehicle")}</p>
                    <p className="mt-1 font-semibold">{bill.vehicle.number_plate}</p>
                    <p className="text-sm text-[#6f746e]">{bill.vehicle.make} {bill.vehicle.model}</p>
                  </div>
                  <div>
                    <p className="text-[10px] font-bold uppercase text-[#6f746e]">{t("bill.chassis")}</p>
                    <p className="mt-1 break-all text-sm">{bill.vehicle.chassis_number || "—"}</p>
                  </div>
                  <div>
                    <p className="text-[10px] font-bold uppercase text-[#6f746e]">{t("bill.mileage")}</p>
                    <p className="mt-1 font-semibold">
                      {bill.mileage != null && bill.mileage !== "" ? t("common.km", { count: Number(bill.mileage).toLocaleString() }) : "—"}
                    </p>
                    {isServiceJob && (
                      <>
                        <p className="mt-3 text-[10px] font-bold uppercase text-[#6f746e]">{t("bill.next_service")}</p>
                        <p className="mt-1 font-semibold">
                          {bill.next_service_mileage != null && bill.next_service_mileage !== ""
                            ? t("common.km", { count: Number(bill.next_service_mileage).toLocaleString() })
                            : "—"}
                          {bill.next_service_due_on ? ` · ${formatDate(bill.next_service_due_on)}` : ""}
                        </p>
                      </>
                    )}
                    {!isLocked && (
                      <form onSubmit={saveMileage} className="no-print mt-2 space-y-2">
                        <div className="flex h-8 min-w-0 items-stretch gap-2">
                          <input
                            type="number"
                            min="0"
                            step="1"
                            value={mileageDraft}
                            onChange={(event) => setMileageDraft(event.target.value)}
                            className={`${inputClass} min-w-0`}
                            placeholder={t("bill.current_km")}
                          />
                          {!isServiceJob && (
                            <button type="submit" disabled={savingMileage} className="inline-flex h-8 shrink-0 items-center justify-center border border-[#20221f] px-2.5 text-[10px] font-bold uppercase">
                              {savingMileage ? "..." : t("common.save")}
                            </button>
                          )}
                        </div>
                        {isServiceJob && (
                          <>
                            <input
                              type="number"
                              min="0"
                              step="1"
                              value={nextServiceMileageDraft}
                              onChange={(event) => setNextServiceMileageDraft(event.target.value)}
                              className={inputClass}
                              placeholder={t("bill.next_km")}
                            />
                            {canReminders && (
                              <input
                                type="date"
                                value={nextServiceDueDraft}
                                onChange={(event) => setNextServiceDueDraft(event.target.value)}
                                className={inputClass}
                                aria-label={t("bill.next_due")}
                              />
                            )}
                            <button type="submit" disabled={savingMileage} className="inline-flex h-8 items-center justify-center border border-[#20221f] px-3 text-[10px] font-bold uppercase">
                              {savingMileage ? "..." : t("common.save")}
                            </button>
                          </>
                        )}
                      </form>
                    )}
                  </div>
                </>
              ) : (
                <div className="bill-instant-kind sm:col-span-2">
                  <p className="text-[10px] font-bold uppercase text-[#6f746e]">
                    {isStore ? (bill.job_kind === "repair" ? t("bill.repair") : t("bill.sale")) : bill.job_kind === "parts_sale" ? t("bill.instant_bill") : t("common.type")}
                  </p>
                  <p className="mt-1 font-semibold">
                    {isStore
                      ? (bill.notes || (bill.job_kind === "repair" ? t("bill.repair_job") : t("bill.counter_sale")))
                      : (bill.job_kind === "parts_sale" ? t("bill.no_vehicle") : t(`terms.${profile.label}`))}
                  </p>
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
          </Panel>

          {canWarranty && usesVehicleJobs(profile.type) && !isGarageInstant && (
            <Panel className="no-print">
              <div className="border-b border-[#d7d3c8] px-5 py-3">
                <h2 className="font-display text-xl font-semibold uppercase">{t("warranty.job_title")}</h2>
                <p className="text-[11px] text-[#6f746e]">{t("warranty.job_hint")}</p>
              </div>
              <form onSubmit={saveJobWarranty} className="space-y-3 p-5">
                <WarrantyFields
                  key={`${bill.id}-${bill.warranty_months ?? ""}-${bill.warranty_until ?? ""}`}
                  purchaseDate={bill.admission_date}
                  months={bill.warranty_months}
                  startsOn={bill.warranty_starts_on}
                  until={bill.warranty_until}
                  hint={t("warranty.job_fields_hint")}
                />
                {!isLocked && (
                  <button type="submit" disabled={savingJobWarranty} className={buttonClass}>
                    {savingJobWarranty ? t("common.saving") : t("warranty.save")}
                  </button>
                )}
              </form>
            </Panel>
          )}

          {!isGarageInstant && (
          <Panel className="staff-only no-print">
            <div className="border-b border-[#d7d3c8] px-5 py-3">
              <h2 className="font-display text-xl font-semibold uppercase">{t("bill.staff_only")}</h2>
              <p className="text-[11px] text-[#6f746e]">
                {isClosed
                  ? t("bill.locked_notes")
                  : isGarage
                    ? t("bill.staff_garage")
                    : t("bill.staff_hidden")}
              </p>
            </div>
            <div className="grid gap-5 p-5 lg:grid-cols-2">
              <form onSubmit={saveInternalNotes} className="space-y-2">
                <label className="block text-[11px] font-bold uppercase">
                  {isGarage ? t("bill.additional_note") : t("bill.internal_note")}
                  <textarea
                    value={internalNotes}
                    onChange={(event) => setInternalNotes(event.target.value)}
                    rows={4}
                    disabled={isClosed}
                    className={`${inputClass} mt-2 disabled:opacity-60`}
                    placeholder={isGarage
                      ? t("bill.note_print_placeholder")
                      : t("bill.note_staff_placeholder")}
                  />
                </label>
                {isGarage && (
                  <div>
                    <p className="text-[10px] font-bold uppercase text-[#6f746e]">{t("bill.note_background")}</p>
                    <div className="mt-2 flex items-center gap-1.5">
                      {(["blue", "red"] as const).map((color) => (
                        <button
                          key={color}
                          type="button"
                          disabled={isClosed}
                          onClick={() => setNoteColor(color)}
                          aria-label={color === "red" ? t("common.maroon") : t("common.navy")}
                          aria-pressed={noteColor === color}
                          className={`size-7 border disabled:opacity-50 ${
                            color === "red" ? "bg-[#7a1c2e]" : "bg-[#1b365d]"
                          } ${noteColor === color ? "border-[#20221f] ring-2 ring-[#20221f] ring-offset-1" : "border-transparent"}`}
                        />
                      ))}
                    </div>
                  </div>
                )}
                {!isClosed && (
                  <button type="submit" disabled={savingNotes} className={buttonClass}>
                    {savingNotes ? t("common.saving") : t("bill.save_note")}
                  </button>
                )}
              </form>
              {canAssignEmployees && (
                <div className="space-y-2">
                  <p className="text-[11px] font-bold uppercase">{t("bill.assigned_employees")} <span className="font-normal text-[#6f746e]">{t("common.optional")}</span></p>
                  <EmployeePicker
                    employees={employeeOptions}
                    selectedIds={employeeIds}
                    onChange={(ids) => { void saveEmployees(ids); }}
                    disabled={savingEmployees || isClosed}
                  />
                  {savingEmployees && <p className="text-[11px] text-[#6f746e]">{t("common.saving")}</p>}
                </div>
              )}
              {canJobBoard && !isClosed && bill.job_kind !== "parts_sale" && (
                <label className="block text-[11px] font-bold uppercase">
                  {t("job_board.floor_status")}
                  <select
                    value={bill.floor_status || "waiting"}
                    disabled={savingFloor}
                    onChange={(event) => {
                      const floor_status = event.target.value;
                      setSavingFloor(true);
                      api<Bill>(`/bills/${id}/floor-status`, { method: "PUT", body: JSON.stringify({ floor_status }) })
                        .then((updated) => setBill(updated))
                        .catch((caught) => setError(caught instanceof Error ? caught.message : t("job_board.move_failed")))
                        .finally(() => setSavingFloor(false));
                    }}
                    className={`${inputClass} mt-2 font-normal normal-case`}
                  >
                    {["waiting", "diagnosis", "waiting_parts", "in_progress", "qc", "ready"].map((status) => (
                      <option key={status} value={status}>{t(`job_board.${status}`)}</option>
                    ))}
                  </select>
                </label>
              )}
            </div>
          </Panel>
          )}

          {error && <div className="no-print"><ErrorMessage message={error} /></div>}
          {smsNotice && (
            <div className="no-print border border-[#167c73]/20 bg-[#167c73]/10 px-4 py-3 text-sm text-[#167c73]">
              {smsNotice}
            </div>
          )}
          {canJobPhotos && isGarage && bill.job_kind !== "parts_sale" && (
            <JobPhotos billId={bill.id} readOnly={isClosed} />
          )}
          {canJobVideos && isGarage && bill.job_kind !== "parts_sale" && (
            <JobVideos billId={bill.id} readOnly={isClosed} />
          )}
          {isClosed && (
            <div className="no-print flex flex-wrap items-center gap-2 border border-[#20221f]/15 bg-[#20221f]/5 px-4 py-3 text-sm text-[#20221f]">
              <Lock size={16} />
              {t("bill.closed_banner", { kind: t(`terms.${profile.billingSingular}`).toLowerCase() })}
              {amountRefunded > 0 ? ` ${t("bill.refunded_amount", { amount: money(amountRefunded) })}` : ""}
              {" "}{t("bill.closed_actions")}
            </div>
          )}
          {isOweIn && (
            <div className="no-print flex items-center gap-2 border border-[#2b6cb0]/20 bg-[#2b6cb0]/8 px-4 py-3 text-sm text-[#2b6cb0]">
              <Lock size={16} />
              {bill.owe_in_due_date
                ? t("bill.owe_until", { kind: t(`terms.${profile.billingSingular}`).toLowerCase(), date: formatDate(bill.owe_in_due_date) })
                : `${t("bill.owe_banner", { kind: t(`terms.${profile.billingSingular}`).toLowerCase() })} ${t("bill.owe_items_locked")}`}
            </div>
          )}

          <Panel>
            <div className="bill-section-head border-b border-[#d7d3c8] px-5 py-4">
              <h2 className="font-display text-2xl font-semibold uppercase">{t("bill.bill_items")}</h2>
            </div>
            <div className="bill-items-scroll print:overflow-visible">
              <table className="bill-items-table w-full min-w-[36rem] text-left text-sm print:min-w-0">
                <colgroup>
                  <col className="bill-col-desc w-[36%]" />
                  <col className="bill-col-type w-[14%]" />
                  <col className="bill-col-qty w-[10%]" />
                  <col className="bill-col-rate w-[18%]" />
                  <col className="bill-col-total w-[18%]" />
                  {!isLocked && <col className="no-print w-10" />}
                </colgroup>
                <thead className="bg-[#eeece5] text-[10px] uppercase text-[#6f746e]">
                  <tr>
                    <th className="bill-col-desc px-4 py-3">{t("common.description")}</th>
                    <th className="bill-col-type px-3 py-3">{t("common.type")}</th>
                    <th className="bill-col-qty px-3 py-3 text-right">{t("common.qty")}</th>
                    <th className="bill-col-rate px-3 py-3 text-right">{t("bill.rate")}</th>
                    <th className="bill-col-total px-4 py-3 text-right">{t("common.total")}</th>
                    {!isLocked && <th className="no-print px-2 py-3" />}
                  </tr>
                </thead>
                <tbody>
                  {chargeGroups.map((row) => {
                    if (row.kind === "group") {
                      const open = Boolean(expandedPanels[row.groupId]);
                      return (
                        <Fragment key={row.groupId}>
                          <tr className="border-t border-[#e2ded4] align-top">
                            <td className="bill-col-desc px-4 py-3 break-words">
                              <button
                                type="button"
                                onClick={() => setExpandedPanels((current) => ({ ...current, [row.groupId]: !open }))}
                                className="no-print mr-1 inline-flex align-middle text-[#6f746e]"
                                aria-expanded={open}
                                aria-label={open ? t("bill.hide_details", { name: row.name }) : t("bill.show_details", { name: row.name })}
                              >
                                <ChevronDown size={16} className={`transition ${open ? "" : "-rotate-90"}`} />
                              </button>
                              <span className="font-semibold">{row.name}</span>
                            </td>
                            <td className="bill-col-type px-3 py-3 whitespace-nowrap text-[#6f746e]">{t("bill.panel")}</td>
                            <td className="bill-col-qty px-3 py-3 whitespace-nowrap text-right tabular-nums">—</td>
                            <td className="bill-col-rate px-3 py-3 whitespace-nowrap text-right tabular-nums">—</td>
                            <td className="bill-col-total px-4 py-3 whitespace-nowrap text-right tabular-nums">
                              <span className={hidePrintMoney ? "print:hidden" : ""}>{money(row.total)}</span>
                              {hidePrintMoney && <span className="hidden print:inline">—</span>}
                            </td>
                            {!isLocked && (
                              <td className="no-print px-2 py-3">
                                <button onClick={() => remove(row.items[0].id)} className="text-[#b84837]" title={t("bill.remove_panel")}>
                                  <Trash2 size={16} />
                                </button>
                              </td>
                            )}
                          </tr>
                          {row.items.map((item) => (
                            <ChargeItemRow
                              key={item.id}
                              item={item}
                              profile={profile}
                              isLocked={isLocked}
                              savingLaborHours={savingLaborHours}
                              onSaveHours={saveLaborHours}
                              onRemove={remove}
                              canWarranty={canWarranty}
                              onEditWarranty={setWarrantyItem}
                              hideOnPrint
                              hideAmountsOnPrint={hidePrintMoney}
                              nested
                              visible={open}
                            />
                          ))}
                        </Fragment>
                      );
                    }
                    return (
                      <ChargeItemRow
                        key={row.item.id}
                        item={row.item}
                        profile={profile}
                        isLocked={isLocked}
                        savingLaborHours={savingLaborHours}
                        onSaveHours={saveLaborHours}
                        onRemove={remove}
                        canWarranty={canWarranty}
                        onEditWarranty={setWarrantyItem}
                        hideAmountsOnPrint={hidePrintMoney}
                      />
                    );
                  })}
                </tbody>
                {discountItems.length > 0 && (
                  <tbody>
                    <tr className="bill-discount-row border-t-2 border-[#167c73]/35 bg-[#e7f4f2]">
                      <td colSpan={5} className="px-4 py-2 text-[10px] font-bold uppercase tracking-wide text-[#167c73]">
                        {t("common.discount")}
                      </td>
                      {!isLocked && <td className="no-print" />}
                    </tr>
                    {discountItems.map((item) => (
                      <tr key={item.id} className="bill-discount-row border-t border-[#167c73]/20 bg-[#e7f4f2] align-top text-[#167c73]">
                        <td className="bill-col-desc px-4 py-3 font-semibold break-words">{item.description}</td>
                        <td className="bill-col-type px-3 py-3 whitespace-nowrap">
                          {billItemLabel(item.type, profile, t)}
                        </td>
                        <td className="bill-col-qty px-3 py-3 whitespace-nowrap text-right tabular-nums">
                          {Number(item.quantity) > 1 ? Number(item.quantity) : "—"}
                        </td>
                        <td className="bill-col-rate px-3 py-3 whitespace-nowrap text-right tabular-nums">
                          <span className={hidePrintMoney ? "print:hidden" : ""}>{money(item.unit_price)}</span>
                          {hidePrintMoney && <span className="hidden print:inline">—</span>}
                        </td>
                        <td className="bill-col-total px-4 py-3 whitespace-nowrap text-right font-semibold tabular-nums">
                          <span className={hidePrintMoney ? "print:hidden" : ""}>-{money(item.line_total)}</span>
                          {hidePrintMoney && <span className="hidden print:inline">—</span>}
                        </td>
                        {!isLocked && (
                          <td className="no-print px-2 py-3">
                            <button onClick={() => remove(item.id)} className="text-[#b84837]" title={t("bill.remove_item")}>
                              <Trash2 size={16} />
                            </button>
                          </td>
                        )}
                      </tr>
                    ))}
                  </tbody>
                )}
              </table>
              {billItems.length === 0 && <p className="p-8 text-center text-sm text-[#6f746e]">{t("bill.no_charges")}</p>}
            </div>
          </Panel>

          {bill.payments.length > 0 && (
            <Panel>
              <div className="bill-section-head border-b border-[#d7d3c8] px-5 py-4">
                <h2 className="font-display text-2xl font-semibold uppercase">{t("bill.payments")}</h2>
              </div>
              <div className="divide-y divide-[#e2ded4]">
                {bill.payments.map((payment) => (
                  <div key={payment.id} className="flex flex-wrap items-center gap-3 px-5 py-3 text-sm">
                    <div className="min-w-0 flex-1">
                      <span className="uppercase text-[#6f746e]">{t(`method.${payment.method}`)}</span>
                      {payment.method === "cheque" && (
                        <p className="mt-0.5 text-[11px] text-[#6f746e]">
                          {payment.cheque_number ? `#${payment.cheque_number}` : t("method.cheque")}
                          {payment.cheque_date ? ` · ${formatDate(payment.cheque_date)}` : ""}
                          {payment.cheque_status ? ` · ${t(`status.${payment.cheque_status}`)}` : ""}
                          {payment.reference ? ` · ${payment.reference}` : ""}
                        </p>
                      )}
                    </div>
                    <strong className="tabular-nums">{money(payment.amount)}</strong>
                    {!isLocked && payment.method === "cheque" && payment.cheque_status === "pending" && (
                      <>
                        <button
                          type="button"
                          disabled={clearingPaymentId === payment.id}
                          onClick={() => void clearCheque(payment.id)}
                          className="no-print text-[11px] font-bold uppercase text-[#167c73]"
                        >
                          {t("common.clear")}
                        </button>
                        <button
                          type="button"
                          disabled={clearingPaymentId === payment.id}
                          onClick={() => void bounceCheque(payment.id)}
                          className="no-print text-[11px] font-bold uppercase text-[#b84837]"
                        >
                          {t("bill.bounce")}
                        </button>
                      </>
                    )}
                    {!isLocked && (
                      <button
                        type="button"
                        onClick={() => removePayment(payment.id)}
                        className="no-print text-[#b84837]"
                        title={t("bill.remove_payment")}
                      >
                        <Trash2 size={16} />
                      </button>
                    )}
                  </div>
                ))}
              </div>
            </Panel>
          )}

          {(bill.refunds?.length ?? 0) > 0 && (
            <Panel className="no-print">
              <div className="bill-section-head border-b border-[#d7d3c8] px-5 py-4">
                <h2 className="font-display text-2xl font-semibold uppercase">{t("bill.refunds")}</h2>
              </div>
              <div className="divide-y divide-[#e2ded4]">
                {(bill.refunds ?? []).map((refund) => (
                  <div key={refund.id} className="space-y-2 px-5 py-3 text-sm">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="font-semibold text-[#b84837]">{money(refund.amount)}</span>
                      <span className="uppercase text-[#6f746e]">{t(`method.${refund.method}`)}</span>
                      <span className="text-[#6f746e]">{formatDate(refund.refunded_at)}</span>
                    </div>
                    <p className="text-[#4f544e]">{refund.reason}</p>
                    <ul className="space-y-1 text-[12px] text-[#6f746e]">
                      {(refund.items ?? []).map((item) => (
                        <li key={item.id}>
                          {item.bill_item?.description ?? t("bill.item_n", { id: item.bill_item_id })}
                          {" · "}
                          {t("bill.qty_short", { qty: item.quantity })}
                          {" · "}
                          {money(item.amount)}
                          {item.disposition === "restock"
                            ? ` · ${t("bill.returned_stock")}`
                            : item.disposition === "write_off"
                              ? ` · ${t("bill.written_off")}`
                              : ""}
                        </li>
                      ))}
                    </ul>
                  </div>
                ))}
              </div>
            </Panel>
          )}
        </div>

        <div className={`space-y-5 print:mt-2 ${!isClosed && floorPane !== "pay" ? "hidden" : "block"} xl:block`}>
          {!isClosed && (
          <Panel className="no-print xl:sticky xl:top-4">
            {!isOweIn && (
            <>
            <div className="hidden grid-cols-2 border-b border-[#d7d3c8] xl:grid">
              <button onClick={() => setMode("item")} className={`h-8 text-[11px] font-semibold ${mode === "item" ? "bg-[#20221f] text-white" : ""}`}>
                <Plus className="inline" size={16} /> {t("bill.add_item")}
              </button>
              <button onClick={() => setMode("payment")} className={`h-8 text-[11px] font-semibold ${mode === "payment" ? "bg-[#167c73] text-white" : ""}`}>
                <CreditCard className="inline" size={16} /> {t("bill.payment")}
              </button>
            </div>
            {mode === "payment" && (
              <div className="flex h-11 items-center justify-center gap-2 bg-[#167c73] text-sm font-semibold text-white xl:hidden">
                <CreditCard size={16} />
                {t("bill.payment")}
              </div>
            )}
            </>
            )}
            {isOweIn && (
              <div className="border-b border-[#d7d3c8] px-5 py-3">
                <p className="text-xs font-bold uppercase text-[#2b6cb0]">{t("bill.record_payment")}</p>
              </div>
            )}

            {mode === "item" && !isOweIn ? (
              isServiceJob && serviceAddMode === "services" ? (
                <div className="flex max-h-[min(78vh,46rem)] flex-col">
                  <div className="space-y-3 overflow-y-auto p-4">
                    <ServiceAddModeToggle
                      mode={serviceAddMode}
                      onChange={switchServiceAddMode}
                      paint={isPaint}
                    />
                    <label className="block text-xs font-bold uppercase">
                      {t("common.quantity")}
                      <input
                        type="number"
                        min="1"
                        step="1"
                        value={addonQty}
                        onChange={(event) => setAddonQty(event.target.value)}
                        className={`${inputClass} mt-2`}
                      />
                    </label>
                    <p className="text-xs font-bold uppercase">{isPaint ? t("bill.packages") : t("bill.services")}</p>
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
                              {busy ? t("bill.adding") : money(addon.price)}
                            </span>
                          </button>
                        );
                      })}
                    </div>
                    {addons.length === 0 && (
                      <p className="text-sm text-[#6f746e]">
                        {isPaint
                          ? t("bill.no_packages")
                          : t("bill.no_services")}
                      </p>
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
                    paint={isPaint}
                  />
                )}
                {isGarageInstant && <input type="hidden" name="type" value="part" />}
                {!isServiceJob && !isGarageInstant && (
                <div>
                  <p className="mb-2 text-xs font-bold uppercase">{t("common.type")}</p>
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
                          {t(`terms.${option.label}`)}
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
                    {(!isStore || bill?.job_kind === "repair") && !isGarageInstant ? (
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
                        <span className="text-[10px] font-bold uppercase">{t("bill.bought_outside")}</span>
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
                        <span className="text-[10px] font-bold uppercase">{t("bill.customer_supplied")}</span>
                      </label>
                    </div>
                    ) : null}

                    {useStockSearch ? (
                      <div key="stock-search" className="space-y-3">
                        <label className="block text-xs font-bold uppercase">
                          {t("bill.search_scan")}
                          <input
                            value={partQuery}
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
                            placeholder={t("bill.scan_placeholder")}
                            autoComplete="off"
                          />
                        </label>
                        <div className="max-h-44 overflow-y-auto border border-[#d7d3c8] bg-white">
                          {filteredParts.length === 0 ? (
                            <p className="p-3 text-sm text-[#6f746e]">{t("bill.no_matching_stock")}</p>
                          ) : (
                            filteredParts.map((part) => (
                              <button
                                type="button"
                                key={part.id}
                                onClick={() => {
                                  setSelectedPartId(String(part.id));
                                  setError("");
                                }}
                                className={`flex w-full items-center justify-between border-b border-[#eeeae1] px-3 py-2 text-left text-sm ${selectedPartId === String(part.id) ? "bg-[#167c73]/10" : "hover:bg-[#f7f5ef]"}`}
                              >
                                <span>
                                  <span className="font-semibold">{part.name}</span>
                                  {part.barcode && (
                                    <span className="mt-0.5 block text-[10px] text-[#6f746e]">{t("common.barcode", { code: part.barcode })}</span>
                                  )}
                                </span>
                                <span className="text-xs text-[#6f746e]">{formatStockQty(part.stock_qty, part.stock_unit, isPaint)} · {money(part.price)}</span>
                              </button>
                            ))
                          )}
                        </div>
                        {selectedPart && (
                          <p className="text-xs text-[#167c73]">
                            {t("common.selected", { name: selectedPart.name })}
                            {selectedPart.barcode ? ` · ${selectedPart.barcode}` : ""}
                          </p>
                        )}
                      </div>
                    ) : outsidePart ? (
                      <div key="outside-part" className="space-y-3">
                        <label className="block text-xs font-bold uppercase">
                          {t("bill.part_description")}
                          <input name="description" required className={`${inputClass} mt-2`} placeholder={t("bill.outside_placeholder")} />
                        </label>
                        <div className="grid grid-cols-2 gap-3">
                          <label className="block text-xs font-bold uppercase">
                            {t("bill.selling_price")}
                            <input name="unit_price" type="number" min="0" step="0.01" required className={`${inputClass} mt-2`} />
                          </label>
                          <label className="block text-xs font-bold uppercase">
                            {t("bill.purchase_cost")}
                            <input name="purchase_unit_cost" type="number" min="0" step="0.01" required className={`${inputClass} mt-2`} />
                          </label>
                        </div>
                        <p className="text-[11px] text-[#6f746e]">
                          {t("bill.purchase_hint")}
                        </p>
                      </div>
                    ) : (
                      <div key="customer-part">
                        <label className="block text-xs font-bold uppercase">
                          {t("bill.part_description")}
                          <input name="description" required className={`${inputClass} mt-2`} placeholder={t("bill.customer_part_placeholder")} />
                        </label>
                      </div>
                    )}
                  </>
                ) : isPanelComposer ? (
                  <>
                    <p className="text-[11px] text-[#6f746e]">{t("bill.panel_hint")}</p>
                    <label className="block text-xs font-bold uppercase">
                      Panel
                      <select
                        value={panelCustom ? "__custom__" : panelName}
                        onChange={(event) => {
                          const value = event.target.value;
                          if (value === "__custom__") {
                            setPanelCustom(true);
                            setPanelName("");
                          } else {
                            setPanelCustom(false);
                            setPanelName(value);
                          }
                        }}
                        required={!panelCustom}
                        className={`${inputClass} mt-2`}
                      >
                        <option value="">{t("bill.select_panel")}</option>
                        {PAINT_PANEL_NAMES.map((name) => (
                          <option key={name} value={name}>{t(`panels.${name}`)}</option>
                        ))}
                        <option value="__custom__">{t("bill.other_panel")}</option>
                      </select>
                    </label>
                    {panelCustom && (
                      <label className="block text-xs font-bold uppercase">
                        {t("bill.panel_name")}
                        <input
                          name="panel_name"
                          required
                          className={`${inputClass} mt-2`}
                          placeholder={t("bill.panel_placeholder")}
                        />
                      </label>
                    )}
                    <div className="space-y-2 border-t border-[#e2ded4] pt-3">
                      <p className="text-xs font-bold uppercase">{t("bill.labor")}</p>
                      <LaborCatalogPicker
                        categories={laborCategories}
                        selectedId=""
                        placeholder={t("bill.search_labor_paint")}
                        onSelect={(item) => {
                          if (item) addComposerLabor(item);
                        }}
                      />
                      {composerLabor.map((row) => (
                        <div key={row.key} className="border border-[#d7d3c8] bg-[#fbfaf6] p-2.5">
                          <div className="flex items-start justify-between gap-2">
                            <p className="min-w-0 text-sm font-semibold">{row.name}</p>
                            <button
                              type="button"
                              onClick={() => setComposerLabor((current) => current.filter((entry) => entry.key !== row.key))}
                              className="text-[#b84837]"
                              aria-label={t("picker.remove_name", { name: row.name })}
                            >
                              <Trash2 size={14} />
                            </button>
                          </div>
                          <div className="mt-2 grid grid-cols-[1fr_auto] items-end gap-2">
                            <label className="text-[10px] font-bold uppercase">
                              {t("common.hours")}
                              <input
                                type="number"
                                min="0.01"
                                step="0.01"
                                required
                                value={row.hours}
                                onChange={(event) => setComposerLabor((current) => current.map((entry) => entry.key === row.key ? { ...entry, hours: event.target.value } : entry))}
                                className={`${inputClass} mt-1`}
                              />
                            </label>
                            <p className="pb-2 text-right text-sm font-semibold tabular-nums">
                              {money(Number(row.hours || 0) * row.rate)}
                            </p>
                          </div>
                          <p className="mt-1 text-[10px] text-[#6f746e]">{t("common.per_hour", { amount: money(row.rate) })}</p>
                        </div>
                      ))}
                    </div>
                    <div className="space-y-2 border-t border-[#e2ded4] pt-3">
                      <p className="text-xs font-bold uppercase">{t("bill.materials")}</p>
                      <p className="text-[11px] text-[#6f746e]">{t("bill.materials_hint")}</p>
                      {composerMaterials.map((row) => (
                        <div key={row.key} className="border border-[#d7d3c8] bg-[#fbfaf6] p-2.5">
                          <div className="flex items-start justify-between gap-2">
                            <p className="min-w-0 text-sm font-semibold">{row.name}</p>
                            <button
                              type="button"
                              onClick={() => setComposerMaterials((current) => current.filter((entry) => entry.key !== row.key))}
                              className="text-[#b84837]"
                              aria-label={t("picker.remove_name", { name: row.name })}
                            >
                              <Trash2 size={14} />
                            </button>
                          </div>
                          <div className="mt-2 grid grid-cols-[1fr_auto] items-end gap-2">
                            <label className="text-[10px] font-bold uppercase">
                              {t("common.ml")}
                              <input
                                type="number"
                                min="1"
                                step="1"
                                required
                                value={row.qty}
                                onChange={(event) => setComposerMaterials((current) => current.map((entry) => entry.key === row.key ? { ...entry, qty: event.target.value } : entry))}
                                className={`${inputClass} mt-1`}
                                placeholder={t("bill.ml_placeholder")}
                              />
                            </label>
                            <p className="pb-2 text-right text-sm font-semibold tabular-nums">
                              {money(Number(row.qty || 0) * row.unitPrice)}
                            </p>
                          </div>
                          <p className="mt-1 text-[10px] text-[#6f746e]">{t("bill.ml_in_stock", { qty: row.stock, price: money(row.unitPrice) })}</p>
                        </div>
                      ))}
                      <label className="block text-xs font-bold uppercase">
                        {t("bill.add_material")}
                        <input
                          value={mixQuery}
                          onChange={(event) => setMixQuery(event.target.value)}
                          className={`${inputClass} mt-2`}
                          placeholder={t("bill.search_materials")}
                          autoComplete="off"
                        />
                      </label>
                      {(mixQuery.trim() || composerMaterials.length === 0) && mixMatches.length > 0 && (
                        <div className="max-h-40 overflow-y-auto border border-[#d7d3c8] bg-white">
                          {mixMatches.map((part) => (
                            <button
                              type="button"
                              key={part.id}
                              onClick={() => addComposerMaterial(part)}
                              className="flex w-full items-center justify-between border-b border-[#eeeae1] px-3 py-2 text-left text-sm hover:bg-[#f7f5ef]"
                            >
                              <span className="font-semibold">{part.name}</span>
                              <span className="text-xs text-[#6f746e]">{part.stock_qty} {t("common.ml")} · {money(part.price)}</span>
                            </button>
                          ))}
                        </div>
                      )}
                    </div>
                    <div className="border-t border-[#e2ded4] pt-2 text-sm">
                      <div className="flex justify-between text-[#6f746e]">
                        <span>{t("bill.labor")}</span>
                        <span className="tabular-nums">{money(composerLaborAmount)}</span>
                      </div>
                      <div className="flex justify-between text-[#6f746e]">
                        <span>{t("bill.materials")}</span>
                        <span className="tabular-nums">{money(composerMaterialAmount)}</span>
                      </div>
                      <div className="mt-1 flex justify-between font-semibold text-[#167c73]">
                        <span>{t("bill.panel_total")}</span>
                        <span className="tabular-nums">{money(panelTotal)}</span>
                      </div>
                    </div>
                  </>
                ) : isLaborType ? (
                  <>
                    <LaborCatalogPicker
                      categories={laborCategories}
                      selectedId={selectedLaborId}
                      placeholder={isPaint ? t("bill.search_labor_blend") : t("bill.search_labor")}
                      onSelect={(item) => {
                        setSelectedLaborId(item ? String(item.id) : "");
                        if (item) setLaborHours(String(Number(item.standard_hours)));
                      }}
                    />
                    {selectedLabor ? (
                      <>
                        <label className="block text-xs font-bold uppercase">
                          {t("common.hours")}
                          <input
                            type="number"
                            min="0.01"
                            step="0.01"
                            value={laborHours}
                            onChange={(event) => setLaborHours(event.target.value)}
                            required
                            className={`${inputClass} mt-2`}
                          />
                        </label>
                        <p className="text-sm text-[#167c73]">
                          {t("bill.amount_label", { amount: money(laborAmount) })}
                          <span className="ml-2 text-xs text-[#6f746e]">
                            {t("common.per_hour", { amount: money(selectedLabor.hourly_rate) })}
                          </span>
                        </p>
                      </>
                    ) : (
                      <>
                        <p className="text-[11px] text-[#6f746e]">
                          {t("bill.custom_labor")}
                        </p>
                        <label className="block text-xs font-bold uppercase">
                          {t("common.description")}
                          <input name="description" required className={`${inputClass} mt-2`} placeholder={isPaint ? t("bill.labor_placeholder_paint") : t("bill.labor_placeholder")} />
                        </label>
                        <div className="grid grid-cols-2 gap-3">
                          <label className="block text-xs font-bold uppercase">
                            {t("bill.hourly_rate")}
                            <input name="unit_price" type="number" min="0" step="0.01" required className={`${inputClass} mt-2`} />
                          </label>
                          <label className="block text-xs font-bold uppercase">
                            {t("common.hours")}
                            <input
                              type="number"
                              min="0.01"
                              step="0.01"
                              value={laborHours}
                              onChange={(event) => setLaborHours(event.target.value)}
                              required
                              className={`${inputClass} mt-2`}
                            />
                          </label>
                        </div>
                      </>
                    )}
                  </>
                ) : (
                  <>
                    <label className="block text-xs font-bold uppercase">
                      {isStore && activeType === "labor" ? t("bill.repair_work") : t("common.description")}
                      <input
                        name="description"
                        required
                        className={`${inputClass} mt-2`}
                        placeholder={isStore && activeType === "labor" ? t("bill.screen_placeholder") : undefined}
                      />
                    </label>
                    {showCost && (
                      <label className="block text-xs font-bold uppercase">
                        {isStore && activeType === "labor" ? t("common.amount") : t("common.cost")}
                        <input name="unit_price" type="number" min="0" step="0.01" required className={`${inputClass} mt-2`} />
                      </label>
                    )}
                    {showQuantity && !(isStore && activeType === "labor") && (
                      <label className="block text-xs font-bold uppercase">
                        {t("common.quantity")}
                        <input
                          name="quantity"
                          type="number"
                          min="1"
                          step={selectedType?.allowQty && !isStockType ? "0.01" : "1"}
                          value={itemQty}
                          onChange={(event) => setItemQty(event.target.value)}
                          required
                          className={`${inputClass} mt-2`}
                        />
                      </label>
                    )}
                  </>
                )}

                {isStockType && showQuantity && (selectedPartId || outsidePart || customerPart) && !(canSerial && selectedPart?.serialized && !outsidePart && !customerPart) && (
                  <label key={`qty-${outsidePart ? "outside" : customerPart ? "customer" : "stock"}`} className="block text-xs font-bold uppercase">
                    {isPaint ? t("bill.qty_ml") : selectedPart?.stock_unit && selectedPart.stock_unit !== "qty"
                      ? `${t("common.quantity")} (${stockUnitLabel(selectedPart.stock_unit)})`
                      : t("common.quantity")}
                    <input
                      name="quantity"
                      type="number"
                      min={selectedPart?.stock_unit && selectedPart.stock_unit !== "qty" ? "0.001" : "1"}
                      step={selectedPart?.stock_unit && selectedPart.stock_unit !== "qty" ? "0.001" : "1"}
                      value={itemQty}
                      onChange={(event) => setItemQty(event.target.value)}
                      required
                      className={`${inputClass} mt-2`}
                    />
                  </label>
                )}
                {isStockType && canSerial && selectedPart?.serialized && !outsidePart && !customerPart && (
                  <label className="block text-xs font-bold uppercase">
                    {t("serials.enter_imeis")}
                    <textarea
                      value={itemSerials}
                      onChange={(event) => setItemSerials(event.target.value)}
                      rows={3}
                      required
                      className={`${inputClass} mt-2`}
                      placeholder="356938035643809"
                    />
                  </label>
                )}
                {canWarranty && !isGarageInstant && !isPanelComposer && activeType !== "discount" && (
                  <WarrantyFields
                    purchaseDate={bill?.admission_date}
                    hint={usesVehicleJobs(profile.type)
                      ? t("warranty.line_hint_job")
                      : t("warranty.line_hint_sale")}
                  />
                )}
                </div>

                <div className="shrink-0 border-t border-[#d7d3c8] bg-white p-4">
                  <button disabled={addingPanel} className={`${buttonClass} w-full`}>
                    <Plus size={17} />{addingPanel ? t("bill.adding") : isPanelComposer ? t("bill.add_panel") : t("bill.add_to_bill")}
                  </button>
                </div>
              </form>
              )
            ) : (
              <form onSubmit={addPayment} className="space-y-4 p-5">
                <label className="block text-xs font-bold uppercase">
                  {t("common.amount")}
                  <input name="amount" type="number" min="0.01" step="0.01" required className={`${inputClass} mt-2`} />
                </label>
                <label className="block text-xs font-bold uppercase">
                  {t("common.method")}
                  <select
                    name="method"
                    value={paymentMethod}
                    onChange={(event) => setPaymentMethod(event.target.value)}
                    className={`${inputClass} mt-2`}
                  >
                    <option value="cash">{t("method.cash")}</option>
                    <option value="card">{t("method.card")}</option>
                    <option value="bank_transfer">{t("method.bank_transfer")}</option>
                    <option value="cheque">{t("method.cheque")}</option>
                    <option value="other">{t("method.other")}</option>
                  </select>
                </label>
                {paymentMethod === "cheque" ? (
                  <>
                    <label className="block text-xs font-bold uppercase">
                      {t("bill.cheque_date")}
                      <input
                        name="cheque_date"
                        type="date"
                        required
                        defaultValue={new Date().toISOString().slice(0, 10)}
                        className={`${inputClass} mt-2`}
                      />
                    </label>
                    <label className="block text-xs font-bold uppercase">
                      {t("bill.cheque_number")}
                      <input name="cheque_number" required className={`${inputClass} mt-2`} placeholder={t("bill.cheque_no")} />
                    </label>
                    <label className="block text-xs font-bold uppercase">
                      {t("bill.details_bank")}
                      <input name="reference" className={`${inputClass} mt-2`} placeholder={t("bill.bank_note")} />
                    </label>
                    <p className="text-[11px] text-[#6f746e]">
                      {t("bill.cheque_hint")}
                    </p>
                  </>
                ) : (
                  <label className="block text-xs font-bold uppercase">
                    {t("bill.reference")}
                    <input name="reference" className={`${inputClass} mt-2`} />
                  </label>
                )}
                <button className={`${buttonClass} w-full bg-[#167c73]`}>
                  <CreditCard size={17} />{t("bill.record_pay")}
                </button>
              </form>
            )}
          </Panel>
          )}

          <Panel className="bill-summary p-5">
            <p className="text-xs font-bold uppercase text-[#6f746e]">{t("bill.summary")}</p>
            {hidePrintMoney && (
              <p className="mt-3 hidden text-sm text-[#6f746e] print:block">{t("bill.work_list")}</p>
            )}
            <div className={`mt-5 space-y-3 text-sm ${hidePrintMoney ? "print:hidden" : ""}`}>
              <div className="flex justify-between gap-6"><span>{t("bill.charges")}</span><strong className="tabular-nums">{money(bill.subtotal)}</strong></div>
              <div className={`flex justify-between gap-6 ${Number(bill.total_deductions) > 0 ? "rounded-sm bg-[#e7f4f2] px-2 py-1.5 text-[#167c73]" : ""}`}>
                <span>{t("bill.deductions")}</span>
                <strong className="tabular-nums">- {money(bill.total_deductions)}</strong>
              </div>
              {Number(bill.vat_amount) > 0 && (
                <div className="flex justify-between gap-6"><span>{t("bill.vat")} {bill.vat_rate ? `(${bill.vat_rate}%)` : ""}</span><strong className="tabular-nums">{money(bill.vat_amount ?? 0)}</strong></div>
              )}
              {Number(bill.sscl_amount) > 0 && (
                <div className="flex justify-between gap-6"><span>{t("bill.sscl")} {bill.sscl_rate ? `(${bill.sscl_rate}%)` : ""}</span><strong className="tabular-nums">{money(bill.sscl_amount ?? 0)}</strong></div>
              )}
              <div className="flex justify-between gap-6"><span>{t("common.paid")}</span><strong className="tabular-nums">- {money(bill.amount_paid)}</strong></div>
              <div className="flex justify-between gap-6 border-t border-[#e2ded4] pt-3">
                <span>{t("common.due")}</span>
                <strong className={`tabular-nums ${Number(bill.balance_due) > 0 ? "text-[#b84837]" : ""}`}>
                  {money(bill.balance_due)}
                </strong>
              </div>
              <div className="flex justify-between gap-6 border-t-2 border-[#20221f] pt-4 text-sm uppercase">
                <span>{t("common.balance")}</span>
                <strong className={`tabular-nums ${Number(bill.customer_balance ?? 0) > 0 ? "text-[#167c73]" : ""}`}>
                  {money(bill.customer_balance ?? 0)}
                </strong>
              </div>
            </div>
          </Panel>
          {isGarage && internalNotes.trim() && (
            <div className={`bill-additional-note px-5 py-4 text-sm ${noteColor === "red" ? "bg-[#7a1c2e]/20 text-[#7a1c2e]" : "bg-[#1b365d]/20 text-[#1b365d]"}`}>
              <p className="text-[10px] font-bold uppercase tracking-wide opacity-80">{t("bill.additional_note")}</p>
              <p className="mt-2 whitespace-pre-wrap">{internalNotes}</p>
            </div>
          )}
        </div>
      </div>
      </div>
      {!isClosed && Number(bill.balance_due) > 0 && (
        <div className="no-print sticky bottom-3 z-20 mt-2 xl:hidden">
          <button type="button" onClick={() => { setFloorPane("pay"); setMode("payment"); }} className={`${buttonClass} h-12 w-full text-sm`}>
            Pay {money(bill.balance_due)}
          </button>
        </div>
      )}
    </AppShell>
  );
}

function ChargeItemRow({
  item,
  profile,
  isLocked,
  savingLaborHours,
  onSaveHours,
  onRemove,
  canWarranty = false,
  onEditWarranty,
  hideOnPrint = false,
  hideAmountsOnPrint = false,
  nested = false,
  visible = true,
}: {
  item: {
    id: number;
    type: string;
    description: string;
    included_services?: string[] | null;
    quantity: string;
    unit_price: string;
    line_total: string;
    part?: { stock_unit?: string | null } | null;
    warranty_months?: number | null;
    warranty_starts_on?: string | null;
    warranty_until?: string | null;
  };
  profile: ReturnType<typeof profileFor>;
  isLocked: boolean;
  savingLaborHours: number | null;
  onSaveHours: (itemId: number, hours: string) => void;
  onRemove: (itemId: number) => void;
  canWarranty?: boolean;
  onEditWarranty?: (item: {
    id: number;
    type: string;
    description: string;
    included_services?: string[] | null;
    quantity: string;
    unit_price: string;
    line_total: string;
    warranty_months?: number | null;
    warranty_starts_on?: string | null;
    warranty_until?: string | null;
  }) => void;
  hideOnPrint?: boolean;
  hideAmountsOnPrint?: boolean;
  nested?: boolean;
  visible?: boolean;
}) {
  const t = useT();
  const fromCustomer = item.type === "customer_part";
  const isLaborLine = item.type === "labor";
  const isPartLine = item.type === "part" || fromCustomer;
  const showQty = isPartLine || Number(item.quantity) > 1;
  const hidden = nested && !visible;

  return (
    <tr className={`border-t border-[#e2ded4] align-top ${hideOnPrint ? "no-print" : ""} ${hidden ? "hidden" : ""}`}>
      <td className={`bill-col-desc px-4 py-3 break-words ${nested ? "pl-8" : ""}`}>
        <BillItemDescription item={item} />
      </td>
      <td className="bill-col-type px-3 py-3 whitespace-nowrap text-[#6f746e]">
        {billItemLabel(item.type, profile, t)}
      </td>
      <td className="bill-col-qty px-3 py-3 whitespace-nowrap text-right tabular-nums">
        {isLaborLine ? (
          <>
            {!isLocked ? (
              <span className="no-print inline-flex items-center justify-end gap-1">
                <input
                  key={`${item.id}-${item.quantity}`}
                  type="number"
                  min="0.01"
                  step="0.01"
                  defaultValue={Number(item.quantity)}
                  disabled={savingLaborHours === item.id}
                  onBlur={(event) => {
                    if (event.target.value !== String(Number(item.quantity))) {
                      void onSaveHours(item.id, event.target.value);
                    }
                  }}
                  className="h-8 w-[4.5rem] border border-[#c9c5b9] bg-white px-1.5 text-right text-[13px] tabular-nums"
                  aria-label={t("bill.labor_hours")}
                />
                <span className="text-[11px] text-[#6f746e]">{t("common.h")}</span>
              </span>
            ) : (
              <span className="no-print">{Number(item.quantity)} {t("common.h")}</span>
            )}
            <span className="hidden print:inline">—</span>
          </>
        ) : showQty ? (
          <>
            {Number(item.quantity)}
            {item.part?.stock_unit && item.part.stock_unit !== "qty" ? ` ${stockUnitLabel(item.part.stock_unit, profile.type === "paint")}` : ""}
          </>
        ) : "—"}
      </td>
      <td className="bill-col-rate px-3 py-3 whitespace-nowrap text-right">
        {fromCustomer ? (
          <span className="font-semibold text-[#167c73]">—</span>
        ) : isLaborLine ? (
          <>
            <span className="no-print tabular-nums">{t("common.per_hour", { amount: money(item.unit_price) })}</span>
            <span className="hidden print:inline">—</span>
          </>
        ) : (
          <>
            <span className={`tabular-nums ${hideAmountsOnPrint ? "print:hidden" : ""}`}>{money(item.unit_price)}</span>
            {hideAmountsOnPrint && <span className="hidden print:inline">—</span>}
          </>
        )}
      </td>
      <td className="bill-col-total px-4 py-3 whitespace-nowrap text-right">
        {fromCustomer ? (
          <span className="inline-block max-w-full font-semibold leading-snug text-[#167c73]">
            {t("bill.received_customer")}
          </span>
        ) : (
          <>
            <span className={`tabular-nums ${hideAmountsOnPrint ? "print:hidden" : ""}`}>{money(item.line_total)}</span>
            {hideAmountsOnPrint && <span className="hidden print:inline">—</span>}
          </>
        )}
      </td>
      {!isLocked && (
        <td className="no-print px-2 py-3">
          {nested ? null : (
            <div className="flex items-center justify-end gap-1">
              {canWarranty && item.type !== "discount" && (
                <button type="button" onClick={() => onEditWarranty?.(item)} className="text-[#167c73]" title={item.warranty_until ? t("warranty.edit") : t("warranty.add")}>
                  <ShieldCheck size={16} />
                </button>
              )}
              <button type="button" onClick={() => onRemove(item.id)} className="text-[#b84837]" title={t("bill.remove_item")}>
                <Trash2 size={16} />
              </button>
            </div>
          )}
        </td>
      )}
    </tr>
  );
}

function BillItemDescription({ item }: { item: { description: string; included_services?: string[] | null; warranty_months?: number | null; warranty_starts_on?: string | null; warranty_until?: string | null } }) {
  const t = useT();
  const { title, inclusions } = billLinePresentation(item);
  const warranty = warrantyLabel(item.warranty_months, item.warranty_until, item.warranty_starts_on, t);
  return (
    <>
      <p className="font-semibold">{title}</p>
      {warranty && <p className="mt-1 text-[11px] font-semibold uppercase text-[#167c73] print:text-[#20221f]">{warranty}</p>}
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
  paint = false,
}: {
  mode: "services" | "inventory" | "discount";
  onChange: (mode: "services" | "inventory" | "discount") => void;
  paint?: boolean;
}) {
  const t = useT();
  const options: Array<["services" | "inventory" | "discount", string]> = [
    ["services", paint ? t("bill.packages") : t("bill.services")],
    ...(paint ? [] : [["inventory", t("bill.inventory")] as ["inventory", string]]),
    ["discount", t("common.discount")],
  ];

  return (
    <div>
      <p className="mb-2 text-xs font-bold uppercase">{t("bill.add")}</p>
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
