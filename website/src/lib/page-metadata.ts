import type { Metadata } from "next";
import { getServerI18n } from "@/i18n/server";
import type { MessageKey } from "@/i18n/messages/nl";

// Gives a page its own browser-tab title in the user's language, rendered
// through the root "%s | Sport Visual Systems" template. Reads only the locale
// cookie, so it adds no database or network work to the request.
export function pageTitle(key: MessageKey) {
  return async function generateMetadata(): Promise<Metadata> {
    return { title: getServerI18n().t(key) };
  };
}
