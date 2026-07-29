"use client";

import Link from "next/link";
import Image from "next/image";
import { useI18n } from "@/i18n/client";

export function SectionHeader({
  title,
  subtitle,
  artworkSrc,
  backHref,
  showHome = true
}: {
  title: string;
  subtitle?: string;
  artworkSrc?: string;
  backHref?: string;
  showHome?: boolean;
}) {
  const { t } = useI18n();
  return (
    <header className="flex items-center gap-4 mb-5">
      {backHref && <Link href={backHref} title={t("common.back")} className="flex-shrink-0 w-16 h-16 rounded-xl bg-button border border-borderButton flex items-center justify-center hover:border-accent hover:bg-cardHover transition"><Image src="/branding/back.png" alt={t("common.back")} width={38} height={38} /></Link>}
      {showHome && <a
        href="/dashboard"
        title={t("nav.home")}
        className="flex-shrink-0 w-16 h-16 rounded-xl bg-button border border-borderButton flex items-center justify-center hover:border-accent hover:bg-cardHover transition"
      >
        <Image src="/branding/home.png" alt={t("nav.home")} width={38} height={38} />
      </a>}
      <div className="flex-1 flex flex-col items-center text-center">
        <h1 className="font-display uppercase text-2xl text-textBright">{title}</h1>
        {subtitle && <p className="text-textMuted text-sm">{subtitle}</p>}
      </div>
      {artworkSrc && <Image src={artworkSrc} alt="" width={56} height={56} className="flex-shrink-0" />}
    </header>
  );
}
