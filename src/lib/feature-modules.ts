import type { FeatureKey } from "@/lib/api";
import { BUSINESS_PROFILES, profileFor, type BusinessProfile } from "@/lib/business-profiles";

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
  photo_bookings: "Service Intake",
  photo_packages: "Service Intake",
  retail_pos: "Service Intake",
  cottage_stays: "Service Intake",
  customers: "Service Intake",
  billing: "Service Intake",
  bill_sms: "Service Intake",
  bill_profits: "Service Intake",
  repair_bills: "Service Intake",
  parts_inventory: "Inventory",
  product_catalog: "Inventory",
  cottage_rooms: "Inventory",
  suppliers: "Inventory",
  employees_management: "People",
  attendance: "People",
  payroll: "People",
  balance_sheet: "Finance",
  reports: "Finance",
};

/** Full catalog fallback — prefer profileFor(type).moduleCatalog when type is known. */
export const MODULE_CATALOG: Array<{ key: FeatureKey; name: string; group: string }> = Object.values(BUSINESS_PROFILES)
  .flatMap((profile) => profile.moduleCatalog)
  .filter((module, index, list) => list.findIndex((item) => item.key === module.key) === index);

export function catalogForType(type?: string | null): Array<{ key: FeatureKey; name: string; group: string }> {
  return profileFor(type).moduleCatalog;
}

export function defaultsForType(type?: string | null): FeatureKey[] {
  return profileFor(type).defaultFeatures;
}

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

export type { BusinessProfile };
