"use client";

import { createContext, ReactNode, useCallback, useContext, useEffect, useMemo, useState } from "react";
import { api, currentUser, storeSession, type SessionPayload } from "@/lib/api";

export type AppLocale = "en" | "si";

type Messages = Record<string, unknown>;

type LocaleContextValue = {
  locale: AppLocale;
  ready: boolean;
  t: (key: string, replacements?: Record<string, string | number>) => string;
  setLocale: (locale: AppLocale, options?: { persist?: boolean }) => Promise<void>;
};

const STORAGE_KEY = "garage_locale";
const LocaleContext = createContext<LocaleContextValue | null>(null);

function readStoredLocale(): AppLocale {
  if (typeof window === "undefined") return "en";
  const stored = localStorage.getItem(STORAGE_KEY);
  if (stored === "si" || stored === "en") return stored;
  const userLocale = currentUser()?.locale;
  return userLocale === "si" ? "si" : "en";
}

function flatten(input: Messages, prefix = "", out: Record<string, string> = {}): Record<string, string> {
  for (const [key, value] of Object.entries(input)) {
    const next = prefix ? `${prefix}.${key}` : key;
    if (value && typeof value === "object" && !Array.isArray(value)) {
      flatten(value as Messages, next, out);
    } else if (typeof value === "string" || typeof value === "number") {
      out[next] = String(value);
    }
  }
  return out;
}

function applyReplacements(template: string, replacements?: Record<string, string | number>) {
  if (!replacements) return template;
  return Object.entries(replacements).reduce(
    (text, [key, value]) => text.replaceAll(`:${key}`, String(value)),
    template,
  );
}

export function LocaleProvider({ children }: { children: ReactNode }) {
  const [locale, setLocaleState] = useState<AppLocale>("en");
  const [messages, setMessages] = useState<Record<string, string>>({});
  const [ready, setReady] = useState(false);

  const load = useCallback(async (next: AppLocale) => {
    const payload = await api<{ locale: AppLocale; messages: Messages }>(`/translations?locale=${next}`, {
      authenticated: false,
    });
    setLocaleState(payload.locale === "si" ? "si" : "en");
    setMessages(flatten(payload.messages ?? {}));
    localStorage.setItem(STORAGE_KEY, payload.locale === "si" ? "si" : "en");
    if (typeof document !== "undefined") {
      document.documentElement.lang = payload.locale === "si" ? "si" : "en";
    }
  }, []);

  useEffect(() => {
    const initial = readStoredLocale();
    load(initial)
      .catch(() => {
        setLocaleState(initial);
        setMessages({});
      })
      .finally(() => setReady(true));
  }, [load]);

  const setLocale = useCallback(async (next: AppLocale, options?: { persist?: boolean }) => {
    await load(next);
    if (options?.persist === false) return;
    const token = typeof window === "undefined" ? null : localStorage.getItem("garage_token");
    if (!token) return;
    try {
      await api<{ locale: AppLocale }>("/locale", {
        method: "PUT",
        body: JSON.stringify({ locale: next }),
      });
      const session = await api<SessionPayload>("/user");
      storeSession(token, session.user, session.features, {
        branches: session.branches,
        active_branch: session.active_branch,
      });
    } catch {
      /* Local preference still applies if persistence fails. */
    }
  }, [load]);

  const t = useCallback(
    (key: string, replacements?: Record<string, string | number>) => {
      const bare = key.startsWith("ui.") ? key.slice(3) : key;
      const value = messages[bare] ?? messages[key];
      if (!value) {
        const parts = bare.split(".");
        if (parts.length > 1 && (parts[0] === "nav" || parts[0] === "ops" || parts[0] === "roles")) {
          return applyReplacements(parts.slice(1).join("."), replacements);
        }
        return applyReplacements(parts[parts.length - 1] ?? bare, replacements);
      }
      return applyReplacements(value, replacements);
    },
    [messages],
  );

  const value = useMemo(() => ({ locale, ready, t, setLocale }), [locale, ready, t, setLocale]);

  return <LocaleContext.Provider value={value}>{children}</LocaleContext.Provider>;
}

export function useLocale() {
  const context = useContext(LocaleContext);
  if (!context) throw new Error("useLocale must be used within LocaleProvider");
  return context;
}

export function useT() {
  return useLocale().t;
}
