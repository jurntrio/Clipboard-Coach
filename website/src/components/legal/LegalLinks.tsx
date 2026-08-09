"use client";

import Link from "next/link";
import { useI18n } from "@/i18n/client";

export function LegalLinks({ includeReport = false }: { includeReport?: boolean }) {
  const { t } = useI18n();
  return <nav className="flex flex-wrap justify-center gap-x-4 gap-y-2 text-xs text-textMuted">
    <Link href="/privacy" className="hover:text-accent">{t("legal.privacy")}</Link>
    <Link href="/terms" className="hover:text-accent">{t("legal.terms")}</Link>
    <Link href="/children-and-images" className="hover:text-accent">{t("legal.children")}</Link>
    {includeReport && <a href="mailto:info@sportvisualsystems.com?subject=Sport%20Visual%20Systems%20privacy%20report" className="hover:text-accent">{t("legal.report")}</a>}
  </nav>;
}
