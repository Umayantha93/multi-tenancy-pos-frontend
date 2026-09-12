import { formatDate } from "@/lib/api";

export type BillStamp = "paid" | "partial" | "quote" | "repair_note";

export function billStamp(bill: {
  amount_paid: string | number | null;
  balance_due: string | number | null;
  hide_amounts?: boolean | null;
}): BillStamp {
  const paid = Number(bill.amount_paid ?? 0);
  const due = Number(bill.balance_due ?? 0);
  if (paid > 0 && due <= 0) return "paid";
  if (paid > 0) return "partial";
  if (bill.hide_amounts) return "repair_note";
  return "quote";
}

export function latestPaymentAt(payments: Array<{ paid_at: string }>): string | null {
  if (!payments.length) return null;
  return [...payments].sort((a, b) => a.paid_at.localeCompare(b.paid_at)).at(-1)?.paid_at ?? null;
}

export function billStampLabel(stamp: BillStamp): string {
  if (stamp === "paid") return "Paid";
  if (stamp === "partial") return "Partially paid";
  if (stamp === "repair_note") return "Repair note";
  return "Quote";
}

export function billStampDateLabel(paidAt: string | null): string | null {
  return paidAt ? formatDate(paidAt) : null;
}

export function isOweInUrgent(dueDate?: string | null, withinDays = 3): boolean {
  if (!dueDate) return false;
  const due = new Date(`${dueDate.slice(0, 10)}T00:00:00`);
  const limit = new Date();
  limit.setHours(0, 0, 0, 0);
  limit.setDate(limit.getDate() + withinDays);
  return due.getTime() <= limit.getTime();
}

export function billStatusClass(status: string, dueDate?: string | null): string {
  if (status === "owe_in" && isOweInUrgent(dueDate)) return "bg-[#b84837] text-white";
  if (status === "owe_in") return "bg-[#2b6cb0]/15 text-[#2b6cb0]";
  if (status === "paid") return "bg-[#167c73]/10 text-[#167c73]";
  if (status === "closed") return "bg-[#20221f] text-white";
  return "bg-[#f5c842]/25 text-[#735a00]";
}

export function billStatusLabel(status: string): string {
  if (status === "partially_refunded") return "partially refunded";
  return status.replaceAll("_", " ");
}
