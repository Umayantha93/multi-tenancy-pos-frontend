import type { FeatureKey } from "@/lib/api";

export type ModuleFeature = {
  id?: number;
  key: string;
  name: string;
  group?: string | null;
  description?: string | null;
};

const GROUP_ORDER = ["Service Intake", "Inventory", "People", "Finance"];

const FALLBACK_GROUP: Record<string, string> = {
  admit_vehicle: "Service Intake",
  customers: "Service Intake",
  billing: "Service Intake",
  parts_inventory: "Inventory",
  employees_management: "People",
  attendance: "People",
  payroll: "People",
  balance_sheet: "Finance",
  reports: "Finance",
};

export const MODULE_CATALOG: Array<{ key: FeatureKey; name: string; group: string }> = [
  { key: "admit_vehicle", name: "Admit vehicle", group: "Service Intake" },
  { key: "customers", name: "Customers", group: "Service Intake" },
  { key: "billing", name: "Job cards", group: "Service Intake" },
  { key: "parts_inventory", name: "Parts inventory", group: "Inventory" },
  { key: "employees_management", name: "Team", group: "People" },
  { key: "attendance", name: "Attendance", group: "People" },
  { key: "payroll", name: "Payroll", group: "People" },
  { key: "balance_sheet", name: "Finance", group: "Finance" },
  { key: "reports", name: "Reports", group: "Finance" },
];

export function groupModules<T extends ModuleFeature>(features: T[]) {
  const buckets = new Map<string, T[]>();

  for (const feature of features) {
    const group = feature.group || FALLBACK_GROUP[feature.key] || "Other";
    const list = buckets.get(group) ?? [];
    list.push(feature);
    buckets.set(group, list);
  }

  const orderedGroups = [
    ...GROUP_ORDER.filter((group) => buckets.has(group)),
    ...[...buckets.keys()].filter((group) => !GROUP_ORDER.includes(group)).sort(),
  ];

  return orderedGroups.map((group) => ({
    group,
    features: buckets.get(group) ?? [],
  }));
}
