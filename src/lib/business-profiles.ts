import type { FeatureKey, BusinessType } from "@/lib/api";
import {
  BedDouble,
  Boxes,
  CalendarDays,
  Camera,
  ClipboardList,
  Contact,
  Fingerprint,
  Gauge,
  Package,
  ReceiptText,
  ShieldCheck,
  ShoppingBag,
  Users,
  ChartNoAxesCombined,
  PieChart,
  Clock,
  Target,
  Truck,
  UserRound,
  type LucideIcon,
} from "lucide-react";

export type NavItem = {
  href: string;
  label: string;
  icon: LucideIcon;
  feature?: FeatureKey;
  owner?: boolean;
  staffSelf?: boolean;
};

export type BillItemTypeOption = {
  value: string;
  label: string;
  kind: "charge" | "stock" | "discount";
  allowQty?: boolean;
};

export type BusinessProfile = {
  type: BusinessType;
  label: string;
  operationsLabel: string;
  billingLabel: string;
  billingSingular: string;
  openBillsLabel: string;
  recentBillsTitle: string;
  recentBillsHint: string;
  primaryCta: { href: string; label: string; feature: FeatureKey };
  quickActions: Array<{ href: string; label: string; feature: FeatureKey }>;
  defaultFeatures: FeatureKey[];
  moduleCatalog: Array<{ key: FeatureKey; name: string; group: string }>;
  navigation: NavItem[];
  billItemTypes: BillItemTypeOption[];
};

const sharedPeopleFinance: Array<{ key: FeatureKey; name: string; group: string }> = [
  { key: "customers", name: "Customers", group: "Service Intake" },
  { key: "billing", name: "Billing", group: "Service Intake" },
  { key: "bill_sms", name: "Bill SMS", group: "Service Intake" },
  { key: "bill_profits", name: "Bill Profits Analysis", group: "Service Intake" },
  { key: "employees_management", name: "Team", group: "People" },
  { key: "attendance", name: "Attendance", group: "People" },
  { key: "payroll", name: "Payroll", group: "People" },
  { key: "balance_sheet", name: "Finance", group: "Finance" },
  { key: "reports", name: "Reports", group: "Finance" },
];

const billProfitsNav: NavItem = { href: "/bill-profits", label: "Bill profits", icon: PieChart, feature: "bill_profits" };

const sharedNavTail: NavItem[] = [
  { href: "/customers", label: "Customers", icon: Contact, feature: "customers" },
  { href: "/employees", label: "Team", icon: Users, feature: "employees_management" },
  { href: "/shifts", label: "Shifts", icon: Clock, feature: "employees_management", staffSelf: true },
  { href: "/leave", label: "Leave", icon: CalendarDays, feature: "employees_management", staffSelf: true },
  { href: "/attendance", label: "Attendance", icon: Fingerprint, feature: "attendance" },
  { href: "/payroll", label: "Payroll", icon: ChartNoAxesCombined, feature: "payroll" },
  { href: "/reports", label: "Reports", icon: ClipboardList, feature: "reports" },
  { href: "/balance-sheet", label: "Finance", icon: ChartNoAxesCombined, feature: "balance_sheet" },
  { href: "/profile", label: "Shop details", icon: UserRound, owner: true },
  { href: "/profile", label: "My details", icon: UserRound, staffSelf: true },
  { href: "/staff", label: "Staff access", icon: ShieldCheck, owner: true },
];

