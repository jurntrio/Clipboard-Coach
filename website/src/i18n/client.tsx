"use client";

import { createContext, useContext, useMemo, useState } from "react";
import { defaultLocale, isLocale, localeCookieName, type Locale } from "./config";
import { messages, type MessageKey } from "./messages";

type I18nValue = {
  locale: Locale;
  setLocale: (locale: Locale) => void;
  t: (key: MessageKey, values?: Record<string, string | number>) => string;
};

const I18nContext = createContext<I18nValue | null>(null);

export function I18nProvider({ initialLocale, children }: { initialLocale: Locale; children: React.ReactNode }) {
  const [locale, setLocaleState] = useState<Locale>(initialLocale);

  const value = useMemo<I18nValue>(() => ({
    locale,
    setLocale(nextLocale) {
      if (!isLocale(nextLocale)) return;
      document.cookie = `${localeCookieName}=${nextLocale}; Path=/; Max-Age=31536000; SameSite=Lax`;
      document.documentElement.lang = nextLocale;
      setLocaleState(nextLocale);
    },
    t(key, values) {
      const template = messages[locale][key] ?? messages[defaultLocale][key];
      return Object.entries(values ?? {}).reduce((result, [name, value]) => result.replaceAll(`{${name}}`, String(value)), template);
    }
  }), [locale]);

  return <I18nContext.Provider value={value}>{children}</I18nContext.Provider>;
}

export function useI18n() {
  const value = useContext(I18nContext);
  if (!value) throw new Error("useI18n must be used inside I18nProvider");
  return value;
}
