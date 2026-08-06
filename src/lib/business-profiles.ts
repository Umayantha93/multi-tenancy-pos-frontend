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
  type LucideIcon,
} from "lucide-react";

export type NavItem = {
  href: string;
  label: string;
  icon: LucideIcon;
  feature?: FeatureKey;
  owner?: boolean;
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
};

const sharedPeopleFinance: Array<{ key: FeatureKey; name: string; group: string }> = [
  { key: "customers", name: "Customers", group: "Service Intake" },
  { key: "billing", name: "Billing", group: "Service Intake" },
  { key: "employees_management", name: "Team", group: "People" },
  { key: "attendance", name: "Attendance", group: "People" },
  { key: "payroll", name: "Payroll", group: "People" },
  { key: "balance_sheet", name: "Finance", group: "Finance" },
  { key: "reports", name: "Reports", group: "Finance" },
];

const sharedNavTail: NavItem[] = [
  { href: "/customers", label: "Customers", icon: Contact, feature: "customers" },
  { href: "/employees", label: "Team", icon: Users, feature: "employees_management" },
  { href: "/attendance", label: "Attendance", icon: Fingerprint, feature: "attendance" },
  { href: "/payroll", label: "Payroll", icon: ChartNoAxesCombined, feature: "payroll" },
  { href: "/balance-sheet", label: "Finance", icon: ChartNoAxesCombined, feature: "balance_sheet" },
  { href: "/staff", label: "Staff access", icon: ShieldCheck, owner: true },
];

export const BUSINESS_PROFILES: Record<BusinessType, BusinessProfile> = {
  garage: {
    type: "garage",
    label: "Garage",
    operationsLabel: "Garage operations",
    billingLabel: "Job cards",
    billingSingular: "Job card",
    openBillsLabel: "Open job cards",
    recentBillsTitle: "Latest job cards",
    recentBillsHint: "Open bills and active work across the counter",
    primaryCta: { href: "/vehicles/admit", label: "Admit vehicle", feature: "admit_vehicle" },
    quickActions: [
      { href: "/vehicles/admit", label: "New admission", feature: "admit_vehicle" },
      { href: "/parts", label: "Find a part", feature: "parts_inventory" },
      { href: "/bills", label: "Take payment", feature: "billing" },
      { href: "/balance-sheet", label: "View finance", feature: "balance_sheet" },
    ],
    defaultFeatures: [
      "admit_vehicle", "parts_inventory", "customers", "billing",
      "employees_management", "attendance", "payroll", "balance_sheet", "reports",
    ],
    moduleCatalog: [
      { key: "admit_vehicle", name: "Admit vehicle", group: "Service Intake" },
      { key: "parts_inventory", name: "Parts inventory", group: "Inventory" },
      ...sharedPeopleFinance.map((m) => m.key === "billing" ? { ...m, name: "Job cards" } : m),
    ],
    navigation: [
      { href: "/dashboard", label: "Overview", icon: Gauge },
      { href: "/vehicles/admit", label: "Admit vehicle", icon: ClipboardList, feature: "admit_vehicle" },
      { href: "/bills", label: "Job cards", icon: ReceiptText, feature: "billing" },
      { href: "/parts", label: "Parts", icon: Boxes, feature: "parts_inventory" },
      ...sharedNavTail,
    ],
  },
  photography: {
    type: "photography",
    label: "Photography",
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
      "photo_bookings", "photo_packages", "customers", "billing",
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
      ...sharedNavTail,
    ],
  },
  clothing: {
    type: "clothing",
    label: "Clothing",
    operationsLabel: "Boutique operations",
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
      "retail_pos", "product_catalog", "customers", "billing",
      "employees_management", "attendance", "payroll", "balance_sheet", "reports",
    ],
    moduleCatalog: [
      { key: "retail_pos", name: "Point of sale", group: "Service Intake" },
      { key: "product_catalog", name: "Product catalog", group: "Inventory" },
      ...sharedPeopleFinance.map((m) => m.key === "billing" ? { ...m, name: "Sales" } : m),
    ],
    navigation: [
      { href: "/dashboard", label: "Overview", icon: Gauge },
      { href: "/pos", label: "New sale", icon: ShoppingBag, feature: "retail_pos" },
      { href: "/catalog", label: "Catalog", icon: Package, feature: "product_catalog" },
      { href: "/bills", label: "Sales", icon: ReceiptText, feature: "billing" },
      ...sharedNavTail,
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
      "cottage_rooms", "cottage_stays", "customers", "billing",
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
      ...sharedNavTail,
    ],
  },
};

export const BUSINESS_TYPE_OPTIONS: Array<{ value: BusinessType; label: string }> = [
  { value: "garage", label: "Garage" },
  { value: "photography", label: "Photography" },
  { value: "clothing", label: "Clothing" },
  { value: "cottage", label: "Cottages" },
];

export function profileFor(type?: string | null): BusinessProfile {
  if (type && type in BUSINESS_PROFILES) {
    return BUSINESS_PROFILES[type as BusinessType];
  }
  return BUSINESS_PROFILES.garage;
}