const garmentPeopleNav: NavItem[] = [
  { href: "/customers", label: "Customers", icon: Contact, feature: "customers" },
  { href: "/employees", label: "Team", icon: Users, feature: "employees_management" },
  { href: "/shifts", label: "Shifts", icon: Clock, feature: "employees_management", staffSelf: true },
  { href: "/leave", label: "Leave", icon: CalendarDays, feature: "employees_management", staffSelf: true },
  { href: "/targets", label: "Targets", icon: Target, feature: "employees_management" },
  { href: "/attendance", label: "Attendance", icon: Fingerprint, feature: "attendance" },
  { href: "/payroll", label: "Payroll", icon: ChartNoAxesCombined, feature: "payroll" },
  { href: "/reports", label: "Reports", icon: ClipboardList, feature: "reports" },
  { href: "/balance-sheet", label: "Finance", icon: ChartNoAxesCombined, feature: "balance_sheet" },
  { href: "/profile", label: "Shop details", icon: UserRound, owner: true },
  { href: "/profile", label: "My details", icon: UserRound, staffSelf: true },
  { href: "/staff", label: "Staff access", icon: ShieldCheck, owner: true },
];

const suppliersNav: NavItem = { href: "/suppliers", label: "Suppliers", icon: Truck, feature: "suppliers" };

