"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { ReactNode, useEffect, useState } from "react";
import { Banknote, Building2, Boxes, CircleUser, Gauge, LogOut, Menu, Plus, ReceiptText, ShieldCheck, X } from "lucide-react";
import { api, clearSession, currentUser } from "@/lib/api";
import { LanguageToggle } from "@/components/language-toggle";
import { useT } from "@/lib/locale";

const links = [
  { href: "/super-admin/dashboard", label: "Platform pulse", icon: Gauge },
  { href: "/super-admin/income", label: "Income", icon: Banknote },
  { href: "/super-admin/tenants", label: "Businesses", icon: Building2 },
  { href: "/super-admin/invoices", label: "Tenants invoices", icon: ReceiptText, prefix: true },
  { href: "/super-admin/inventory", label: "Tenant inventory", icon: Boxes, prefix: true },
  { href: "/super-admin/tenants/new", label: "Onboard tenant", icon: Plus },
  { href: "/super-admin/account", label: "My account", icon: CircleUser },
];

export function PlatformShell({ children, title, eyebrow, action }: { children: ReactNode; title: string; eyebrow?: string; action?: ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const t = useT();
  const [open, setOpen] = useState(false);
  const headerEyebrow = eyebrow ?? t("shell.platform_control");

  useEffect(() => {
    const user = currentUser();
    if (!localStorage.getItem("garage_token") || user?.role !== "super_admin") router.replace("/super-admin/login");
  }, [router]);

  async function logout() {
    try { await api("/auth/logout", { method: "POST" }); } catch { /* Local access still needs to be cleared. */ }
    clearSession(); router.replace("/super-admin/login");
  }

  return <div className="min-h-screen bg-[#ebe8df] lg:grid lg:grid-cols-[252px_1fr]">
    <aside className={`fixed inset-y-0 left-0 z-40 flex w-[252px] flex-col bg-[#181b19] text-white transition-transform lg:sticky lg:top-0 lg:h-screen lg:translate-x-0 ${open ? "translate-x-0" : "-translate-x-full"}`}>
      <div className="flex h-20 items-center justify-between border-b border-white/10 px-5">
        <Link href="/super-admin/dashboard" className="flex items-center gap-3">
          <span className="grid size-10 place-items-center bg-[#f5c842] text-[#181b19]"><ShieldCheck size={21} /></span>
          <div>
            <strong className="font-display text-xl uppercase">Bay 06 Cloud</strong>
            <p className="text-[10px] uppercase text-white/40">{t("shell.saas_operations")}</p>
          </div>
        </Link>
        <button onClick={() => setOpen(false)} className="lg:hidden" aria-label={t("shell.close_nav")}><X /></button>
      </div>
      <nav className="flex-1 space-y-1 px-3 py-6">
        {links.map(({ href, label, icon: Icon, prefix }) => {
          const active = prefix ? pathname.startsWith(href) : pathname === href;
          return (
            <Link
              key={href}
              href={href}
              onClick={() => setOpen(false)}
              className={`flex h-11 items-center gap-3 px-3 text-sm ${active ? "bg-[#f5c842] font-semibold text-[#181b19]" : "text-white/60 hover:bg-white/8 hover:text-white"}`}
            >
              <Icon size={18} />{t(`nav.${label}`)}
            </Link>
          );
        })}
      </nav>
      <div className="border-t border-white/10 p-4">
        <LanguageToggle />
        <p className="mb-1 truncate text-sm font-semibold">{currentUser()?.name ?? t("shell.super_administrator")}</p>
        <p className="mb-3 truncate text-[10px] uppercase text-white/35">{currentUser()?.email ?? t("shell.platform_account")}</p>
        <button onClick={logout} className="flex items-center gap-2 text-sm text-white/60 hover:text-white">
          <LogOut size={16} />{t("shell.sign_out")}
        </button>
      </div>
    </aside>
    {open && <button aria-label={t("shell.close_overlay")} onClick={() => setOpen(false)} className="fixed inset-0 z-30 bg-black/45 lg:hidden" />}
    <main className="min-w-0">
      <header className="relative z-40 flex min-h-20 items-center justify-between border-b border-[#cbc7bc] bg-[#f7f5ee]/95 px-4 backdrop-blur sm:px-7">
        <div className="flex items-center gap-3">
          <button onClick={() => setOpen(true)} className="grid size-10 place-items-center border border-[#cbc7bc] lg:hidden" aria-label={t("shell.open_nav")}><Menu size={20} /></button>
          <div>
            <p className="text-[10px] font-bold uppercase text-[#167c73]">{headerEyebrow}</p>
            <h1 className="font-display text-3xl font-semibold uppercase leading-none sm:text-4xl">{title}</h1>
          </div>
        </div>
        {action}
      </header>
      <div className="page-enter p-4 sm:p-7">{children}</div>
    </main>
  </div>;
}
