"use client";

import { FormEvent, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { ArrowRight, Building2, LockKeyhole, Store } from "lucide-react";
import { PasswordInput } from "@/components/ui";
import { LanguageToggle } from "@/components/language-toggle";
import { api, mediaUrl, SessionPayload, storeSession } from "@/lib/api";
import { useLocale, useT } from "@/lib/locale";

type Branding = {
  business_name: string | null;
  business_type: string | null;
  logo_url: string | null;
};

export default function LoginPage() {
  const router = useRouter();
  const t = useT();
  const { setLocale } = useLocale();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [branding, setBranding] = useState<Branding | null>(null);

  useEffect(() => {
    if (!email.includes("@")) {
      setBranding(null);
      return;
    }
    const timer = setTimeout(() => {
      api<Branding>(`/auth/branding?email=${encodeURIComponent(email)}`, { authenticated: false })
        .then(setBranding)
        .catch(() => setBranding(null));
    }, 350);
    return () => clearTimeout(timer);
  }, [email]);

  async function submit(event: FormEvent) {
    event.preventDefault();
    setLoading(true);
    setError("");
    try {
      const result = await api<SessionPayload>("/auth/login", {
        method: "POST",
        authenticated: false,
        body: JSON.stringify({ email, password }),
      });
      storeSession(result.token!, result.user, result.features, {
        branches: result.branches,
        active_branch: result.active_branch,
      });
      if (result.user.locale === "si" || result.user.locale === "en") {
        await setLocale(result.user.locale);
      }
      router.push(result.user.role === "super_admin" ? "/super-admin/dashboard" : "/dashboard");
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : t("login.unable_to_sign_in"));
    } finally {
      setLoading(false);
    }
  }

  const logo = mediaUrl(branding?.logo_url);
  const businessLabel = branding?.business_name;

  return (
    <main className="grid min-h-screen lg:grid-cols-[1.15fr_0.85fr]">
      <section className="relative hidden overflow-hidden bg-[#242723] p-12 text-white lg:flex lg:flex-col lg:justify-between">
        <div className="absolute inset-0 opacity-20" style={{ backgroundImage: "repeating-linear-gradient(125deg, transparent 0 36px, #f5c842 37px 38px)" }} />
        <div className="relative flex items-center gap-3">
          {logo ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={logo} alt="" className="h-12 w-auto max-w-[180px] object-contain bg-white/95 p-1" />
          ) : (
            <span className="grid size-11 place-items-center bg-[#f5c842] text-[#20221f]"><Building2 size={23} /></span>
          )}
          <div>
            <strong className="font-display text-2xl uppercase">{businessLabel || "Bay 06"}</strong>
            <p className="text-xs text-white/55">{businessLabel ? t("login.business_login") : t("login.multi_business_pos")}</p>
          </div>
        </div>
        <div className="relative max-w-xl">
          <p className="mb-4 font-display text-lg uppercase text-[#f5c842]">{t("login.one_platform")}</p>
          <h1 className="font-display text-7xl font-semibold uppercase leading-[0.88]">
            {t("login.garages")}<br />{t("login.studios")}<br />{t("login.garments")}<br />{t("login.cottages")}
          </h1>
          <p className="mt-6 max-w-md text-sm leading-6 text-white/55">
            {t("login.pitch")}
          </p>
          <div className="mt-10 flex flex-wrap gap-x-8 gap-y-3 border-t border-white/20 pt-6 text-sm text-white/60">
            <span>{t("login.pos_billing")}</span>
            <span>{t("login.stock_inventory")}</span>
            <span>{t("login.team_payroll")}</span>
            <span>{t("login.finance")}</span>
          </div>
        </div>
        <div className="relative space-y-4">
          <LanguageToggle />
          <p className="text-xs uppercase text-white/35">{t("login.footer")}</p>
        </div>
      </section>

      <section className="flex items-center justify-center px-6 py-12 sm:px-12">
        <form onSubmit={submit} className="page-enter w-full max-w-md">
          <div className="mb-10 flex items-center justify-between gap-3 lg:hidden">
            <div className="flex items-center gap-3">
              {logo ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={logo} alt="" className="h-10 w-auto max-w-[140px] object-contain" />
              ) : (
                <span className="grid size-10 place-items-center bg-[#f5c842]"><Building2 size={21} /></span>
              )}
              <strong className="font-display text-2xl uppercase">{businessLabel || "Bay 06"}</strong>
            </div>
          </div>
          <div className="mb-6 lg:hidden"><LanguageToggle tone="light" /></div>

          <div className="mb-3 flex items-center gap-2 text-sm font-semibold uppercase text-[#167c73]">
            <Store size={17} />{t("login.business_console")}
          </div>
          <h2 className="font-display text-5xl font-semibold uppercase leading-none">
            {t("login.sign_in_title_1")}<br />{t("login.sign_in_title_2")}
          </h2>
          <p className="mt-4 text-sm text-[#6f746e]">
            {businessLabel
              ? t("login.continue_to", { name: businessLabel })
              : t("login.use_business_account")}
          </p>

          <div className="mt-9 space-y-5">
            <label className="block text-sm font-semibold">
              {t("login.email")}
              <input
                value={email}
                onChange={(event) => setEmail(event.target.value)}
                type="email"
                required
                autoComplete="username"
                placeholder="you@business.lk"
                className="mt-2 h-12 w-full border border-[#c9c5b9] bg-[#fbfaf6] px-4 outline-none focus:border-[#167c73]"
              />
            </label>
            <label className="block text-sm font-semibold">
              {t("login.password")}
              <div className="mt-2">
                <PasswordInput
                  value={password}
                  onChange={(event) => setPassword(event.target.value)}
                  required
                  autoComplete="current-password"
                  className="h-12 w-full border border-[#c9c5b9] bg-[#fbfaf6] outline-none focus:border-[#167c73]"
                  leftIcon={<LockKeyhole className="absolute left-4 top-3.5 text-[#858a83]" size={19} />}
                />
              </div>
            </label>
          </div>

          {error && (
            <p className="mt-4 border-l-4 border-[#b84837] bg-[#b84837]/8 px-3 py-2 text-sm text-[#8d3326]">{error}</p>
          )}

          <button
            disabled={loading}
            className="mt-7 flex h-12 w-full items-center justify-between bg-[#20221f] px-5 font-semibold text-white transition hover:bg-[#167c73] disabled:opacity-60"
          >
            <span>{loading ? t("login.signing_in") : t("login.enter_business")}</span>
            <ArrowRight size={19} />
          </button>

          <div className="mt-8 grid grid-cols-2 gap-2 border-t border-[#e2ded4] pt-6 text-center sm:grid-cols-4">
            {[t("login.garages"), t("login.studios"), t("login.garments"), t("login.cottages")].map((label) => (
              <div key={label} className="border border-[#d7d3c8] bg-[#fbfaf6] px-2 py-3">
                <p className="text-[10px] font-bold uppercase tracking-wide text-[#6f746e]">{label.replace(/\.$/, "")}</p>
              </div>
            ))}
          </div>
        </form>
      </section>
    </main>
  );
}