export const BUSINESS_PROFILES: Record<BusinessType, BusinessProfile> = {
  garage: {
    type: "garage",
    label: "Garages",
    operationsLabel: "Garage operations",
    billingLabel: "Job cards",
    billingSingular: "Job card",
    openBillsLabel: "Open job cards",
    recentBillsTitle: "Latest job cards",
    recentBillsHint: "Open bills and active work across the counter",
    primaryCta: { href: "/vehicles/admit", label: "Admit vehicle", feature: "admit_vehicle" },
    quickActions: [
      { href: "/vehicles/admit", label: "New admission", feature: "admit_vehicle" },
      { href: "/parts-pos", label: "Instant bill", feature: "billing" },
      { href: "/parts", label: "Find a part", feature: "parts_inventory" },
      { href: "/balance-sheet", label: "View finance", feature: "balance_sheet" },
    ],
    defaultFeatures: [
      "admit_vehicle", "parts_inventory", "suppliers", "customers", "billing", "bill_sms", "bill_profits",
      "employees_management", "attendance", "payroll", "balance_sheet", "reports",
    ],
    moduleCatalog: [
      { key: "admit_vehicle", name: "Admit vehicle", group: "Service Intake" },
      { key: "parts_inventory", name: "Parts inventory", group: "Inventory" },
      { key: "suppliers", name: "Suppliers", group: "Inventory" },
      ...sharedPeopleFinance.map((m) => m.key === "billing" ? { ...m, name: "Job cards" } : m),
    ],
    navigation: [
      { href: "/dashboard", label: "Overview", icon: Gauge },
      { href: "/vehicles/admit", label: "Admit vehicle", icon: ClipboardList, feature: "admit_vehicle" },
      { href: "/bills", label: "Job cards", icon: ReceiptText, feature: "billing" },
      { href: "/parts-pos", label: "Instant bill", icon: ShoppingBag, feature: "billing" },
      billProfitsNav,
      { href: "/parts", label: "Parts", icon: Boxes, feature: "parts_inventory" },
      suppliersNav,
      ...sharedNavTail,
    ],
    billItemTypes: [
      { value: "labor", label: "Labor", kind: "charge", allowQty: true },
      { value: "part", label: "Inventory", kind: "stock" },
      { value: "discount", label: "Discount", kind: "discount" },
    ],
  },
  paint: {
    type: "paint",
    label: "Paint shops",
    operationsLabel: "Paint operations",
    billingLabel: "Paint jobs",
    billingSingular: "Paint job",
    openBillsLabel: "Open paint jobs",
    recentBillsTitle: "Latest paint jobs",
    recentBillsHint: "Open jobs and colour work across the booth",
    primaryCta: { href: "/vehicles/admit", label: "Admit vehicle", feature: "admit_vehicle" },
    quickActions: [
      { href: "/vehicles/admit", label: "New admission", feature: "admit_vehicle" },
      { href: "/parts-pos", label: "Counter sale", feature: "billing" },
      { href: "/parts", label: "Find a colour", feature: "parts_inventory" },
      { href: "/balance-sheet", label: "View finance", feature: "balance_sheet" },
    ],
    defaultFeatures: [
      "admit_vehicle", "parts_inventory", "suppliers", "customers", "billing", "bill_sms", "bill_profits",
      "employees_management", "attendance", "payroll", "balance_sheet", "reports",
    ],
    moduleCatalog: [
      { key: "admit_vehicle", name: "Admit vehicle", group: "Service Intake" },
      { key: "parts_inventory", name: "Color stock", group: "Inventory" },
      { key: "suppliers", name: "Suppliers", group: "Inventory" },
      ...sharedPeopleFinance.map((m) => m.key === "billing" ? { ...m, name: "Paint jobs" } : m),
    ],
    navigation: [
      { href: "/dashboard", label: "Overview", icon: Gauge },
      { href: "/vehicles/admit", label: "Admit vehicle", icon: ClipboardList, feature: "admit_vehicle" },
      { href: "/bills", label: "Paint jobs", icon: ReceiptText, feature: "billing" },
      { href: "/parts-pos", label: "Counter sale", icon: ShoppingBag, feature: "billing" },
      billProfitsNav,
      { href: "/parts", label: "Color stock", icon: Boxes, feature: "parts_inventory" },
      suppliersNav,
      ...sharedNavTail,
    ],
    billItemTypes: [
      { value: "labor", label: "Panel", kind: "charge", allowQty: true },
      { value: "part", label: "Color", kind: "stock" },
      { value: "discount", label: "Discount", kind: "discount" },
    ],
  },
  photography: {
    type: "photography",
    label: "Studios",
    operationsLabel: "Studio operations",
    billingLabel: "Orders",
    billingSingular: "Order",
    openBillsLabel: "Open orders",
    recentBillsTitle: "Latest orders",
    recentBillsHint: "Session charges and client payments",
    primaryCta: { href: "/bookings/new", label: "New booking", feature: "photo_bookings" },
    quickActions: [
      { href: "/bookings/new", label: "New booking", feature: "photo_bookings" },
      { href: "/packages", label: "Packages", feature: "photo_packages" },
      { href: "/bills", label: "Take payment", feature: "billing" },
      { href: "/balance-sheet", label: "View finance", feature: "balance_sheet" },
    ],
    defaultFeatures: [
      "photo_bookings", "photo_packages", "customers", "billing", "bill_sms", "bill_profits",
      "employees_management", "attendance", "payroll", "balance_sheet", "reports",
    ],
    moduleCatalog: [
      { key: "photo_bookings", name: "Bookings", group: "Service Intake" },
      { key: "photo_packages", name: "Packages", group: "Service Intake" },
      ...sharedPeopleFinance.map((m) => m.key === "billing" ? { ...m, name: "Orders" } : m),
    ],
    navigation: [
      { href: "/dashboard", label: "Overview", icon: Gauge },
      { href: "/bookings", label: "Bookings", icon: CalendarDays, feature: "photo_bookings" },
      { href: "/packages", label: "Packages", icon: Camera, feature: "photo_packages" },
      { href: "/bills", label: "Orders", icon: ReceiptText, feature: "billing" },
      billProfitsNav,
      ...sharedNavTail,
    ],
    billItemTypes: [
      { value: "session", label: "Session / shoot", kind: "charge" },
      { value: "package", label: "Package", kind: "charge" },
      { value: "print", label: "Prints / products", kind: "charge", allowQty: true },
      { value: "addon", label: "Add-on", kind: "charge" },
      { value: "discount", label: "Discount", kind: "discount" },
    ],
  },
  clothing: {
    type: "clothing",
    label: "Garments",
    operationsLabel: "Garment operations",
    billingLabel: "Sales",
    billingSingular: "Sale",
    openBillsLabel: "Open sales",
    recentBillsTitle: "Latest sales",
    recentBillsHint: "Counter receipts and balances due",
    primaryCta: { href: "/pos", label: "New sale", feature: "retail_pos" },
    quickActions: [
      { href: "/pos", label: "New sale", feature: "retail_pos" },
      { href: "/catalog", label: "Catalog", feature: "product_catalog" },
      { href: "/bills", label: "Take payment", feature: "billing" },
      { href: "/balance-sheet", label: "View finance", feature: "balance_sheet" },
    ],
    defaultFeatures: [
      "retail_pos", "product_catalog", "suppliers", "customers", "billing", "bill_sms", "bill_profits",
      "employees_management", "attendance", "payroll", "balance_sheet", "reports",
    ],
    moduleCatalog: [
      { key: "retail_pos", name: "Point of sale", group: "Service Intake" },
      { key: "product_catalog", name: "Product catalog", group: "Inventory" },
      { key: "suppliers", name: "Suppliers", group: "Inventory" },
      ...sharedPeopleFinance.map((m) => m.key === "billing" ? { ...m, name: "Sales" } : m),
    ],
    navigation: [
      { href: "/dashboard", label: "Overview", icon: Gauge },
      { href: "/pos", label: "New sale", icon: ShoppingBag, feature: "retail_pos" },
      { href: "/catalog", label: "Catalog", icon: Package, feature: "product_catalog" },
      { href: "/bills", label: "Sales", icon: ReceiptText, feature: "billing" },
      billProfitsNav,
      suppliersNav,
      ...garmentPeopleNav,
    ],
    billItemTypes: [
      { value: "product", label: "Garment item", kind: "charge", allowQty: true },
      { value: "alteration", label: "Alteration", kind: "charge" },
      { value: "charge", label: "Other charge", kind: "charge" },
      { value: "discount", label: "Discount", kind: "discount" },
    ],
  },
  cottage: {
    type: "cottage",
    label: "Cottages",
    operationsLabel: "Stay operations",
    billingLabel: "Stays billing",
    billingSingular: "Stay bill",
    openBillsLabel: "Open stay bills",
    recentBillsTitle: "Latest stay bills",
    recentBillsHint: "Room charges and guest payments",
    primaryCta: { href: "/stays/new", label: "New stay", feature: "cottage_stays" },
    quickActions: [
      { href: "/stays/new", label: "Check-in / book", feature: "cottage_stays" },
      { href: "/rooms", label: "Rooms", feature: "cottage_rooms" },
      { href: "/bills", label: "Take payment", feature: "billing" },
      { href: "/balance-sheet", label: "View finance", feature: "balance_sheet" },
    ],
    defaultFeatures: [
      "cottage_rooms", "cottage_stays", "customers", "billing", "bill_sms", "bill_profits",
      "employees_management", "attendance", "payroll", "balance_sheet", "reports",
    ],
    moduleCatalog: [
      { key: "cottage_stays", name: "Stays", group: "Service Intake" },
      { key: "cottage_rooms", name: "Rooms", group: "Inventory" },
      ...sharedPeopleFinance.map((m) => m.key === "billing" ? { ...m, name: "Stay billing" } : m),
    ],
    navigation: [
      { href: "/dashboard", label: "Overview", icon: Gauge },
      { href: "/stays", label: "Stays", icon: BedDouble, feature: "cottage_stays" },
      { href: "/rooms", label: "Rooms", icon: Package, feature: "cottage_rooms" },
      { href: "/bills", label: "Billing", icon: ReceiptText, feature: "billing" },
      billProfitsNav,
      ...sharedNavTail,
    ],
    billItemTypes: [
      { value: "room", label: "Room night", kind: "charge", allowQty: true },
      { value: "amenity", label: "Amenity / extras", kind: "charge" },
      { value: "meal", label: "Meals", kind: "charge", allowQty: true },
      { value: "discount", label: "Discount", kind: "discount" },
    ],
  },
  tyre: {
    type: "tyre",
    label: "Tyre shops",
    operationsLabel: "Tyre operations",
    billingLabel: "Job cards",
    billingSingular: "Job card",
    openBillsLabel: "Open job cards",
    recentBillsTitle: "Latest job cards",
    recentBillsHint: "Fitments, balancing, and open work",
    primaryCta: { href: "/vehicles/admit", label: "Admit vehicle", feature: "admit_vehicle" },
    quickActions: [
      { href: "/vehicles/admit", label: "New admission", feature: "admit_vehicle" },
      { href: "/parts-pos", label: "Instant bill", feature: "billing" },
      { href: "/parts", label: "Find a tyre", feature: "parts_inventory" },
      { href: "/balance-sheet", label: "View finance", feature: "balance_sheet" },
    ],
    defaultFeatures: [
      "admit_vehicle", "parts_inventory", "suppliers", "customers", "billing", "bill_sms", "bill_profits",
      "employees_management", "attendance", "payroll", "balance_sheet", "reports",
    ],
    moduleCatalog: [
      { key: "admit_vehicle", name: "Admit vehicle", group: "Service Intake" },
      { key: "parts_inventory", name: "Tyres / parts", group: "Inventory" },
      { key: "suppliers", name: "Suppliers", group: "Inventory" },
      ...sharedPeopleFinance.map((m) => m.key === "billing" ? { ...m, name: "Job cards" } : m),
    ],
    navigation: [
      { href: "/dashboard", label: "Overview", icon: Gauge },
      { href: "/vehicles/admit", label: "Admit vehicle", icon: ClipboardList, feature: "admit_vehicle" },
      { href: "/bills", label: "Job cards", icon: ReceiptText, feature: "billing" },
      { href: "/parts-pos", label: "Instant bill", icon: ShoppingBag, feature: "billing" },
      billProfitsNav,
      { href: "/parts", label: "Tyres", icon: Boxes, feature: "parts_inventory" },
      suppliersNav,
      ...sharedNavTail,
    ],
    billItemTypes: [
      { value: "labor", label: "Labor", kind: "charge" },
      { value: "part", label: "Tyre / part", kind: "stock" },
      { value: "discount", label: "Discount", kind: "discount" },
    ],
  },
  device_repair: {
    type: "device_repair",
    label: "Device repair",
    operationsLabel: "Repair operations",
    billingLabel: "Repair tickets",
    billingSingular: "Repair ticket",
    openBillsLabel: "Open tickets",
    recentBillsTitle: "Latest tickets",
    recentBillsHint: "Phones, appliances, and open repairs",
    primaryCta: { href: "/vehicles/admit", label: "Admit device", feature: "admit_vehicle" },
    quickActions: [
      { href: "/vehicles/admit", label: "New ticket", feature: "admit_vehicle" },
      { href: "/parts-pos", label: "Instant bill", feature: "billing" },
      { href: "/parts", label: "Find a spare", feature: "parts_inventory" },
      { href: "/balance-sheet", label: "View finance", feature: "balance_sheet" },
    ],
    defaultFeatures: [
      "admit_vehicle", "parts_inventory", "suppliers", "customers", "billing", "bill_sms", "bill_profits",
      "employees_management", "attendance", "payroll", "balance_sheet", "reports",
    ],
    moduleCatalog: [
      { key: "admit_vehicle", name: "Admit device", group: "Service Intake" },
      { key: "parts_inventory", name: "Spares", group: "Inventory" },
      { key: "suppliers", name: "Suppliers", group: "Inventory" },
      ...sharedPeopleFinance.map((m) => m.key === "billing" ? { ...m, name: "Repair tickets" } : m),
    ],
    navigation: [
      { href: "/dashboard", label: "Overview", icon: Gauge },
      { href: "/vehicles/admit", label: "Admit device", icon: ClipboardList, feature: "admit_vehicle" },
      { href: "/bills", label: "Tickets", icon: ReceiptText, feature: "billing" },
      { href: "/parts-pos", label: "Instant bill", icon: ShoppingBag, feature: "billing" },
      billProfitsNav,
      { href: "/parts", label: "Spares", icon: Boxes, feature: "parts_inventory" },
      suppliersNav,
      ...sharedNavTail,
    ],
    billItemTypes: [
      { value: "labor", label: "Labor", kind: "charge" },
      { value: "part", label: "Spare", kind: "stock" },
      { value: "discount", label: "Discount", kind: "discount" },
    ],
  },
  salon: {
    type: "salon",
    label: "Salons",
    operationsLabel: "Salon operations",
    billingLabel: "Orders",
    billingSingular: "Order",
    openBillsLabel: "Open orders",
    recentBillsTitle: "Latest orders",
    recentBillsHint: "Appointments, retail, and balances due",
    primaryCta: { href: "/bookings/new", label: "New appointment", feature: "photo_bookings" },
    quickActions: [
      { href: "/bookings/new", label: "New appointment", feature: "photo_bookings" },
      { href: "/pos", label: "Retail sale", feature: "retail_pos" },
      { href: "/bills", label: "Take payment", feature: "billing" },
      { href: "/balance-sheet", label: "View finance", feature: "balance_sheet" },
    ],
    defaultFeatures: [
      "photo_bookings", "photo_packages", "retail_pos", "product_catalog", "customers", "billing", "bill_sms", "bill_profits",
      "employees_management", "attendance", "payroll", "balance_sheet", "reports",
    ],
    moduleCatalog: [
      { key: "photo_bookings", name: "Appointments", group: "Service Intake" },
      { key: "photo_packages", name: "Packages", group: "Service Intake" },
      { key: "retail_pos", name: "Point of sale", group: "Service Intake" },
      { key: "product_catalog", name: "Retail catalog", group: "Inventory" },
      ...sharedPeopleFinance.map((m) => m.key === "billing" ? { ...m, name: "Orders" } : m),
    ],
    navigation: [
      { href: "/dashboard", label: "Overview", icon: Gauge },
      { href: "/bookings", label: "Appointments", icon: CalendarDays, feature: "photo_bookings" },
      { href: "/packages", label: "Packages", icon: Camera, feature: "photo_packages" },
      { href: "/pos", label: "Retail sale", icon: ShoppingBag, feature: "retail_pos" },
      { href: "/catalog", label: "Catalog", icon: Package, feature: "product_catalog" },
      { href: "/bills", label: "Orders", icon: ReceiptText, feature: "billing" },
      billProfitsNav,
      ...garmentPeopleNav,
    ],
    billItemTypes: [
      { value: "session", label: "Service", kind: "charge" },
      { value: "package", label: "Package", kind: "charge" },
      { value: "product", label: "Retail product", kind: "charge", allowQty: true },
      { value: "addon", label: "Add-on", kind: "charge" },
      { value: "discount", label: "Discount", kind: "discount" },
    ],
  },
};

