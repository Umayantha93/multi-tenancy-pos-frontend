"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { ReactNode, useEffect, useMemo, useState } from "react";
import { LogOut, Menu, Store, X } from "lucide-react";
import { api, clearSession, currentFeatures, currentUser, mediaUrl, money, SessionPayload, storeSession, User } from "@/lib/api";
import { profileFor } from "@/lib/business-profiles";
import { BranchChip } from "@/components/branch-chip";
import { LanguageToggle } from "@/components/language-toggle";
import { useLocale, useT } from "@/lib/locale";

export function AppShell({ children, title, eyebrow, action }: { children: ReactNode; title: string; eyebrow?: string; action?: ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const t = useT();
  const { setLocale } = useLocale();
  const [user, setUser] = useState<User | null>(null);
  const [features, setFeatures] = useState<string[]>([]);
  const [open, setOpen] = useState(false);
  const [dueCheques, setDueCheques] = useState<{ count: number; firstExpenseId?: number } | null>(null);

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

    api<SessionPayload>("/user")
      .then((result) => {
        const token = localStorage.getItem("garage_token");
        if (token) storeSession(token, result.user, result.features, {
          branches: result.branches,
          active_branch: result.active_branch,
        });
        setUser(result.user);
        setFeatures(result.features);
        if (result.user.locale === "si" || result.user.locale === "en") {
          const stored = localStorage.getItem("garage_locale");
          if (stored !== result.user.locale) {
            void setLocale(result.user.locale, { persist: false });
          }
        }
        if (result.features.includes("balance_sheet")) {
          api<{ count: number; items: Array<{ expense_id: number }> }>("/expenses/cheques/due")
            .then((due) => {
              if (due.count > 0) {
                setDueCheques({ count: due.count, firstExpenseId: due.items[0]?.expense_id });
              } else {
                setDueCheques(null);
              }
            })
            .catch(() => setDueCheques(null));
        } else {
          setDueCheques(null);
        }
      })
      .catch(() => {
        /* Keep cached session if refresh fails briefly. */
      });
  }, [router, setLocale]);

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
  const roleLabel = user?.role ? t(`roles.${user.role}`) : t("shell.account");
  const amountLabel = paymentAmount != null ? money(paymentAmount) : t("shell.plan_amount");

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
              <strong className="block truncate font-display text-xl uppercase">{user?.tenant?.business_name ?? t("shell.business")}</strong>
              <p className="text-[10px] uppercase text-white/40">{t(`ops.${profile.operationsLabel}`)}</p>
            </div>
          </Link>
          <button onClick={() => setOpen(false)} className="lg:hidden" aria-label={t("shell.close_nav")}><X /></button>
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
                <Icon size={18} />{t(`nav.${label}`)}
              </Link>
            );
          })}
        </nav>
        <div className="border-t border-white/10 p-4">
          <LanguageToggle />
          <div className="mb-3 flex items-center gap-3">
            <span className="grid size-9 place-items-center bg-[#167c73] text-sm font-bold">{user?.name?.charAt(0) ?? "?"}</span>
            <div className="min-w-0">
              <p className="truncate text-sm font-semibold">{user?.name ?? t("shell.loading")}</p>
              <p className="text-[10px] uppercase text-white/40">{roleLabel}</p>
            </div>
          </div>
          <button onClick={logout} className="flex w-full items-center gap-2 py-2 text-xs text-white/50 hover:text-white">
            <LogOut size={15} />{t("shell.sign_out")}
          </button>
        </div>
      </aside>
      {open && <button aria-label={t("shell.close_overlay")} onClick={() => setOpen(false)} className="no-print fixed inset-0 z-30 bg-black/45 lg:hidden" />}
      <main className="min-w-0">
        {showPaymentReminder && (
          <div className="no-print flex min-h-20 items-center justify-center bg-[#6b1e2a] px-4 py-5 text-center sm:min-h-24 sm:px-7 sm:py-6">
            <p className="max-w-3xl font-display text-xl font-semibold uppercase leading-snug text-[#f8ebea] sm:text-2xl md:text-3xl">
              {t("shell.payment_due", { amount: amountLabel })}
            </p>
          </div>
        )}
        {dueCheques && dueCheques.count > 0 && (
          <div className="no-print flex min-h-14 items-center justify-center bg-[#167c73] px-4 py-4 text-center sm:px-7">
            <Link
              href={dueCheques.firstExpenseId ? `/balance-sheet?payable=${dueCheques.firstExpenseId}` : "/balance-sheet"}
              className="max-w-3xl font-display text-lg font-semibold uppercase leading-snug text-white underline decoration-white/40 underline-offset-4 hover:decoration-white sm:text-xl"
            >
              {dueCheques.count === 1
                ? t("shell.cheques_due_one")
                : t("shell.cheques_due", { count: dueCheques.count })}
            </Link>
          </div>
        )}
        <header className="no-print relative z-40 border-b border-[#d7d3c8] bg-[#f3f0e8]/95 px-4 backdrop-blur sm:px-7">
          <div className="flex min-h-20 flex-col gap-3 py-3 lg:flex-row lg:items-center lg:justify-between lg:gap-4">
            <div className="flex min-w-0 items-center gap-3">
              <button onClick={() => setOpen(true)} className="grid size-10 shrink-0 place-items-center border border-[#d7d3c8] lg:hidden" aria-label={t("shell.open_nav")}><Menu size={20} /></button>
              <div className="min-w-0">
                {eyebrow && <p className="truncate text-[10px] font-bold uppercase text-[#167c73]">{eyebrow}</p>}
                <h1 className="break-words font-display text-2xl font-semibold uppercase leading-tight sm:text-4xl sm:leading-none">{title}</h1>
              </div>
            </div>
            <div className="relative z-50 flex min-w-0 flex-wrap items-center gap-2 lg:shrink-0 lg:justify-end">
              <BranchChip />
              {action}
            </div>
          </div>
        </header>
        <div className="page-enter p-4 sm:p-7">{children}</div>
      </main>
    </div>
  );
}
