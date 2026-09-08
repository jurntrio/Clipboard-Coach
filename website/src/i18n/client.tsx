"use client";

import { createContext, useContext, useEffect, useMemo, useRef, useState } from "react";
import { isLocale, localeCookieName, type Locale } from "./config";
import { loadMessages, type MessageKey, type Messages } from "./messages";

type I18nValue = {
  locale: Locale;
  setLocale: (locale: Locale) => void;
  t: (key: MessageKey, values?: Record<string, string | number>) => string;
};

const I18nContext = createContext<I18nValue | null>(null);

export function I18nProvider({ initialLocale, initialMessages, children }: { initialLocale: Locale; initialMessages: Messages; children: React.ReactNode }) {
  const [locale, setLocaleState] = useState<Locale>(initialLocale);
  const [activeMessages, setActiveMessages] = useState<Messages>(initialMessages);
  const changeId = useRef(0);

  async function switchLocale(nextLocale: Locale, persist = true) {
    const requestId = ++changeId.current;
    const nextMessages = await loadMessages(nextLocale);
    if (requestId !== changeId.current) return;
    if (persist) document.cookie = `${localeCookieName}=${nextLocale}; Path=/; Max-Age=31536000; SameSite=Lax`;
    document.documentElement.lang = nextLocale;
    setActiveMessages(nextMessages);
    setLocaleState(nextLocale);
  }

  useEffect(() => {
    const cookieLocale = document.cookie
      .split("; ")
      .find((cookie) => cookie.startsWith(`${localeCookieName}=`))
      ?.split("=")[1];
    if (isLocale(cookieLocale) && cookieLocale !== initialLocale) void switchLocale(cookieLocale, false);
  }, [initialLocale]);

  const value = useMemo<I18nValue>(() => ({
    locale,
    setLocale(nextLocale) {
      if (!isLocale(nextLocale)) return;
      void switchLocale(nextLocale);
    },
    t(key, values) {
      const template = activeMessages[key] ?? key;
      return Object.entries(values ?? {}).reduce((result, [name, value]) => result.replaceAll(`{${name}}`, String(value)), template);
    }
  }), [activeMessages, locale]);

  return <I18nContext.Provider value={value}>{children}</I18nContext.Provider>;
}

export function useI18n() {
  const value = useContext(I18nContext);
  if (!value) throw new Error("useI18n must be used inside I18nProvider");
  return value;
}
