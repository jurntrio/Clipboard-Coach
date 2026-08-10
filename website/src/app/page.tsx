"use client";

import Image from "next/image";
import Link from "next/link";
import type { ReactNode } from "react";
import { InlineSignIn } from "@/components/auth/InlineSignIn";
import { LanguageSwitcher } from "@/components/ui/LanguageSwitcher";
import { useI18n } from "@/i18n/client";
import { LegalLinks } from "@/components/legal/LegalLinks";
import { SvsBrand } from "@/components/branding/SvsBrand";

export default function HomePage() {
  const { t } = useI18n();
  const features = [
    { icon: "/branding/video-viewer.png", title: t("common.videoViewer"), body: t("home.videoBody") },
    { icon: "/branding/teams.png", title: t("common.teams"), body: t("home.teamsBody") },
    { icon: "/branding/clips.png", title: t("common.clips"), body: t("home.clipsBody") },
    { icon: "/branding/settings.png", title: t("common.settings"), body: t("home.settingsBody") }
  ];
  const productStories = [
    {
      eyebrow: t("home.mediaEyebrow"),
      title: t("home.mediaTitle"),
      body: t("home.mediaBody"),
      points: [t("home.mediaPoint1"), t("home.mediaPoint2"), t("home.mediaPoint3")],
      preview: <MediaPreview />
    },
    {
      eyebrow: t("home.screensEyebrow"),
      title: t("home.screensTitle"),
      body: t("home.screensBody"),
      points: [t("home.screensPoint1"), t("home.screensPoint2"), t("home.screensPoint3")],
      preview: <InfoScreenPreview />
    },
    {
      eyebrow: t("home.drawingEyebrow"),
      title: t("home.drawingTitle"),
      body: t("home.drawingBody"),
      points: [t("home.drawingPoint1"), t("home.drawingPoint2"), t("home.drawingPoint3")],
      preview: <DrawingPreview />
    }
  ];
  return (
    <div className="min-h-screen bg-page">
      <header className="sticky top-0 z-20 bg-page border-b border-border">
        <div className="max-w-5xl mx-auto px-4 sm:px-6 py-3 sm:py-4 flex items-center justify-between gap-3">
          <div className="flex min-w-0 items-center gap-2">
            <SvsBrand format="square" width={40} height={40} className="h-10 w-10 rounded-lg" />
            <span className="hidden min-[390px]:inline font-display uppercase tracking-wide text-textBright text-sm">
              Sport <span className="text-accent">Visual</span> Systems
            </span>
          </div>
          <div className="hidden md:flex items-center gap-3">
            <a href="#mogelijkheden" className="mr-2 text-sm font-semibold text-textSecondary hover:text-accent">{t("home.discover")}</a>
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
        <section className="relative mx-auto max-w-5xl overflow-hidden px-5 pb-14 pt-10 text-center sm:px-6 sm:pb-20 sm:pt-16">
          <div aria-hidden="true" className="absolute left-1/2 top-16 h-72 w-72 -translate-x-1/2 rounded-full bg-accent/10 blur-3xl" />
          <SvsBrand format="square" width={320} height={320} className="relative mx-auto mb-4 w-44 sm:mb-6 sm:w-56" priority />
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

        <section id="mogelijkheden" className="border-y border-border bg-cardDeep/60 py-16 sm:py-24">
          <div className="mx-auto max-w-5xl px-6">
            <div className="mx-auto mb-12 max-w-2xl text-center">
              <p className="mb-2 font-mono text-xs uppercase tracking-[0.3em] text-accent">{t("home.platformEyebrow")}</p>
              <h2 className="font-display text-3xl uppercase text-textBright sm:text-4xl">{t("home.platformTitle")}</h2>
              <p className="mt-4 text-textSecondary">{t("home.platformBody")}</p>
            </div>
            <div className="space-y-8 sm:space-y-12">
              {productStories.map((story, index) => (
                <article key={story.title} className="grid items-center gap-8 rounded-2xl border border-border bg-card p-5 shadow-2xl shadow-black/10 sm:p-8 lg:grid-cols-2">
                  <div className={index % 2 ? "lg:order-2" : ""}>
                    <p className="font-mono text-xs font-bold uppercase tracking-[0.22em] text-accent">{story.eyebrow}</p>
                    <h3 className="mt-3 font-display text-2xl uppercase text-textBright sm:text-3xl">{story.title}</h3>
                    <p className="mt-4 leading-relaxed text-textSecondary">{story.body}</p>
                    <ul className="mt-5 space-y-3">
                      {story.points.map(point => <li key={point} className="flex gap-3 text-sm text-textPrimary"><span className="mt-0.5 text-accent">✓</span><span>{point}</span></li>)}
                    </ul>
                  </div>
                  <div className={index % 2 ? "lg:order-1" : ""}>{story.preview}</div>
                </article>
              ))}
            </div>
          </div>
        </section>

        <section className="mx-auto max-w-5xl px-6 py-16 text-center sm:py-24">
          <div className="rounded-2xl border border-accent/30 bg-accent/10 px-6 py-10 sm:px-12">
            <h2 className="font-display text-3xl uppercase text-textBright">{t("home.ctaTitle")}</h2>
            <p className="mx-auto mt-3 max-w-xl text-textSecondary">{t("home.ctaBody")}</p>
            <Link href="/signup" className="mt-7 inline-flex rounded-xl bg-accent px-6 py-3 font-bold text-page hover:opacity-90">{t("home.register")}</Link>
          </div>
        </section>
      </main>

      <footer className="border-t border-border py-8">
        <div className="max-w-5xl mx-auto px-6 flex flex-wrap items-center justify-between gap-3 text-textMuted text-sm">
          <div className="flex items-center gap-2">
            <SvsBrand format="square" width={28} height={28} className="h-7 w-7 rounded" />
            <span>Sport Visual Systems</span>
          </div>
          <span>{t("home.tagline")}</span><LegalLinks />
        </div>
      </footer>
    </div>
  );
}

