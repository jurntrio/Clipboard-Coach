"use client";

import Link from "next/link";
import { useEffect, useState, type ReactNode } from "react";
import { SvsBrand } from "@/components/branding/SvsBrand";
import { LegalLinks } from "@/components/legal/LegalLinks";
import { createClient } from "@/lib/supabase/client";

const benefits = [
  {
    number: "01",
    title: "Sponsors zichtbaar",
    body: "Geef hoofd-, team- en wedstrijdsponsors een vaste plaats in de clubbeleving.",
  },
  {
    number: "02",
    title: "Altijd actueel",
    body: "Wedstrijden, scores, spelers en clubberichten worden vanuit één beheeromgeving bijgewerkt.",
  },
  {
    number: "03",
    title: "Op elk scherm",
    body: "Open één beveiligde schermlink op een smart-tv, mini-pc of browser en laat de carrousel draaien.",
  },
];

export function ClubTvLanding() {
  const [signedIn, setSignedIn] = useState(false);

  useEffect(() => {
    const supabase = createClient();
    void supabase.auth.getUser().then(({ data }) => setSignedIn(Boolean(data.user)));
  }, []);

  const manageHref = signedIn ? "/dashboard/media" : "/login";

  return (
    <div className="min-h-screen overflow-hidden bg-[#06110d] text-white">
      <header className="relative z-30 border-b border-white/10 bg-[#06110d]/90 backdrop-blur-xl">
        <div className="mx-auto flex max-w-7xl items-center justify-between gap-5 px-5 py-4 sm:px-8">
          <Link href="/" aria-label="Sport Visual Systems home" className="flex items-center gap-3">
            <SvsBrand format="square" width={44} height={44} className="h-11 w-11 rounded-xl" priority />
            <span>
              <span className="block font-display text-sm uppercase tracking-[.12em]">SVS Club TV</span>
              <span className="block text-[10px] uppercase tracking-[.22em] text-emerald-300/70">Powered by Sport Visual Systems</span>
            </span>
          </Link>
          <nav className="flex items-center gap-2" aria-label="Club TV account">
            <Link href="#mogelijkheden" className="hidden px-3 py-2 text-sm font-semibold text-white/70 hover:text-white sm:inline-flex">
              Mogelijkheden
            </Link>
            <Link href={manageHref} className="rounded-lg border border-emerald-300/35 px-4 py-2 text-sm font-bold text-emerald-200 hover:bg-emerald-300/10">
              {signedIn ? "Club TV beheren" : "Aanmelden"}
            </Link>
          </nav>
        </div>
      </header>

      <main>
        <section className="relative isolate">
          <div aria-hidden="true" className="absolute inset-0 -z-10 bg-[radial-gradient(circle_at_18%_18%,rgba(50,180,106,.24),transparent_34%),radial-gradient(circle_at_82%_55%,rgba(113,213,43,.12),transparent_30%)]" />
          <div className="mx-auto grid max-w-7xl items-center gap-12 px-5 py-16 sm:px-8 sm:py-24 lg:grid-cols-[.85fr_1.15fr] lg:py-28">
            <div>
              <p className="font-mono text-xs font-bold uppercase tracking-[.28em] text-emerald-300">Van clubhuis naar clubkanaal</p>
              <h1 className="mt-5 font-display text-5xl uppercase leading-[.9] sm:text-6xl lg:text-7xl">
                Jouw club.<br />
                <span className="text-[#71d52b]">Altijd in beeld.</span>
              </h1>
              <p className="mt-6 max-w-xl text-lg leading-8 text-white/68">
                Zet elk scherm in de kantine, inkomhal of businessruimte om in een professioneel clubkanaal voor sponsors, wedstrijden, spelers en nieuws.
              </p>
              <div className="mt-8 flex flex-wrap gap-3">
                <Link href={manageHref} className="rounded-xl bg-[#71d52b] px-6 py-3 font-black text-[#07110d] shadow-[0_14px_45px_rgba(113,213,43,.2)] hover:bg-[#86e548]">
                  {signedIn ? "Open het beheer" : "Start met Club TV"}
                </Link>
                <a href="#zo-werkt-het" className="rounded-xl border border-white/20 px-6 py-3 font-bold text-white hover:border-white/40 hover:bg-white/5">
                  Bekijk hoe het werkt
                </a>
              </div>
              <p className="mt-4 text-xs text-white/40">Eén SVS-account. Geen aparte software op het scherm nodig.</p>
            </div>

            <ClubTvPreview />
          </div>
        </section>

        <section id="mogelijkheden" className="border-y border-white/10 bg-white/[.025]">
          <div className="mx-auto grid max-w-7xl gap-px bg-white/10 sm:grid-cols-3">
            {benefits.map((benefit) => (
              <article key={benefit.number} className="bg-[#08140f] px-7 py-10 sm:px-8">
                <span className="font-mono text-xs font-bold text-[#71d52b]">{benefit.number}</span>
                <h2 className="mt-4 font-display text-2xl uppercase">{benefit.title}</h2>
                <p className="mt-3 leading-7 text-white/58">{benefit.body}</p>
              </article>
            ))}
          </div>
        </section>

        <section id="zo-werkt-het" className="mx-auto max-w-7xl px-5 py-20 sm:px-8 sm:py-28">
          <div className="grid gap-12 lg:grid-cols-[.7fr_1.3fr] lg:items-start">
            <div>
              <p className="font-mono text-xs font-bold uppercase tracking-[.25em] text-emerald-300">Eenvoudig opgezet</p>
              <h2 className="mt-4 font-display text-4xl uppercase leading-none sm:text-5xl">Van leeg scherm naar live clubverhaal</h2>
            </div>
            <ol className="grid gap-4 sm:grid-cols-3">
              <Step number="1" title="Stel samen">Kies sponsorblokken, wedstrijdinfo, spelers, beelden en een tekstbalk.</Step>
              <Step number="2" title="Open de link">Gebruik de unieke schermlink op het toestel dat aan je tv of ledscherm hangt.</Step>
              <Step number="3" title="Laat draaien">Club TV ververst automatisch terwijl jij de inhoud vanuit SVS beheert.</Step>
            </ol>
          </div>
        </section>

        <section className="px-5 pb-20 sm:px-8 sm:pb-28">
          <div className="relative mx-auto max-w-5xl overflow-hidden rounded-3xl border border-[#71d52b]/30 bg-[linear-gradient(135deg,rgba(113,213,43,.16),rgba(255,255,255,.025))] px-6 py-12 text-center sm:px-12 sm:py-16">
            <div aria-hidden="true" className="absolute -right-20 -top-24 h-72 w-72 rounded-full bg-[#71d52b]/10 blur-3xl" />
            <p className="font-mono text-xs font-bold uppercase tracking-[.25em] text-emerald-300">Klaar voor de aftrap?</p>
            <h2 className="mt-4 font-display text-4xl uppercase sm:text-5xl">Geef je club een eigen tv-kanaal</h2>
            <p className="mx-auto mt-4 max-w-2xl leading-7 text-white/65">Beheer Club TV met dezelfde veilige SVS-login die je al gebruikt voor je club, teams en media.</p>
            <Link href={manageHref} className="relative mt-7 inline-flex rounded-xl bg-[#71d52b] px-7 py-3 font-black text-[#07110d] hover:bg-[#86e548]">
              {signedIn ? "Naar Club TV-beheer" : "Aanmelden bij SVS"}
            </Link>
          </div>
        </section>
      </main>

      <footer className="border-t border-white/10 py-8">
        <div className="mx-auto flex max-w-7xl flex-wrap items-center justify-between gap-4 px-5 text-sm text-white/45 sm:px-8">
          <div className="flex items-center gap-2"><SvsBrand format="square" width={28} height={28} className="h-7 w-7 rounded" /><span>SVS Club TV</span></div>
          <LegalLinks />
        </div>
      </footer>
    </div>
  );
}