export const BUSINESS_TYPE_OPTIONS: Array<{ value: BusinessType; label: string }> = [
  { value: "garage", label: "Garages" },
  { value: "tyre", label: "Tyre shops" },
  { value: "device_repair", label: "Device repair" },
  { value: "paint", label: "Paint shops" },
  { value: "photography", label: "Studios" },
  { value: "clothing", label: "Garments" },
  { value: "salon", label: "Salons" },
  { value: "cottage", label: "Cottages" },
];

/** Display-only labels stored on tenants.plan — does not gate features. */
export const PLAN_OPTIONS: Array<{ value: string; label: string }> = [
  { value: "garage-pro", label: "Garage Pro" },
  { value: "paint-pro", label: "Paint Pro" },
  { value: "studio-pro", label: "Studio Pro" },
  { value: "retail-pro", label: "Retail Pro" },
  { value: "stay-pro", label: "Stay Pro" },
  { value: "salon-pro", label: "Salon Pro" },
  { value: "repair-pro", label: "Repair Pro" },
  { value: "Growth", label: "Growth" },
  { value: "Trial", label: "Trial" },
  { value: "Custom", label: "Custom" },
];

export const PAYMENT_PLAN_OPTIONS: Array<{ value: "monthly" | "yearly"; label: string }> = [
  { value: "monthly", label: "Monthly" },
  { value: "yearly", label: "Yearly" },
];

