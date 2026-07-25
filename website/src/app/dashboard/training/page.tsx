"use client";

import Image from "next/image";
import { SectionHeader } from "@/components/ui/SectionHeader";
import { useI18n } from "@/i18n/client";

export default function TrainingPage() {
  const { t } = useI18n();

  return (
    <div className="mx-auto max-w-6xl p-8">
      <SectionHeader title={t("training.title")} artworkSrc="/branding/training.png" />

      <section className="overflow-hidden rounded-2xl border border-border bg-card text-center">
        <div className="mx-auto flex max-w-2xl flex-col items-center px-6 py-14 sm:py-20">
          <Image
            src="/branding/training.png"
            alt=""
            width={180}
            height={180}
            className="mb-7 h-36 w-36 object-contain sm:h-44 sm:w-44"
            priority
          />
          <p className="font-display text-sm uppercase tracking-[0.2em] text-accent">
            {t("training.eyebrow")}
          </p>
          <h1 className="mt-3 text-3xl font-bold text-textBright">{t("training.title")}</h1>
          <p className="mt-4 max-w-xl text-sm leading-7 text-textSecondary sm:text-base">
            {t("training.body")}
          </p>
        </div>
      </section>
    </div>
  );
}