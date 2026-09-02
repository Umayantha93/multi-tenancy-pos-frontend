"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { ReactNode, useEffect, useMemo, useState } from "react";
import { LogOut, Menu, Store, X } from "lucide-react";
import { api, clearSession, currentFeatures, currentUser, mediaUrl, money, storeSession, User } from "@/lib/api";
import { profileFor } from "@/lib/business-profiles";

export function AppShell({ children, title, eyebrow, action }: { children: ReactNode; title: string; eyebrow?: string; action?: ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const [user, setUser] = useState<User | null>(null);
  const [features, setFeatures] = useState<string[]>([]);
  const [open, setOpen] = useState(false);

  const profile = useMemo(() => profileFor(user?.tenant?.business_type), [user?.tenant?.business_type]);
  const navigation = profile.navigation;
  const showPaymentReminder = Boolean(user?.tenant?.payment_due_soon);
  const paymentAmount = user?.tenant?.plan_amount;

  useEffect(() => {
    if (!localStorage.getItem("garage_token")) {
      router.replace("/login");
      return;
    }
    const sessionUser = currentUser();
    if (sessionUser?.role === "super_admin") {
      router.replace("/super-admin/dashboard");
      return;
    }
    setUser(sessionUser);
    setFeatures(currentFeatures());

    api<{ user: User; features: string[] }>("/user")
      .then((result) => {
        const token = localStorage.getItem("garage_token");
        if (token) storeSession(token, result.user, result.features);
        setUser(result.user);
        setFeatures(result.features);
      })
      .catch(() => {
        /* Keep cached session if refresh fails briefly. */
      });
  }, [router]);

  useEffect(() => {
    if (!user) return;
    const required = navigation.find((item) => {
      if (item.href === "/dashboard" || !pathname.startsWith(item.href)) return false;
      if (item.owner && user.role !== "business_owner") return false;
      if (item.staffSelf && user.role !== "staff") return false;
      return true;
    });
    if (required && ((required.feature && !features.includes(required.feature) && !(required.staffSelf && user.role === "staff")) || (required.owner && user.role !== "business_owner"))) {
      router.replace("/dashboard");
    }
  }, [features, navigation, pathname, router, user]);

  async function logout() {
    try { await api("/auth/logout", { method: "POST" }); } catch { /* Clear local access even if the server is unavailable. */ }
    clearSession(); router.replace("/login");
  }

  const links = navigation.filter((item) => {
    if (item.owner && user?.role !== "business_owner") return false;
    if (item.staffSelf && user?.role === "staff") return true;
    if (item.staffSelf && user?.role !== "staff") return false;
    if (item.feature && !features.includes(item.feature)) return false;
    return true;
  });
  const logoUrl = mediaUrl(user?.tenant?.logo_url || user?.tenant?.logo);
  return (
    <div className="min-h-screen lg:grid lg:grid-cols-[240px_1fr]">
      <aside className={`no-print fixed inset-y-0 left-0 z-40 flex w-[240px] flex-col bg-[#242723] text-white transition-transform lg:sticky lg:top-0 lg:h-screen lg:translate-x-0 ${open ? "translate-x-0" : "-translate-x-full"}`}>
        <div className="flex h-20 items-center justify-between border-b border-white/10 px-5">
          <Link href="/dashboard" className="flex min-w-0 items-center gap-3">
            {logoUrl ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={logoUrl} alt="" className="size-10 shrink-0 object-contain bg-white/95 p-0.5" />
            ) : (
              <span className="grid size-10 shrink-0 place-items-center bg-[#f5c842] text-[#20221f]"><Store size={20} /></span>
            )}
            <div className="min-w-0">
              <strong className="block truncate font-display text-xl uppercase">{user?.tenant?.business_name ?? "Business"}</strong>
              <p className="text-[10px] uppercase text-white/40">{profile.operationsLabel}</p>
            </div>
          </Link>
          <button onClick={() => setOpen(false)} className="lg:hidden" aria-label="Close navigation"><X /></button>
        </div>
        <nav className="sidebar-scroll flex-1 space-y-1 overflow-y-auto overscroll-contain px-3 py-6">
          {links.map(({ href, label, icon: Icon }) => {
            const active = pathname === href || (href !== "/dashboard" && pathname.startsWith(href));
            return (
              <Link
                key={href}
                href={href}
                onClick={() => setOpen(false)}
                className={`flex h-11 items-center gap-3 px-3 text-sm transition ${active ? "bg-[#f5c842] font-semibold text-[#20221f]" : "text-white/65 hover:bg-white/8 hover:text-white"}`}
              >
                <Icon size={18} />{label}
              </Link>
            );
          })}
        </nav>
        <div className="border-t border-white/10 p-4"><div className="mb-3 flex items-center gap-3"><span className="grid size-9 place-items-center bg-[#167c73] text-sm font-bold">{user?.name?.charAt(0) ?? "?"}</span><div className="min-w-0"><p className="truncate text-sm font-semibold">{user?.name ?? "Loading"}</p><p className="text-[10px] uppercase text-white/40">{user?.role ?? "account"}</p></div></div><button onClick={logout} className="flex w-full items-center gap-2 py-2 text-xs text-white/50 hover:text-white"><LogOut size={15} />Sign out</button></div>
      </aside>
      {open && <button aria-label="Close navigation overlay" onClick={() => setOpen(false)} className="no-print fixed inset-0 z-30 bg-black/45 lg:hidden" />}
      <main className="min-w-0">
        {showPaymentReminder && (
          <div className="no-print flex min-h-20 items-center justify-center bg-[#6b1e2a] px-4 py-5 text-center sm:min-h-24 sm:px-7 sm:py-6">
            <p className="max-w-3xl font-display text-xl font-semibold uppercase leading-snug text-[#f8ebea] sm:text-2xl md:text-3xl">
              Monthly payment due — please pay{" "}
              <span className="underline decoration-[#f8ebea]/40 underline-offset-4">
                {paymentAmount != null ? money(paymentAmount) : "your plan amount"}
              </span>{" "}
              before month end
            </p>
          </div>
        )}
        <header className="no-print flex min-h-20 items-center justify-between gap-3 border-b border-[#d7d3c8] bg-[#f3f0e8]/90 px-4 backdrop-blur sm:px-7">
          <div className="flex min-w-0 items-center gap-3">
            <button onClick={() => setOpen(true)} className="grid size-10 place-items-center border border-[#d7d3c8] lg:hidden" aria-label="Open navigation"><Menu size={20} /></button>
            <div className="min-w-0">{eyebrow && <p className="text-[10px] font-bold uppercase text-[#167c73]">{eyebrow}</p>}<h1 className="font-display text-3xl font-semibold uppercase leading-none sm:text-4xl">{title}</h1></div>
          </div>
          {action ? <div className="flex shrink-0 items-center gap-2">{action}</div> : null}
        </header>
        <div className="page-enter p-4 sm:p-7">{children}</div>
      </main>
    </div>
  );
}