export function defaultPlanFor(type: BusinessType): string {
  return matchPlan(type);
}

function matchPlan(type: BusinessType): string {
  switch (type) {
    case "photography":
      return "studio-pro";
    case "clothing":
      return "retail-pro";
    case "cottage":
      return "stay-pro";
    case "salon":
      return "salon-pro";
    case "device_repair":
      return "repair-pro";
    case "paint":
      return "paint-pro";
    default:
      return "garage-pro";
  }
}

export function usesVehicleJobs(type?: string | null): boolean {
  return type === "garage" || type === "tyre" || type === "device_repair" || type === "paint";
}

export function usesLaborCatalog(type?: string | null): boolean {
  return type === "garage" || type === "paint";
}

export function usesServiceAddonWorkspace(type?: string | null): boolean {
  return type === "garage" || type === "paint";
}

export function profileFor(type?: string | null): BusinessProfile {
  if (type && type in BUSINESS_PROFILES) {
    return BUSINESS_PROFILES[type as BusinessType];
  }
  return BUSINESS_PROFILES.garage;
}

export function billLinePresentation(item: {
  description: string;
  included_services?: string[] | null;
}): { title: string; inclusions: string[] } {
  if (Array.isArray(item.included_services) && item.included_services.length > 0) {
    return { title: item.description, inclusions: item.included_services };
  }
  const match = item.description.match(/^(.*?)\s*\(includes\s+(.+)\)\s*$/i);
  if (match) {
    return {
      title: match[1].trim(),
      inclusions: match[2].split(/\s*,\s*/).map((name) => name.trim()).filter(Boolean),
    };
  }
  return { title: item.description, inclusions: [] };
}