function PreviewShell({ label, children }: { label: string; children: ReactNode }) {
  return <div className="overflow-hidden rounded-xl border border-borderButton bg-[#0d120e] shadow-2xl shadow-black/30">
    <div className="flex items-center gap-1.5 border-b border-white/10 px-3 py-2"><span className="h-2 w-2 rounded-full bg-red-400" /><span className="h-2 w-2 rounded-full bg-amber-400" /><span className="h-2 w-2 rounded-full bg-green-400" /><span className="ml-2 text-[10px] uppercase tracking-widest text-white/40">{label}</span></div>
    {children}
  </div>;
}

function MediaPreview() {
  return <PreviewShell label="Media studio"><div className="grid grid-cols-[1.35fr_.65fr] gap-3 p-4">
    <div className="relative aspect-video overflow-hidden rounded-lg bg-gradient-to-br from-green-950 via-green-700 to-lime-400 p-4"><div className="absolute inset-x-4 bottom-4"><span className="rounded bg-black/70 px-2 py-1 text-[10px] font-bold uppercase text-white">Matchday</span><p className="mt-2 text-xl font-black uppercase leading-none text-white">Klaar voor<br />de aftrap</p></div></div>
    <div className="space-y-2"><div className="rounded-lg border border-white/10 bg-white/5 p-3"><span className="text-[9px] uppercase text-white/40">Berichten</span><strong className="mt-1 block text-lg text-white">12</strong></div><div className="rounded-lg border border-accent/30 bg-accent/10 p-3"><span className="text-[9px] uppercase text-accent">Publicatie</span><strong className="mt-1 block text-xs text-white">Klaar</strong></div></div>
  </div></PreviewShell>;
}

function InfoScreenPreview() {
  return <PreviewShell label="Club TV"><div className="aspect-video bg-gradient-to-br from-[#111a12] to-[#21361d] p-5">
    <div className="flex items-center justify-between"><span className="text-xs font-black uppercase tracking-widest text-white">Club TV</span><span className="rounded-full bg-accent px-2 py-1 text-[9px] font-bold text-black">LIVE</span></div>
    <div className="mt-5 grid grid-cols-3 gap-2 text-center"><div className="rounded-lg bg-white/5 p-3"><span className="text-[9px] text-white/50">THUIS</span><strong className="mt-1 block text-white">U13 A</strong></div><div className="grid place-items-center text-2xl font-black text-accent">2–1</div><div className="rounded-lg bg-white/5 p-3"><span className="text-[9px] text-white/50">UIT</span><strong className="mt-1 block text-white">KSV</strong></div></div>
    <div className="mt-4 flex items-center justify-between border-t border-white/10 pt-3 text-[10px] text-white/60"><span>Volgende: U15 · 18:30</span><span>Veld 1</span></div>
  </div></PreviewShell>;
}

function DrawingPreview() {
  return <PreviewShell label="Analyse"><div className="p-3"><div className="mb-3 flex gap-2"><span className="rounded bg-accent px-2 py-1 text-[9px] font-bold text-black">Pijl</span><span className="rounded bg-white/10 px-2 py-1 text-[9px] text-white/60">Cirkel</span><span className="rounded bg-white/10 px-2 py-1 text-[9px] text-white/60">Tekst</span></div>
    <svg viewBox="0 0 480 270" role="img" aria-label="Voetbalanalyse met looplijnen" className="w-full rounded-lg bg-[#245f30]">
      <g fill="none" stroke="rgba(255,255,255,.55)" strokeWidth="2"><rect x="8" y="8" width="464" height="254" rx="3" /><path d="M240 8v254" /><circle cx="240" cy="135" r="42" /><path d="M8 67h62v136H8M472 67h-62v136h62" /></g>
      <g fill="#71d52b" stroke="#10200d" strokeWidth="3"><circle cx="126" cy="82" r="10" /><circle cx="166" cy="188" r="10" /><circle cx="300" cy="98" r="10" /></g>
      <g fill="none" stroke="#f8f41b" strokeLinecap="round" strokeWidth="7"><path d="M137 84c54 5 78 26 111 50" /><path d="m236 119 14 16-20 5" /></g>
      <circle cx="301" cy="98" r="25" fill="none" stroke="#ff4f4f" strokeWidth="6" />
    </svg>
  </div></PreviewShell>;
}
