"use client";

import { useState } from "react";
import { IntradeskLibrary, type IntradeskTrainingRow, type TrainingSeason, type TrainingTeam } from "./IntradeskLibrary";
import type { PersonalTrainingRow } from "./PersonalTrainingLibrary";

type SchemeRow = { id: string; name: string; description: string; status: string; version: number; weeks: number; sessions: number; phases: { name: string; weeks: number; trainingsPerWeek: number; sessions: number }[] };

export function IntradeskTabs({ personalTrainings, clubTrainings, seasons, teams, schemes, canEdit }: { personalTrainings: PersonalTrainingRow[]; clubTrainings: IntradeskTrainingRow[]; seasons: TrainingSeason[]; teams: TrainingTeam[]; schemes: SchemeRow[]; canEdit: boolean }) {
  const [tab, setTab] = useState<"library" | "schemes">("library");
  return <div className="space-y-5"><nav className="flex flex-wrap gap-2 rounded-xl border border-border bg-cardDeep p-2"><button type="button" onClick={() => setTab("library")} className={buttonClass(tab === "library")}>Intradesk</button><button type="button" onClick={() => setTab("schemes")} className={buttonClass(tab === "schemes")}>Trainingsschema’s</button></nav>
    {tab === "library" ? <IntradeskLibrary trainings={clubTrainings} personalTrainings={personalTrainings} seasons={seasons} teams={teams} canEdit={canEdit}/>
      : <section><div className="mb-3"><p className="text-xs font-black uppercase tracking-[.16em] text-accent">Workload en periodisering</p><h2 className="mt-1 text-xl font-black text-textBright">Trainingsschema’s van de club</h2></div><div className="grid gap-4 lg:grid-cols-2">{schemes.map(scheme => <article key={scheme.id} className="rounded-xl border border-border bg-card p-4"><div className="flex items-start justify-between gap-3"><div><h3 className="font-bold text-textBright">{scheme.name}</h3><p className="mt-1 text-sm text-textMuted">{scheme.description || "Clubtrainingsschema"}</p></div><span className="rounded-full border border-borderButton px-2 py-1 text-xs text-textMuted">v{scheme.version}</span></div><p className="mt-3 text-sm font-semibold text-textSecondary">{scheme.weeks} weken · {scheme.sessions} trainingen</p><div className="mt-3 space-y-2">{scheme.phases.map((phase, index) => <div key={`${phase.name}-${index}`} className="flex items-center justify-between rounded-lg bg-cardDeep px-3 py-2 text-sm"><span className="text-textPrimary">{phase.name}</span><span className="text-textMuted">{phase.weeks} weken · {phase.trainingsPerWeek}/week</span></div>)}</div></article>)}{!schemes.length && <p className="rounded-xl border border-dashed border-border p-5 text-sm text-textMuted">Nog geen trainingsschema’s opgeslagen. Een clubbeheerder kan ze maken via Clubbeheer → Trainingen beheren.</p>}</div></section>}
  </div>;
}
function buttonClass(active: boolean) { return `rounded-lg px-4 py-2 text-sm font-bold ${active ? "bg-accent text-page" : "text-textPrimary hover:bg-card"}`; }