export function billItemLabel(type: string, profile?: BusinessProfile | null): string {
  const match = profile?.billItemTypes.find((item) => item.value === type);
  if (match) return match.label;
  if (type === "customer_part") return "Customer part";
  if (type === "service" || type === "service_addon") return "Service";
  if (type === "charge") return "Service / charge";
  return type.replaceAll("_", " ");
}

export const PAINT_PANEL_NAMES = [
  "Front bumper",
  "Rear bumper",
  "Bonnet",
  "Roof",
  "Boot lid",
  "Door",
  "Front fender",
  "Rear quarter",
  "Pillar",
  "Mirror cover",
  "Sill",
  "Alloy wheel",
] as const;

/** Inventory / parts first, other charges, labor, discount last. Panel groups stay together. */
export function sortBillItems<T extends { id: number; type: string; panel_group_id?: string | null }>(items: T[]): T[] {
  const firstId = new Map<string, number>();
  for (const item of items) {
    const key = item.panel_group_id || `item-${item.id}`;
    const current = firstId.get(key);
    if (current === undefined || item.id < current) firstId.set(key, item.id);
  }

  const rank = (type: string) => {
    if (type === "part" || type === "customer_part") return 1;
    if (type === "labor") return 3;
    if (type === "discount") return 4;
    return 2;
  };

  return [...items].sort((a, b) => {
    const aKey = a.panel_group_id || `item-${a.id}`;
    const bKey = b.panel_group_id || `item-${b.id}`;
    const aFirst = firstId.get(aKey) ?? a.id;
    const bFirst = firstId.get(bKey) ?? b.id;
    if (aFirst !== bFirst) return aFirst - bFirst;
    if (a.panel_group_id && a.panel_group_id === b.panel_group_id) return a.id - b.id;
    const byType = rank(a.type) - rank(b.type);
    return byType !== 0 ? byType : a.id - b.id;
  });
}
