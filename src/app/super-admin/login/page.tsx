"use client";

import Link from "next/link";
import { FormEvent, useState } from "react";
import { useRouter } from "next/navigation";
import { ArrowLeft, ArrowRight, LockKeyhole, ShieldCheck } from "lucide-react";
import { PasswordInput } from "@/components/ui";
import { LanguageToggle } from "@/components/language-toggle";
import { api, storeSession, User } from "@/lib/api";
import { useLocale, useT } from "@/lib/locale";

export default function SuperAdminLoginPage() {
  const router = useRouter();
  const t = useT();
  const { setLocale } = useLocale();
  const [email, setEmail] = useState("superadmin@bay06.lk");
  const [password, setPassword] = useState("password");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  async function submit(event: FormEvent) {
    event.preventDefault();
    setLoading(true);
    setError("");
    try {
      const result = await api<{ token: string; user: User; features: string[] }>("/auth/login", {
        method: "POST",
        authenticated: false,
        body: JSON.stringify({ email, password }),
      });
      if (result.user.role !== "super_admin") throw new Error(t("auth.wrong_role"));
      storeSession(result.token, result.user, result.features);
      if (result.user.locale === "si" || result.user.locale === "en") {
        await setLocale(result.user.locale);
      }
      router.push("/super-admin/dashboard");
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : t("login.unable_to_sign_in"));
    } finally {
      setLoading(false);
    }
  }

  return (
    <main className="grid min-h-screen lg:grid-cols-[0.9fr_1.1fr]">
      <section className="flex items-center justify-center bg-[#f7f5ee] px-6 py-12">
        <form onSubmit={submit} className="page-enter w-full max-w-md">
          <div className="mb-6 flex items-center justify-between gap-3">
            <Link href="/login" className="inline-flex items-center gap-2 text-xs font-bold uppercase text-[#6f746e]">
              <ArrowLeft size={15} />{t("login.tenant_login")}
            </Link>
          </div>
          <div className="mb-6"><LanguageToggle tone="light" /></div>
          <div className="mb-5 grid size-12 place-items-center bg-[#f5c842]"><ShieldCheck size={24} /></div>
          <p className="text-xs font-bold uppercase text-[#167c73]">{t("login.restricted_access")}</p>
          <h1 className="mt-2 font-display text-5xl font-semibold uppercase leading-none">
            {t("login.control_title_1")}<br />{t("login.control_title_2")}
          </h1>
          <div className="mt-8 space-y-5">
            <label className="block text-sm font-semibold">
              {t("login.email")}
              <input
                type="email"
                required
                value={email}
                onChange={(event) => setEmail(event.target.value)}
                className="mt-2 h-12 w-full border border-[#c9c5b9] bg-white px-4 outline-none focus:border-[#167c73]"
              />
            </label>
            <label className="block text-sm font-semibold">
              {t("login.password")}
              <div className="mt-2">
                <PasswordInput
                  required
                  value={password}
                  onChange={(event) => setPassword(event.target.value)}
                  className="h-12 w-full border border-[#c9c5b9] bg-white outline-none focus:border-[#167c73]"
                  leftIcon={<LockKeyhole size={18} className="absolute left-4 top-3.5 text-[#858a83]" />}
                />
              </div>
            </label>
          </div>
          {error && <p className="mt-4 border-l-4 border-[#b84837] bg-[#b84837]/8 px-3 py-2 text-sm text-[#8d3326]">{error}</p>}
          <button
            disabled={loading}
            className="mt-7 flex h-12 w-full items-center justify-between bg-[#181b19] px-5 font-semibold text-white hover:bg-[#167c73] disabled:opacity-60"
          >
            <span>{loading ? t("login.verifying") : t("login.enter_platform")}</span>
            <ArrowRight size={19} />
          </button>
        </form>
      </section>
      <section className="relative hidden overflow-hidden bg-[#181b19] p-12 text-white lg:flex lg:flex-col lg:justify-between">
        <div className="absolute inset-0 opacity-20" style={{ backgroundImage: "linear-gradient(#f5c842 1px, transparent 1px), linear-gradient(90deg, #f5c842 1px, transparent 1px)", backgroundSize: "64px 64px" }} />
        <div className="relative font-display text-2xl uppercase">Bay 06 Cloud</div>
        <div className="relative">
          <p className="font-display text-8xl font-semibold uppercase leading-[0.82]">
            {t("login.tenants")}<br />{t("login.plans")}<br />{t("login.access")}
          </p>
          <p className="mt-8 max-w-md text-sm leading-6 text-white/50">{t("login.platform_pitch")}</p>
        </div>
        <p className="relative text-xs uppercase text-white/30">{t("login.platform_footer")}</p>
      </section>
    </main>
  );
}
