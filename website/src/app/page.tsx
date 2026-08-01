"use client";

import Image from "next/image";
import Link from "next/link";
import { InlineSignIn } from "@/components/auth/InlineSignIn";
import { LanguageSwitcher } from "@/components/ui/LanguageSwitcher";
import { useI18n } from "@/i18n/client";
import { LegalLinks } from "@/components/legal/LegalLinks";

export default function HomePage() {
  const { t } = useI18n();
  const features = [
    { icon: "/branding/video-viewer.png", title: t("common.videoViewer"), body: t("home.videoBody") },
    { icon: "/branding/teams.png", title: t("common.teams"), body: t("home.teamsBody") },
    { icon: "/branding/clips.png", title: t("common.clips"), body: t("home.clipsBody") },
    { icon: "/branding/settings.png", title: t("common.settings"), body: t("home.settingsBody") }
  ];
  return (
    <div className="min-h-screen bg-page">
      <header className="sticky top-0 z-20 bg-page border-b border-border">
        <div className="max-w-5xl mx-auto px-4 sm:px-6 py-3 sm:py-4 flex items-center justify-between gap-3">
          <div className="flex min-w-0 items-center gap-2">
            <Image src="/branding/logo.png" alt="" width={36} height={36} className="rounded" />
            <span className="hidden min-[390px]:inline font-display uppercase tracking-wide text-textBright text-sm">
              Clipboard <span className="text-accent">Coach</span> Studio
            </span>
          </div>
          <div className="hidden md:flex items-center gap-3">
            <LanguageSwitcher compact />
            <InlineSignIn />
            <Link href="/signup" className="px-4 py-2 rounded-lg border border-borderButton text-textPrimary text-sm font-semibold hover:border-accent hover:text-accent">
              {t("home.register")}
            </Link>
          </div>
          <nav className="flex items-center gap-2 md:hidden" aria-label={t("nav.account")}>
            <Link href="/login" className="rounded-lg border border-borderButton px-3 py-2 text-sm font-semibold text-textPrimary hover:border-accent hover:text-accent">
              {t("home.signIn")}
            </Link>
            <Link href="/signup" className="rounded-lg bg-accent px-3 py-2 text-sm font-semibold text-page hover:opacity-90">
              {t("home.register")}
            </Link>
          </nav>
        </div>
      </header>

      <main>
        <section className="max-w-3xl mx-auto px-5 sm:px-6 pt-10 sm:pt-16 pb-10 text-center">
          <Image src="/branding/banner.png" alt="Clipboard Coach Studio" width={640} height={200} className="mx-auto mb-6 sm:mb-8" priority />
          <p className="font-mono text-xs tracking-[0.3em] uppercase text-accent mb-4">{t("home.tagline")}</p>
          <h1 className="font-display uppercase text-3xl min-[390px]:text-4xl sm:text-5xl leading-[0.95] text-textBright">
            {t("home.heroTitle")}
          </h1>
          <p className="max-w-xl mx-auto mt-5 text-textSecondary text-lg">
            {t("home.intro")}
          </p>
          <div className="flex gap-3 justify-center flex-wrap mt-8">
            <Link href="/signup" className="px-6 py-3 rounded-xl bg-accent text-page font-bold hover:opacity-90">
              {t("home.start")}
            </Link>
            <Link href="/login" className="px-6 py-3 rounded-xl border border-borderButton text-textPrimary font-bold hover:border-accent">
              {t("home.signIn")}
            </Link>
          </div>
        </section>

        <section className="max-w-5xl mx-auto px-6 py-16">
          <div className="text-center max-w-xl mx-auto mb-12">
            <p className="font-mono text-xs tracking-[0.3em] uppercase text-accent mb-2">{t("home.roomsEyebrow")}</p>
            <h2 className="font-display uppercase text-3xl text-textBright">{t("home.roomsTitle")}</h2>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5">
            {features.map((feature) => (
              <div
                key={feature.title}
                className="bg-card border border-border rounded-xl p-6 text-center hover:border-accent transition"
              >
                <Image src={feature.icon} alt="" width={72} height={72} className="mx-auto mb-3" />
                <h3 className="font-display uppercase text-textBright text-lg mb-1">{feature.title}</h3>
                <p className="text-textMuted text-sm">{feature.body}</p>
              </div>
            ))}
          </div>
        </section>
      </main>

      <footer className="border-t border-border py-8">
        <div className="max-w-5xl mx-auto px-6 flex flex-wrap items-center justify-between gap-3 text-textMuted text-sm">
          <div className="flex items-center gap-2">
            <Image src="/branding/logo.png" alt="" width={24} height={24} className="rounded" />
            <span>Clipboard Coach Studio</span>
          </div>
          <span>{t("home.tagline")}</span><LegalLinks />
        </div>
      </footer>
    </div>
  );
}
