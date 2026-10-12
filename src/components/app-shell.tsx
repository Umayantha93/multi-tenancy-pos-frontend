"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { ReactNode, useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import { ChevronRight, LogOut, Menu, X } from "lucide-react";
import { api, clearSession, currentFeatures, currentUser, mediaUrl, money, SessionPayload, storeSession, User } from "@/lib/api";
import { profileFor, type NavItem } from "@/lib/business-profiles";
import { groupNavigation } from "@/lib/feature-modules";
import { BranchChip } from "@/components/branch-chip";
import { JobAlertBell } from "@/components/job-alert-bell";
import { LanguageToggle } from "@/components/language-toggle";
import { useLocale, useT } from "@/lib/locale";

let cachedUser: User | null = null;
let cachedFeatures: string[] = [];
let sidebarScrollTop = 0;
let holdSidebarScroll = false;

const NAV_FOLDS_KEY = "garage_nav_folds";

type NavFolds = { groups: Record<string, boolean>; features: Record<string, boolean> };

function pathMatches(pathname: string, href: string) {
  if (pathname === href) return true;
  if (href === "/dashboard") return false;
  return pathname.startsWith(`${href}/`);
}

function readNavFolds(): NavFolds {
  if (typeof window === "undefined") return { groups: {}, features: {} };
  try {
    const raw = localStorage.getItem(NAV_FOLDS_KEY);
    if (!raw) return { groups: {}, features: {} };
    const parsed = JSON.parse(raw) as Partial<NavFolds>;
    return {
      groups: parsed.groups ?? {},
      features: parsed.features ?? {},
    };
  } catch {
    return { groups: {}, features: {} };
  }
}

