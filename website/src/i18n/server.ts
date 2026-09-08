import { cookies } from "next/headers";
import { defaultLocale, isLocale, localeCookieName } from "./config";
import { nl, type MessageKey } from "./messages/nl";
import { en } from "./messages/en";

const messages = { nl, en };

export function getServerI18n() {
  const requestedLocale = cookies().get(localeCookieName)?.value;
  const locale = isLocale(requestedLocale) ? requestedLocale : defaultLocale;
  return {
    locale,
    t: (key: MessageKey, values?: Record<string, string | number>) => {
      const template = messages[locale][key] ?? messages[defaultLocale][key];
      return Object.entries(values ?? {}).reduce((result, [name, value]) => result.replaceAll(`{${name}}`, String(value)), template);
    }
  };
}
