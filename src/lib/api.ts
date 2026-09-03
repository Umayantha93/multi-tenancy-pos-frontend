export const API_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8000/api";
export const APP_ORIGIN = API_URL.replace(/\/api\/?$/, "");

type ApiOptions = RequestInit & { authenticated?: boolean };

export async function api<T>(path: string, options: ApiOptions = {}): Promise<T> {
  const token = typeof window === "undefined" ? null : localStorage.getItem("garage_token");
  const headers = new Headers(options.headers);
  if (!(options.body instanceof FormData)) headers.set("Content-Type", "application/json");
  if (options.authenticated !== false && token) headers.set("Authorization", `Bearer ${token}`);
  const response = await fetch(`${API_URL}${path}`, { ...options, headers });
  if (response.status === 401 && typeof window !== "undefined") {
    clearSession();
    window.location.href = "/login";
  }
  if (!response.ok) {
    const error = await response.json().catch(() => ({ message: "Request failed." }));
    const validation = error.errors ? Object.values(error.errors).flat().join(" ") : null;
    throw new Error(validation || error.message || "Request failed.");
  }
  if (response.status === 204) return undefined as T;
  return response.json() as Promise<T>;
}

export type FeatureKey =
  | "admit_vehicle"
  | "customers"
  | "billing"
  | "bill_sms"
  | "bill_profits"
  | "payroll"
  | "balance_sheet"
  | "parts_inventory"
  | "employees_management"
  | "attendance"
  | "reports"
  | "photo_bookings"
  | "photo_packages"
  | "retail_pos"
  | "product_catalog"
  | "cottage_rooms"
  | "cottage_stays"
  | "suppliers";

export type BusinessType = "garage" | "tyre" | "device_repair" | "paint" | "photography" | "clothing" | "salon" | "cottage";

export type PhoneEntry = { label?: string; number: string };

export type Tenant = {
  id: number;
  business_name: string;
  business_type: BusinessType;
  status: "active" | "inactive";
  dual_financial_view_enabled?: boolean;
  plan?: string | null;
  payment_plan?: "monthly" | "yearly" | null;
  plan_amount?: number | string | null;
  payment_due_soon?: boolean;
  current_month_paid?: boolean;
  logo?: string | null;
  logo_url?: string | null;
  owner_email?: string | null;
  owner_phone?: string | null;
  owner_phones?: PhoneEntry[] | null;
  contact_email?: string | null;
  contact_phone?: string | null;
  contact_phones?: PhoneEntry[] | null;
  address?: string | null;
  tin?: string | null;
  vat_registered?: boolean;
  sscl_registered?: boolean;
  vat_rate?: number | string | null;
  sscl_rate?: number | string | null;
  demo_ends_at?: string | null;
  demo_days_left?: number | null;
  is_demo?: boolean;
};
export type User = {
  id: number;
  tenant_id: number | null;
  name: string;
  email: string;
  role: "super_admin" | "business_owner" | "staff";
  status: "active" | "inactive";
  employee_id?: number | null;
  employee?: { id: number; name: string; phone?: string; position?: string; nic?: string } | null;
  is_secondary_view?: boolean;
  tenant?: Tenant | null;
};

export function storeSession(token: string, user: User, features: string[]) {
  localStorage.setItem("garage_token", token);
  localStorage.setItem("garage_user", JSON.stringify(user));
  localStorage.setItem("garage_features", JSON.stringify(features));
}

export function clearSession() {
  localStorage.removeItem("garage_token");
  localStorage.removeItem("garage_user");
  localStorage.removeItem("garage_features");
}

export function currentUser(): User | null {
  if (typeof window === "undefined") return null;
  const value = localStorage.getItem("garage_user");
  return value ? JSON.parse(value) as User : null;
}

export function currentFeatures(): string[] {
  if (typeof window === "undefined") return [];
  const value = localStorage.getItem("garage_features");
  return value ? JSON.parse(value) as string[] : [];
}

export function money(value: number | string) {
  return new Intl.NumberFormat("en-LK", { style: "currency", currency: "LKR", maximumFractionDigits: 2 }).format(Number(value));
}

export function formatDate(value?: string | null) {
  if (!value) return "—";
  const raw = String(value).trim();
  const dateOnly = raw.match(/^(\d{4}-\d{2}-\d{2})/)?.[1];
  const parsed = new Date(dateOnly ? `${dateOnly}T12:00:00` : raw);
  if (Number.isNaN(parsed.getTime())) return raw;
  return parsed.toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" });
}

export function mediaUrl(path?: string | null) {
  if (!path) return null;
  if (/^https?:\/\//i.test(path)) return path;
  const cleaned = path.replace(/^\/+/, "");
  if (cleaned.startsWith("storage/")) return `${APP_ORIGIN}/${cleaned}`;
  return `${APP_ORIGIN}/storage/${cleaned}`;
}
