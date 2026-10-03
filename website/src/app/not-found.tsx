import Link from "next/link";
import type { Metadata } from "next";
import { SvsBrand } from "@/components/branding/SvsBrand";
import { getServerI18n } from "@/i18n/server";

export const metadata: Metadata = { title: "404" };

export default function NotFound() {
  const { t } = getServerI18n();
  return (
    <main className="grid min-h-screen place-items-center bg-page p-6 text-center text-textPrimary">
      <div className="max-w-md">
        <SvsBrand format="square" width={160} height={160} className="mx-auto mb-6 w-28" />
        <p className="font-mono text-xs uppercase tracking-[0.3em] text-accent">404</p>
        <h1 className="mt-3 text-2xl font-bold text-textBright">{t("notFound.title")}</h1>
        <p className="mt-3 text-sm text-textMuted">{t("notFound.body")}</p>
        <div className="mt-6 flex flex-wrap justify-center gap-3">
          <Link href="/dashboard" className="rounded-lg bg-accent px-4 py-2 font-semibold text-page hover:opacity-90">{t("notFound.dashboard")}</Link>
          <Link href="/" className="rounded-lg border border-borderButton px-4 py-2 font-semibold text-textPrimary hover:border-accent hover:text-accent">{t("common.backHome")}</Link>
        </div>
      </div>
    </main>
  );
}