export function AppShell({ children, title, eyebrow, action }: { children: ReactNode; title: string; eyebrow?: string; action?: ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const t = useT();
  const { setLocale } = useLocale();
  const navRef = useRef<HTMLElement>(null);
  const [user, setUser] = useState<User | null>(cachedUser);
  const [features, setFeatures] = useState<string[]>(cachedFeatures);
  const [open, setOpen] = useState(false);
  const [dueCheques, setDueCheques] = useState<{ count: number; firstExpenseId?: number } | null>(null);
  const [folds, setFolds] = useState<NavFolds>(readNavFolds);

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
    const sessionFeatures = currentFeatures();
    cachedUser = sessionUser;
    cachedFeatures = sessionFeatures;
    setUser(sessionUser);
    setFeatures(sessionFeatures);

    api<SessionPayload>("/user")
      .then((result) => {
        const token = localStorage.getItem("garage_token");
        if (token) storeSession(token, result.user, result.features, {
          branches: result.branches,
          active_branch: result.active_branch,
        });
        cachedUser = result.user;
        cachedFeatures = result.features;
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
    if (!open) return;
    const previous = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = previous;
    };
  }, [open]);

  useEffect(() => {
    if (!user) return;
    const required = navigation.find((item) => {
      if (!pathMatches(pathname, item.href)) return false;
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
    cachedUser = null;
    cachedFeatures = [];
    sidebarScrollTop = 0;
    holdSidebarScroll = false;
    clearSession();
    router.replace("/login");
  }

  const links = navigation.filter((item) => {
    if (item.owner && user?.role !== "business_owner") return false;
    if (item.staffSelf && user?.role === "staff") return true;
    if (item.staffSelf && user?.role !== "staff") return false;
    if (item.feature && !features.includes(item.feature)) return false;
    return true;
  });
  const menu = groupNavigation(links, profile.moduleCatalog);

  useEffect(() => {
    const stored = readNavFolds();
    const next: NavFolds = {
      groups: { ...stored.groups },
      features: { ...stored.features },
    };
    for (const { group, entries } of menu.groups) {
      const active = entries.some(({ item, children }) => routeActive(item.href) || children.some((child) => routeActive(child.href)));
      if (!active) continue;
      next.groups[group] = true;
      for (const { item, children } of entries) {
        if (children.length > 0 && (routeActive(item.href) || children.some((child) => routeActive(child.href)))) {
          next.features[item.href] = true;
        }
      }
    }
    if (menu.account.some((item) => routeActive(item.href))) next.groups.Account = true;
    setFolds(next);
  }, [pathname, links.length]);

  function routeActive(href: string) {
    return pathMatches(pathname, href);
  }

  function sectionActive(entries: Array<{ item: NavItem; children: NavItem[] }>) {
    return entries.some(({ item, children }) => routeActive(item.href) || children.some((child) => routeActive(child.href)));
  }

  function sectionOpen(key: string, active: boolean) {
    if (key in folds.groups) return folds.groups[key];
    return active;
  }

  function featureOpen(href: string, active: boolean) {
    if (href in folds.features) return folds.features[href];
    return active;
  }

  function saveFolds(next: NavFolds) {
    setFolds(next);
    localStorage.setItem(NAV_FOLDS_KEY, JSON.stringify(next));
  }

  function toggleSection(key: string, openNow: boolean) {
    saveFolds({ ...folds, groups: { ...folds.groups, [key]: !openNow } });
  }

  function toggleFeature(href: string, openNow: boolean) {
    saveFolds({ ...folds, features: { ...folds.features, [href]: !openNow } });
  }

  function navLink(item: NavItem, nested = false) {
    const { href, label, icon: Icon } = item;
    const active = routeActive(href);
    return (
      <Link
        key={href}
        href={href}
        data-nav-active={active ? "true" : undefined}
        onClick={() => {
          if (navRef.current) sidebarScrollTop = navRef.current.scrollTop;
          holdSidebarScroll = true;
          setOpen(false);
        }}
        className={`flex min-w-0 flex-1 items-center gap-3 px-3 text-sm transition ${nested ? "h-9" : "h-11"} ${active ? "bg-[#f5c842] font-semibold text-[#20221f]" : "text-white/65 hover:bg-white/8 hover:text-white"}`}
      >
        <Icon size={nested ? 16 : 18} />
        <span className="truncate">{t(`nav.${label}`)}</span>
      </Link>
    );
  }

  useLayoutEffect(() => {
    const el = navRef.current;
    if (!el) return;
    const apply = () => {
      el.scrollTop = sidebarScrollTop;
      const active = el.querySelector<HTMLElement>("[data-nav-active='true']");
      if (!active) return;
      const navRect = el.getBoundingClientRect();
      const itemRect = active.getBoundingClientRect();
      if (itemRect.top < navRect.top || itemRect.bottom > navRect.bottom) {
        el.scrollTop += itemRect.top - navRect.top - 8;
        sidebarScrollTop = el.scrollTop;
      }
    };
    apply();
    const frame = requestAnimationFrame(apply);
    const onScroll = () => {
      if (holdSidebarScroll) {
        if (Math.abs(el.scrollTop - sidebarScrollTop) > 1) el.scrollTop = sidebarScrollTop;
        return;
      }
      sidebarScrollTop = el.scrollTop;
    };
    const release = () => {
      holdSidebarScroll = false;
    };
    el.addEventListener("scroll", onScroll, { passive: true });
    el.addEventListener("wheel", release, { passive: true });
    el.addEventListener("touchstart", release, { passive: true });
    el.addEventListener("pointerdown", release);
    return () => {
      cancelAnimationFrame(frame);
      el.removeEventListener("scroll", onScroll);
      el.removeEventListener("wheel", release);
      el.removeEventListener("touchstart", release);
      el.removeEventListener("pointerdown", release);
    };
  }, [links.length, pathname, folds]);

  const logoUrl = mediaUrl(user?.tenant?.logo_url || user?.tenant?.logo);
  const roleLabel = user?.role ? t(`roles.${user.role}`) : t("shell.account");
  const amountLabel = paymentAmount != null ? money(paymentAmount) : t("shell.plan_amount");

  return (
    <div className="min-h-screen lg:grid lg:grid-cols-[240px_1fr]">
      <aside className={`no-print fixed inset-y-0 left-0 z-50 flex w-[240px] flex-col bg-[#242723] text-white transition-transform lg:sticky lg:top-0 lg:z-auto lg:h-screen lg:translate-x-0 ${open ? "translate-x-0" : "-translate-x-full"}`}>
        <div className="flex h-20 items-center justify-between border-b border-white/10 px-5">
          <Link href="/dashboard" className="flex min-w-0 items-center gap-3">
            {logoUrl ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={logoUrl} alt="" className="size-10 shrink-0 object-contain bg-white/95 p-0.5" />
            ) : (
              // eslint-disable-next-line @next/next/no-img-element
              <img src="/brand/iubits-mark.svg" alt="" className="size-10 shrink-0" />
            )}
            <div className="min-w-0">
              <strong className="block truncate font-display text-xl uppercase">{user?.tenant?.business_name ?? t("shell.business")}</strong>
              <p className="text-[10px] uppercase text-white/40">{t(`ops.${profile.operationsLabel}`)}</p>
            </div>
          </Link>
          <button onClick={() => setOpen(false)} className="lg:hidden" aria-label={t("shell.close_nav")}><X /></button>
        </div>
        <nav ref={navRef} className="sidebar-scroll flex-1 space-y-1 overflow-y-auto overscroll-contain px-3 py-6">
          {menu.pinned.map((item) => navLink(item))}
          {menu.groups.map(({ group, entries }) => {
            const active = sectionActive(entries);
            const open = sectionOpen(group, active);
            return (
              <div key={group} className="pt-3">
                <button
                  type="button"
                  aria-expanded={open}
                  onClick={() => toggleSection(group, open)}
                  className="mb-1 flex h-8 w-full items-center justify-between px-3 text-[10px] font-bold uppercase tracking-wide text-white/35 hover:text-white/70"
                >
                  {t(`nav.${group}`)}
                  <ChevronRight size={14} className={`transition ${open ? "rotate-90" : ""}`} />
                </button>
                {open && entries.map(({ item, children }) => {
                  const parentActive = routeActive(item.href);
                  const nestedActive = parentActive || children.some((child) => routeActive(child.href));
                  const nestedOpen = children.length > 0 && featureOpen(item.href, nestedActive);
                  return (
                    <div key={item.href}>
                      <div className="flex items-center">
                        {navLink(item)}
                        {children.length > 0 && (
                          <button
                            type="button"
                            aria-expanded={nestedOpen}
                            aria-label={t(`nav.${item.label}`)}
                            onClick={() => toggleFeature(item.href, nestedOpen)}
                            className={`grid h-11 w-8 shrink-0 place-items-center ${parentActive ? "bg-[#f5c842] text-[#20221f]" : "text-white/45 hover:text-white"}`}
                          >
                            <ChevronRight size={14} className={`transition ${nestedOpen ? "rotate-90" : ""}`} />
                          </button>
                        )}
                      </div>
                      {nestedOpen && (
                        <div className="mt-1 ml-3 space-y-1 border-l border-white/15 pl-2">
                          {children.map((child) => navLink(child, true))}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            );
          })}
          {menu.account.length > 0 && (() => {
            const active = menu.account.some((item) => routeActive(item.href));
            const open = sectionOpen("Account", active);
            return (
              <div className="pt-3">
                <button
                  type="button"
                  aria-expanded={open}
                  onClick={() => toggleSection("Account", open)}
                  className="mb-1 flex h-8 w-full items-center justify-between px-3 text-[10px] font-bold uppercase tracking-wide text-white/35 hover:text-white/70"
                >
                  {t("nav.Account")}
                  <ChevronRight size={14} className={`transition ${open ? "rotate-90" : ""}`} />
                </button>
                {open && menu.account.map((item) => navLink(item))}
              </div>
            );
          })()}
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
      {open && <button aria-label={t("shell.close_overlay")} onClick={() => setOpen(false)} className="no-print fixed inset-0 z-40 bg-black/45 lg:hidden" />}
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
        <header className="no-print relative z-30 overflow-visible border-b border-[#d7d3c8] bg-[#f3f0e8] px-4 sm:px-7">
          <div className="flex min-h-20 flex-col gap-3 py-3 lg:flex-row lg:items-center lg:justify-between lg:gap-4">
            <div className="flex min-w-0 items-center gap-3">
              <button onClick={() => setOpen(true)} className="grid size-8 shrink-0 place-items-center border border-[#d7d3c8] lg:hidden" aria-label={t("shell.open_nav")}><Menu size={16} /></button>
              <div className="min-w-0">
                {eyebrow && <p className="truncate text-[10px] font-bold uppercase text-[#167c73]">{eyebrow}</p>}
                <h1 className="break-words font-display text-2xl font-semibold uppercase leading-tight sm:text-4xl sm:leading-none">{title}</h1>
              </div>
            </div>
            <div className="relative z-30 flex min-w-0 flex-wrap items-center gap-2 lg:shrink-0 lg:justify-end">
              <JobAlertBell enabled={user?.role === "staff" && features.includes("billing")} />
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
