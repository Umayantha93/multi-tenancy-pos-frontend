"use client";

import { useLocale, type AppLocale } from "@/lib/locale";

export function LanguageToggle({ tone = "dark" }: { tone?: "dark" | "light" }) {
  const { locale, setLocale, t, ready } = useLocale();
  const dark = tone === "dark";
  const sinhala = locale === "si";

  async function choose(next: AppLocale) {
    if (next === locale) return;
    await setLocale(next);
  }

  return (
    <div
      className="mb-2.5 flex items-center justify-between gap-2"
      role="group"
      aria-label={ready ? t("shell.language") : "Language"}
    >
      <span className={`text-[10px] font-bold uppercase tracking-wide ${dark ? "text-white/40" : "text-[#6f746e]"}`}>
        {ready ? t("shell.language") : "Language"}
      </span>
      <div
        className={`relative grid h-7 w-[74px] grid-cols-2 rounded-full p-0.5 ${
          dark ? "bg-white/10" : "bg-[#e8e4da]"
        }`}
      >
        <span
          aria-hidden
          className={`absolute inset-y-0.5 w-[calc(50%-2px)] rounded-full bg-[#f5c842] transition-transform duration-200 ease-out ${
            sinhala ? "translate-x-[calc(100%+2px)]" : "translate-x-0.5"
          }`}
        />
        <button
          type="button"
          onClick={() => choose("en")}
          className={`relative z-10 text-[7px] font-bold leading-none tracking-wide transition-colors ${
            !sinhala ? "text-[#20221f]" : dark ? "text-white/50 hover:text-white" : "text-[#6f746e] hover:text-[#20221f]"
          }`}
          aria-pressed={!sinhala}
          aria-label="English"
        >
          EN
        </button>
        <button
          type="button"
          onClick={() => choose("si")}
          className={`relative z-10 text-[7px] font-bold leading-none tracking-wide transition-colors ${
            sinhala ? "text-[#20221f]" : dark ? "text-white/50 hover:text-white" : "text-[#6f746e] hover:text-[#20221f]"
          }`}
          aria-pressed={sinhala}
          aria-label="සිංහල"
        >
          සිං
        </button>
      </div>
    </div>
  );
}
