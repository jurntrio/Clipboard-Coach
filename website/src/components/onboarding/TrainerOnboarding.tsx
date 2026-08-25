"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { recurringDates } from "@/lib/training-recurrence";

export function TrainerOnboarding({ teamId, teamName, replay = false, canImport = true }: { teamId: string; teamName: string; replay?: boolean; canImport?: boolean }) {
  const router = useRouter();
  const [step, setStep] = useState(0);
  const [foot24Url, setFoot24Url] = useState("");
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState("");
  const [closed, setClosed] = useState(false);
  const [trainingRange, setTrainingRange] = useState({ start: "", end: "", time: "18:00" });
  const [trainingDays, setTrainingDays] = useState<number[]>([]);
  const [trainingSaved, setTrainingSaved] = useState(false);

  async function complete() {
    if (replay) {
      router.push("/dashboard/help");
      return;
    }
    setBusy(true); setNotice("");
    const response = await fetch("/api/trainer-onboarding", {
      method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action: "complete" })
    });
    setBusy(false);
    if (!response.ok) return setNotice("De tutorial kon niet worden afgerond. Probeer opnieuw.");
    setClosed(true);
  }

  async function importFoot24() {
    setBusy(true); setNotice("");
    const response = await fetch("/api/trainer-onboarding", {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "foot24", foot24Url })
    });
    const body = await response.json();
    setBusy(false);
    if (!response.ok) return setNotice(body.error || "De kalender kon niet worden ingelezen.");
    setNotice(`${body.imported ?? 0} wedstrijden toegevoegd en ${body.updated ?? 0} bijgewerkt.`);
  }

  async function createTrainingSeries() {
    const sessions = trainingDays.flatMap(weekday => recurringDates(trainingRange.start, trainingRange.end, weekday, "weekly")
      .map(date => ({ date, time: trainingRange.time, staffIds: [] })));
    if (!sessions.length) return setNotice("Kies een geldige periode en minstens één trainingsdag.");
    setBusy(true); setNotice("");
    const response = await fetch(`/api/club/teams/${teamId}/trainings`, {
      method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ sessions, series: true })
    });
    const body = await response.json();
    setBusy(false);
    if (!response.ok) return setNotice(body.error || "De trainingen konden niet worden toegevoegd.");
    setTrainingSaved(true);
    setNotice(`${body.trainings?.length ?? sessions.length} trainingen zijn werkelijk toegevoegd aan ${teamName}.`);
  }

  if (closed) return null;
  return <div className="fixed inset-0 z-[100] grid place-items-center overflow-y-auto bg-black/75 p-4" role="dialog" aria-modal="true" aria-labelledby="trainer-tutorial-title">
    <section className="my-auto w-full max-w-2xl rounded-2xl border border-border bg-card p-6 shadow-2xl sm:p-8">
      <div className="flex items-start justify-between gap-4">
        <div><p className="text-xs font-black uppercase tracking-[.18em] text-accent">Startgids · stap {step + 1} van 3</p><h2 id="trainer-tutorial-title" className="mt-2 text-2xl font-black text-textBright">{step === 0 ? "Welkom bij SVS" : step === 1 ? "Plan een reeks trainingen" : "Importeer je wedstrijden"}</h2></div>
        <button type="button" disabled={busy} onClick={() => void complete()} className="text-sm text-textMuted hover:text-textPrimary">{replay ? "Sluiten" : "Overslaan"}</button>
      </div>

      {step === 0 && <div className="mt-6 space-y-4 text-sm leading-6 text-textSecondary">
        <p>Je persoonlijke omgeving voor <strong className="text-textBright">{teamName}</strong> staat klaar. Alles wat je hier maakt blijft gescheiden van accounts van andere trainers.</p>
        <div className="grid gap-3 sm:grid-cols-3"><GuideCard number="1" title="Plan" text="Zet één training of een volledige reeks in je kalender."/><GuideCard number="2" title="Teken" text="Bouw trainingen met oefeningen en veldtekeningen."/><GuideCard number="3" title="Analyseer" text="Voeg wedstrijden, video, tags en clips toe wanneer je formule dit ondersteunt."/></div>
      </div>}

      {step === 1 && <div className="mt-6 space-y-4 text-sm leading-6 text-textSecondary">
        <p>Maak hier meteen je echte wekelijkse trainingsreeks voor <strong className="text-textBright">{teamName}</strong>. Je kunt de momenten achteraf afzonderlijk aanpassen.</p>
        <div className="grid gap-3 sm:grid-cols-3">
          <label className="font-semibold text-textPrimary">Begindatum<input type="date" disabled={!canImport || trainingSaved} value={trainingRange.start} onChange={event => setTrainingRange(current => ({ ...current, start: event.target.value }))} className="mt-1 w-full rounded-lg border border-border bg-input px-3 py-2 font-normal disabled:cursor-not-allowed disabled:opacity-60" /></label>
          <label className="font-semibold text-textPrimary">Einddatum<input type="date" disabled={!canImport || trainingSaved} min={trainingRange.start} value={trainingRange.end} onChange={event => setTrainingRange(current => ({ ...current, end: event.target.value }))} className="mt-1 w-full rounded-lg border border-border bg-input px-3 py-2 font-normal disabled:cursor-not-allowed disabled:opacity-60" /></label>
          <label className="font-semibold text-textPrimary">Uur<input type="time" disabled={!canImport || trainingSaved} value={trainingRange.time} onChange={event => setTrainingRange(current => ({ ...current, time: event.target.value }))} className="mt-1 w-full rounded-lg border border-border bg-input px-3 py-2 font-normal disabled:cursor-not-allowed disabled:opacity-60" /></label>
        </div>
        <fieldset><legend className="font-semibold text-textPrimary">Trainingsdagen</legend><div className="mt-2 flex flex-wrap gap-2">{[[1,"Ma"],[2,"Di"],[3,"Wo"],[4,"Do"],[5,"Vr"],[6,"Za"],[0,"Zo"]].map(([value,label]) => <label key={value} className="flex items-center gap-2 rounded-lg border border-borderSubtle px-3 py-2"><input type="checkbox" disabled={!canImport || trainingSaved} checked={trainingDays.includes(value as number)} onChange={() => setTrainingDays(current => current.includes(value as number) ? current.filter(day => day !== value) : [...current, value as number])} />{label}</label>)}</div></fieldset>
        <button type="button" disabled={busy || !canImport || trainingSaved} onClick={() => void createTrainingSeries()} className="rounded-lg bg-accent px-4 py-2 font-black text-page disabled:cursor-not-allowed disabled:opacity-50">{busy ? "Trainingen toevoegen…" : trainingSaved ? "Trainingsreeks toegevoegd" : "Trainingsreeks toevoegen"}</button>
        {!canImport && <p className="text-xs text-textMuted">Oefenmodus: je kunt de stap bekijken, maar er worden vanuit deze gids geen trainingen bewaard.</p>}
        {notice && <p className="rounded-lg border border-borderSubtle bg-cardDeep px-3 py-2 text-sm text-textPrimary">{notice}</p>}
        <Link href="/dashboard/training" className="inline-flex text-sm font-bold text-accent hover:underline">Open het volledige trainingenoverzicht</Link>
      </div>}

      {step === 2 && <div className="mt-6 space-y-4 text-sm leading-6 text-textSecondary">
        <ol className="space-y-3"><TutorialStep number="1">Open Foot24 en zoek je club en juiste ploeg/reeks.</TutorialStep><TutorialStep number="2">Klik op <strong>iCal/.ics URL kopiëren</strong>. Kopieer niet gewoon het adres bovenaan je browser.</TutorialStep><TutorialStep number="3">Plak de gekopieerde kalenderlink hieronder. SVS leest daarna de wedstrijden in en kan wijzigingen synchroniseren.</TutorialStep></ol>
        <a href="https://www.foot24.be/nl" target="_blank" rel="noreferrer" className="inline-flex rounded-lg border border-borderButton px-4 py-2 font-bold text-textPrimary hover:border-accent">Foot24 openen ↗</a>
        <label className="block font-semibold text-textPrimary">Foot24 iCal-link
          <input type="url" disabled={!canImport} value={foot24Url} onChange={event => setFoot24Url(event.target.value)} placeholder={canImport ? "https://www.foot24.be/... .ics" : "Oefenmodus: import is uitgeschakeld"} className="mt-1 w-full rounded-lg border border-border bg-input px-3 py-2 font-normal disabled:cursor-not-allowed disabled:opacity-60" />
        </label>
        <button type="button" disabled={busy || !canImport || !foot24Url.trim()} onClick={() => void importFoot24()} className="rounded-lg bg-accent px-4 py-2 font-black text-page disabled:cursor-not-allowed disabled:opacity-50">{busy ? "Wedstrijden ophalen…" : "Wedstrijden importeren"}</button>
        {!canImport && <p className="text-xs text-textMuted">Je bekijkt de gids in oefenmodus. Een zelfstandige trainer kan hier zijn eigen Foot24-kalender werkelijk importeren.</p>}
        {notice && <p className="rounded-lg border border-borderSubtle bg-cardDeep px-3 py-2 text-sm text-textPrimary">{notice}</p>}
      </div>}

      <div className="mt-7 flex items-center justify-between border-t border-borderSubtle pt-5">
        <button type="button" disabled={busy || step === 0} onClick={() => { setNotice(""); setStep(current => current - 1); }} className="rounded-lg px-4 py-2 font-semibold text-textSecondary disabled:cursor-not-allowed disabled:opacity-30">Vorige</button>
        {step < 2 ? <button type="button" onClick={() => { setNotice(""); setStep(current => current + 1); }} className="rounded-lg bg-accent px-5 py-2.5 font-black text-page">Volgende</button> : <button type="button" disabled={busy} onClick={() => void complete()} className="rounded-lg bg-accent px-5 py-2.5 font-black text-page disabled:cursor-not-allowed disabled:opacity-50">{replay ? "Gids sluiten" : "Start met SVS"}</button>}
      </div>
    </section>
  </div>;
}

function GuideCard({ number, title, text }: { number: string; title: string; text: string }) {
  return <div className="rounded-xl border border-borderSubtle bg-cardDeep p-4"><span className="grid h-8 w-8 place-items-center rounded-full bg-accent font-black text-page">{number}</span><strong className="mt-3 block text-textBright">{title}</strong><p className="mt-1 text-xs leading-5 text-textMuted">{text}</p></div>;
}
function TutorialStep({ number, children }: { number: string; children: React.ReactNode }) {
  return <li className="flex gap-3"><span className="grid h-7 w-7 shrink-0 place-items-center rounded-full bg-accentDim font-black text-accent">{number}</span><span>{children}</span></li>;
}
