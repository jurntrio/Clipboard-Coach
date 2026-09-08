import type { Locale } from "./config";
import type { MessageKey } from "./messages/nl";

export type Messages = Record<MessageKey, string>;
export type { MessageKey };

export async function loadMessages(locale: Locale): Promise<Messages> {
  if (locale === "en") return (await import("./messages/en")).en;
  return (await import("./messages/nl")).nl;
}
