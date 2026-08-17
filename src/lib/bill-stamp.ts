import { formatDate } from "@/lib/api";

export type BillStamp = "paid" | "partial" | "quote";

export function billStamp(bill: { amount_paid: string | number; balance_due: string | number }): BillStamp {
  const paid = Number(bill.amount_paid);
  const due = Number(bill.balance_due);
  if (paid > 0 && due <= 0) return "paid";
  if (paid > 0) return "partial";
  return "quote";
}

export function latestPaymentAt(payments: Array<{ paid_at: string }>): string | null {
  if (!payments.length) return null;
  return [...payments].sort((a, b) => a.paid_at.localeCompare(b.paid_at)).at(-1)?.paid_at ?? null;
}

export function billStampLabel(stamp: BillStamp): string {
  if (stamp === "paid") return "Paid";
  if (stamp === "partial") return "Partially paid";
  return "Quote";
}

export function billStampDateLabel(paidAt: string | null): string | null {
  return paidAt ? formatDate(paidAt) : null;
}