function ClubTvPreview() {
  return (
    <div className="relative mx-auto w-full max-w-3xl">
      <div aria-hidden="true" className="absolute -inset-5 rounded-[2rem] bg-[#71d52b]/10 blur-2xl" />
      <div className="relative overflow-hidden rounded-2xl border border-white/15 bg-[#07130f] shadow-[0_35px_100px_rgba(0,0,0,.55)]">
        <div className="flex items-center justify-between border-b border-white/10 px-5 py-3">
          <div className="flex items-center gap-2 text-[10px] font-bold uppercase tracking-[.22em] text-white/55"><span className="h-2 w-2 rounded-full bg-[#71d52b] shadow-[0_0_12px_#71d52b]" />Live clubscherm</div>
          <span className="font-mono text-sm font-bold">19:30</span>
        </div>
        <div className="relative grid min-h-[310px] place-items-center overflow-hidden bg-[radial-gradient(circle_at_center,#164530,#07130f_70%)] p-8 sm:min-h-[390px]">
          <div aria-hidden="true" className="absolute inset-0 opacity-20 [background-image:linear-gradient(rgba(255,255,255,.04)_1px,transparent_1px),linear-gradient(90deg,rgba(255,255,255,.04)_1px,transparent_1px)] [background-size:32px_32px]" />
          <div className="relative text-center">
            <p className="font-mono text-[10px] font-bold uppercase tracking-[.3em] text-emerald-300">Hoofdsponsor</p>
            <div className="mx-auto mt-5 grid h-28 w-64 place-items-center rounded-2xl border border-white/15 bg-white px-8 text-[#102019] shadow-2xl sm:h-36 sm:w-80">
              <span className="font-display text-4xl uppercase tracking-wide">Clubpartner</span>
            </div>
            <p className="mt-5 text-sm text-white/55">Samen maken we de club sterker</p>
          </div>
        </div>
        <div className="overflow-hidden border-t border-emerald-300/25 bg-[#71d52b] px-5 py-3 text-[#07110d]">
          <p className="whitespace-nowrap text-center text-sm font-black sm:text-base">VOLGENDE WEDSTRIJD&nbsp;&nbsp; • &nbsp;&nbsp;U13 — ZATERDAG 10:30&nbsp;&nbsp; • &nbsp;&nbsp;WELKOM AAN ALLE SUPPORTERS</p>
        </div>
      </div>
      <div className="mx-auto h-5 w-1/3 bg-gradient-to-b from-white/15 to-white/5" />
      <div className="mx-auto h-2 w-1/2 rounded-full bg-white/10" />
    </div>
  );
}

function Step({ number, title, children }: { number: string; title: string; children: ReactNode }) {
  return (
    <li className="rounded-2xl border border-white/10 bg-white/[.035] p-6">
      <span className="grid h-9 w-9 place-items-center rounded-full bg-[#71d52b] font-black text-[#07110d]">{number}</span>
      <h3 className="mt-5 font-display text-xl uppercase">{title}</h3>
      <p className="mt-2 text-sm leading-6 text-white/55">{children}</p>
    </li>
  );
}
