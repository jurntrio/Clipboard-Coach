import Link from "next/link";
import Image from "next/image";
import type { ReactNode } from "react";
import { getServerI18n } from "@/i18n/server";
import { LegalLinks } from "./LegalLinks";

export function LegalPage({ title, updated, children }: { title: string; updated: string; children: ReactNode }) {
  const { t } = getServerI18n();
  return <div className="min-h-screen bg-page text-textPrimary">
    <header className="border-b border-border bg-black/70 px-4 py-4"><div className="mx-auto flex max-w-4xl items-center justify-between gap-4"><Link href="/" className="flex items-center gap-3"><Image src="/branding/logo.png" alt="" width={40} height={40} /><span className="font-display uppercase text-textBright">Clipboard Coach Studio</span></Link><Link href="/" className="text-sm text-accent hover:underline">&larr; {t("common.backHome")}</Link></div></header>
    <main className="mx-auto max-w-4xl px-5 py-10"><h1 className="font-display text-3xl uppercase text-textBright">{title}</h1><p className="mt-2 text-sm text-textMuted">{updated}</p><article className="legalContent mt-8 space-y-7 text-sm leading-7 text-textSecondary">{children}</article></main>
    <footer className="border-t border-border px-5 py-6"><div className="mx-auto max-w-4xl"><LegalLinks includeReport /></div></footer>
  </div>;
}

export function LegalSection({ title, children }: { title: string; children: ReactNode }) {
  return <section><h2 className="mb-2 text-lg font-semibold text-textBright">{title}</h2><div className="space-y-3">{children}</div></section>;
}
