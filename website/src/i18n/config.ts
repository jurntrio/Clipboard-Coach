export const locales = ["nl", "en"] as const;

export type Locale = (typeof locales)[number];

export const defaultLocale: Locale = "nl";
export const localeCookieName = "clipboard-coach-locale";

export const localeLabels: Record<Locale, string> = {
  nl: "Nederlands",
  en: "English"
};

export function isLocale(value: string | undefined | null): value is Locale {
  return locales.includes(value as Locale);
}

