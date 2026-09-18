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
  admit_repair: "Service Intake",
  admit_service: "Service Intake",
  job_board: "Service Intake",
  job_bookings: "Service Intake",
  photo_bookings: "Service Intake",
  photo_packages: "Service Intake",
  retail_pos: "Service Intake",
  cottage_stays: "Service Intake",
  customers: "Service Intake",
  billing: "Service Intake",
  bill_sms: "Service Intake",
  service_reminders: "Service Intake",
  bill_profits: "Service Intake",
  repair_bills: "Service Intake",
  warranties: "Service Intake",
  owner_bill_sms: "Service Intake",
  job_videos: "Service Intake",
  parts_inventory: "Inventory",
  product_catalog: "Inventory",
  cottage_rooms: "Inventory",
  suppliers: "Inventory",
  purchase_orders: "Inventory",
  part_fitment: "Inventory",
  serial_inventory: "Inventory",
  employees_management: "People",
  attendance: "People",
  payroll: "People",
  balance_sheet: "Finance",
  cash_up: "Finance",
  reports: "Finance",
  service_ops_report: "Finance",
};

export const FEATURE_PARENTS: Record<string, string> = {
  admit_repair: "admit_vehicle",
  admit_service: "admit_vehicle",
  job_board: "admit_vehicle",
  owner_bill_sms: "admit_vehicle",
  job_videos: "admit_vehicle",
  service_reminders: "bill_sms",
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

export type NestedModule<T extends ModuleFeature> = { feature: T; children: T[] };

export function nestGroupFeatures<T extends ModuleFeature>(features: T[]): NestedModule<T>[] {
  const present = new Set(features.map((feature) => feature.key));
  const childKeys = new Set(
    features
      .filter((feature) => FEATURE_PARENTS[feature.key] && present.has(FEATURE_PARENTS[feature.key]))
      .map((feature) => feature.key),
  );
  return features
    .filter((feature) => !childKeys.has(feature.key))
    .map((feature) => ({
      feature,
      children: features.filter((child) => FEATURE_PARENTS[child.key] === feature.key),
    }));
}

export function togglePlanFeature(
  enabled: string[],
  key: string,
  options: { garageAdmit?: boolean } = {},
): FeatureKey[] {
  const turningOff = enabled.includes(key);
  const children = Object.entries(FEATURE_PARENTS)
    .filter(([, parent]) => parent === key)
    .map(([child]) => child);

  if (turningOff) {
    if (options.garageAdmit && (key === "admit_repair" || key === "admit_service")) {
      const other = key === "admit_repair" ? "admit_service" : "admit_repair";
      if (!enabled.includes(other) && enabled.includes("admit_vehicle")) {
        return enabled as FeatureKey[];
      }
    }
    let next = enabled.filter((item) => item !== key && !children.includes(item));
    if (key === "admit_service") {
      next = next.filter((item) => item !== "service_reminders" && item !== "service_ops_report");
    }
    if (key === "bill_sms") {
      next = next.filter((item) => item !== "service_reminders");
    }
    return next as FeatureKey[];
  }

  const next = [...enabled, key];
  const parent = FEATURE_PARENTS[key];
  if (parent && !next.includes(parent)) next.push(parent);
  if (options.garageAdmit && key === "admit_vehicle" && !next.includes("admit_repair") && !next.includes("admit_service")) {
    next.push("admit_repair", "admit_service");
  }
  return next as FeatureKey[];
}

export type { BusinessProfile };
