export function waMeNumber(phone: string): string | null {
  const digits = phone.replace(/\D+/g, "");
  if (!digits) return null;
  if (digits.startsWith("94") && digits.length >= 11) return digits;
  if (digits.startsWith("0") && digits.length === 10) return `94${digits.slice(1)}`;
  if (digits.startsWith("7") && digits.length === 9) return `94${digits}`;
  return digits.length >= 9 ? digits : null;
}

export function whatsappHref(phone: string, text: string): string | null {
  const number = waMeNumber(phone);
  if (!number) return null;
  return `https://wa.me/${number}?text=${encodeURIComponent(text)}`;
}

export function billShareUrl(token: string | null | undefined): string | null {
  if (!token || typeof window === "undefined") return null;
  return `${window.location.origin}/share/bills/${token}`;
}
