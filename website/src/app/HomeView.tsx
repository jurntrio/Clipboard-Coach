"use client";

import Image from "next/image";
import Link from "next/link";
import { useEffect, useState, type ReactNode } from "react";
import { LanguageSwitcher } from "@/components/ui/LanguageSwitcher";
import { useI18n } from "@/i18n/client";
import { LegalLinks } from "@/components/legal/LegalLinks";
import { SvsBrand } from "@/components/branding/SvsBrand";
import { createClient } from "@/lib/supabase/client";

export function HomeView() {
  const { t } = useI18n();
  const [signedInAs, setSignedInAs] = useState<string | null>(null);
  const [switchingAccount, setSwitchingAccount] = useState(false);

  useEffect(() => {
    const supabase = createClient();
    void supabase.auth.getUser().then(async ({ data }) => {
      if (!data.user) return;
      const { data: profile } = await supabase.from("profiles").select("full_name").eq("id", data.user.id).maybeSingle();
      setSignedInAs(profile?.full_name?.trim() || data.user.email || "account");
    });
  }, []);

  async function switchAccount() {
    setSwitchingAccount(true);
    const response = await fetch("/api/auth/logout", { method: "POST" });
    if (response.ok) window.location.assign("/login");
    else setSwitchingAccount(false);
  }
  const features = [
    { icon: "/branding/video-viewer.png", title: t("common.videoViewer"), body: t("home.videoBody") },
    { icon: "/branding/teams.png", title: t("common.teams"), body: t("home.teamsBody") },
    { icon: "/branding/training.png", title: t("home.trainingFeatureTitle"), body: t("home.trainingFeatureBody") },
    { icon: "/branding/intradesk.png", title: t("home.intradeskFeatureTitle"), body: t("home.intradeskFeatureBody") }
  ];
  const productStories = [
    {
      eyebrow: t("home.mediaEyebrow"),
      title: t("home.mediaTitle"),
      body: t("home.mediaBody"),
      points: [t("home.mediaPoint1"), t("home.mediaPoint2"), t("home.mediaPoint3")],
      preview: <TrainingPreview />
    },
    {
      eyebrow: t("home.screensEyebrow"),
      title: t("home.screensTitle"),
      body: t("home.screensBody"),
      points: [t("home.screensPoint1"), t("home.screensPoint2"), t("home.screensPoint3")],
      preview: <VideoPreview />
    },
    {
      eyebrow: t("home.drawingEyebrow"),
      title: t("home.drawingTitle"),
      body: t("home.drawingBody"),
      points: [t("home.drawingPoint1"), t("home.drawingPoint2"), t("home.drawingPoint3")],
      preview: <IntradeskPreview />
    },
    {
      eyebrow: t("home.statisticsEyebrow"),
      title: t("home.statisticsTitle"),
      body: t("home.statisticsBody"),
      points: [t("home.statisticsPoint1"), t("home.statisticsPoint2"), t("home.statisticsPoint3")],
      preview: <StatisticsPreview />
    }
  ];
  return (
    <div className="min-h-screen bg-page">
      <header className="sticky top-0 z-20 bg-page border-b border-border">
        <div className="mx-auto flex max-w-7xl items-center justify-between gap-5 px-4 py-3 sm:px-6 sm:py-4">
          <div className="flex min-w-0 items-center gap-2">
            <SvsBrand format="square" width={40} height={40} className="h-10 w-10 rounded-lg" />
            <span className="hidden whitespace-nowrap font-display text-sm uppercase tracking-wide text-textBright min-[390px]:inline">
              Sport <span className="text-accent">Visual</span> Systems
            </span>
          </div>
          <div className="hidden min-w-0 flex-1 items-center justify-end gap-3 xl:flex">
            <a href="#mogelijkheden" className="mr-2 whitespace-nowrap text-sm font-semibold text-textSecondary hover:text-accent">{t("home.discover")}</a>
            <LanguageSwitcher compact />
            <Link href={signedInAs ? "/dashboard" : "/login"} className="px-4 py-2 rounded-lg border border-borderButton text-textPrimary text-sm font-semibold hover:border-accent hover:text-accent">
              {signedInAs ? "Naar dashboard" : t("home.signIn")}
            </Link>
            {!signedInAs && <Link href="/signup" className="px-4 py-2 rounded-lg bg-accent text-page text-sm font-semibold hover:opacity-90">{t("home.register")}</Link>}
          </div>
          <nav className="flex items-center gap-2 xl:hidden" aria-label={t("nav.account")}>
            <LanguageSwitcher compact />
            <Link href={signedInAs ? "/dashboard" : "/login"} className="rounded-lg border border-borderButton px-3 py-2 text-sm font-semibold text-textPrimary hover:border-accent hover:text-accent">
              {signedInAs ? "Dashboard" : t("home.signIn")}
            </Link>
            {!signedInAs && <Link href="/signup" className="rounded-lg bg-accent px-3 py-2 text-sm font-semibold text-page hover:opacity-90">{t("home.register")}</Link>}
          </nav>
        </div>
      </header>

      {signedInAs && <div className="border-b border-accent/20 bg-accent/10">
        <div className="mx-auto flex max-w-7xl flex-wrap items-center justify-center gap-x-3 gap-y-1 px-4 py-2 text-center text-sm text-textSecondary sm:justify-end sm:px-6">
          <span>Aangemeld als <strong className="text-textBright">{signedInAs}</strong></span>
          <button type="button" disabled={switchingAccount} onClick={() => void switchAccount()} className="font-semibold text-accent underline underline-offset-4 disabled:opacity-50">
            {switchingAccount ? "Afmelden…" : "Aanmelden met een ander account"}
          </button>
        </div>
      </div>}

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
            <Link href={signedInAs ? "/dashboard" : "/signup"} className="px-6 py-3 rounded-xl bg-accent text-page font-bold hover:opacity-90">
              {signedInAs ? "Verdergaan als huidige gebruiker" : t("home.start")}
            </Link>
            <Link href={signedInAs ? "/dashboard" : "/login"} className="px-6 py-3 rounded-xl border border-borderButton text-textPrimary font-bold hover:border-accent">
              {signedInAs ? "Naar dashboard" : t("home.signIn")}
            </Link>
          </div>
          <div className="relative mt-12 sm:mt-16">
            <HeroProductPreview />
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
            <Link href={signedInAs ? "/dashboard" : "/signup"} className="mt-7 inline-flex rounded-xl bg-accent px-6 py-3 font-bold text-page hover:opacity-90">{signedInAs ? "Naar dashboard" : t("home.register")}</Link>
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

function HeroProductPreview() {
  return <div className="mx-auto max-w-4xl rotate-[.25deg] rounded-2xl border border-white/10 bg-[#0b100c] p-2 shadow-[0_35px_90px_rgba(0,0,0,.45)] sm:p-3">
    <div className="grid min-h-[280px] grid-cols-[52px_1fr] overflow-hidden rounded-xl border border-white/10 bg-[#111712] text-left sm:grid-cols-[150px_1fr]">
      <aside className="border-r border-white/10 bg-black/20 p-2 sm:p-4"><SvsBrand format="square" width={36} height={36} className="mb-6 h-9 w-9 rounded" /><div className="space-y-2">{["Home", "Wedstrijden", "Training", "Intradesk", "Statistieken"].map((item, i) => <div key={item} className={`flex items-center gap-2 rounded-lg px-2 py-2 text-[10px] ${i === 2 ? "bg-accent text-black" : "text-white/50"}`}><span className="h-2 w-2 shrink-0 rounded-sm border border-current" /><span className="hidden sm:inline">{item}</span></div>)}</div></aside>
      <div className="p-4 sm:p-6"><div className="flex items-end justify-between"><div><span className="text-[9px] uppercase tracking-[.24em] text-accent">Teamomgeving</span><h2 className="mt-1 text-lg font-black uppercase text-white sm:text-2xl">Alles voor je volgende training</h2></div><span className="hidden rounded-lg bg-accent px-3 py-2 text-[10px] font-bold text-black sm:block">+ Nieuwe training</span></div><div className="mt-5 grid gap-3 sm:grid-cols-[1.35fr_.65fr]"><TrainingPitch compact /><div className="grid grid-cols-2 gap-2 sm:grid-cols-1"><MiniMetric label="Aanwezig" value="17/19" /><MiniMetric label="Oefeningen" value="6" /><MiniMetric label="Duur" value="90 min" /></div></div></div>
    </div>
  </div>;
}

function TrainingPreview() {
  return <ProductScreenshot
    src="/branding/landing-training-drawing.png"
    alt="SVS trainingstekentool met een uitgewerkte warming-up op het voetbalveld"
    width={1872}
    height={1239}
  />;
}

function VideoPreview() {
  return <ProductScreenshot
    src="/branding/landing-video-viewer.png"
    alt="SVS video viewer met wedstrijdbeeld, tijdlijn, cliptags en tagoverzicht"
    width={2559}
    height={1167}
  />;
}

function IntradeskPreview() {
  return <PreviewShell label="Intradesk · Oefenbibliotheek"><div className="p-4"><div className="mb-3 flex items-center justify-between"><strong className="text-xs uppercase text-white">Mijn oefeningen</strong><span className="rounded bg-accent px-2 py-1 text-[9px] font-bold text-black">+ Toevoegen</span></div><div className="grid grid-cols-3 gap-2">{[["Positiespel", "8 min"], ["Omschakeling", "12 min"], ["Afwerken", "10 min"]].map(([name, duration], i) => <div key={name} className="overflow-hidden rounded-lg border border-white/10 bg-white/5"><div className={`relative aspect-[4/3] ${i === 1 ? "bg-[#245f30]" : "bg-[#1b4d28]"}`}><span className="absolute left-1/2 top-1/2 h-5 w-5 -translate-x-1/2 -translate-y-1/2 rounded-full border border-white/40" /><span className="absolute left-2 top-2 h-2 w-2 rounded-full bg-accent" /></div><div className="p-2"><strong className="block text-[9px] text-white">{name}</strong><span className="text-[8px] text-white/40">{duration}</span></div></div>)}</div><div className="mt-3 flex gap-2 text-[8px] text-white/50"><span className="rounded-full bg-white/10 px-2 py-1">U13–U15</span><span className="rounded-full bg-white/10 px-2 py-1">Balbezit</span><span className="rounded-full bg-white/10 px-2 py-1">Favorieten</span></div></div></PreviewShell>;
}

function StatisticsPreview() {
  return <ProductScreenshot
    src="/branding/landing-training-statistics.png"
    alt="SVS trainingsstatistieken met aanwezigheden per speler"
    width={1556}
    height={1016}
  />;
}

function ProductScreenshot({ src, alt, width, height }: { src: string; alt: string; width: number; height: number }) {
  return <div className="overflow-hidden rounded-xl border border-borderButton bg-white shadow-2xl shadow-black/30">
    <Image src={src} alt={alt} width={width} height={height} sizes="(min-width: 1024px) 448px, 90vw" className="h-auto w-full" />
  </div>;
}

function TrainingPitch({ compact = false }: { compact?: boolean }) {
  return <div className={`relative overflow-hidden rounded-lg border border-white/10 bg-[#245f30] ${compact ? "min-h-40" : "aspect-[4/3]"}`}><div className="absolute inset-3 border border-white/40"><span className="absolute left-1/2 top-0 h-full border-l border-white/40" /><span className="absolute left-1/2 top-1/2 h-12 w-12 -translate-x-1/2 -translate-y-1/2 rounded-full border border-white/40" /></div>{[[25, 28], [42, 67], [67, 36], [78, 72], [55, 48]].map(([left, top], i) => <span key={i} className={`absolute h-3 w-3 rounded-full border-2 border-black ${i > 2 ? "bg-amber-300" : "bg-accent"}`} style={{ left: `${left}%`, top: `${top}%` }} />)}<svg viewBox="0 0 100 70" className="absolute inset-0 h-full w-full"><path d="M28 31 Q43 37 54 47" fill="none" stroke="#f8f41b" strokeWidth="2" strokeDasharray="3 2" /><path d="m51 43 4 4-6 1" fill="none" stroke="#f8f41b" strokeWidth="2" /></svg></div>;
}

function MiniMetric({ label, value }: { label: string; value: string }) {
  return <div className="rounded-lg border border-white/10 bg-white/5 p-3"><span className="block text-[8px] uppercase tracking-wider text-white/40">{label}</span><strong className="mt-1 block text-sm text-white">{value}</strong></div>;
}
