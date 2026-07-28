"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { TRAINING_AGE_CATEGORIES } from "@/lib/training-categories";

export type IntradeskTrainingRow = {
  id: string;
  title: string;
  ageCategory: string;
  themes: string[];
  version: number;
  updatedAt: string;
  author: string;
};

export function IntradeskLibrary({ trainings }: { trainings: IntradeskTrainingRow[] }) {
  const [selectedCategory, setSelectedCategory] = useState<string>("all");
  const [expanded, setExpanded] = useState(true);
  const [query, setQuery] = useState("");

  const visible = useMemo(() => trainings.filter(training => {
    const inCategory = selectedCategory === "all" || training.ageCategory === selectedCategory;
    const needle = query.trim().toLocaleLowerCase("nl-BE");
    return inCategory && (!needle
      || training.title.toLocaleLowerCase("nl-BE").includes(needle)
      || training.themes.some(theme => theme.toLocaleLowerCase("nl-BE").includes(needle)));
  }), [query, selectedCategory, trainings]);

  return <section className="overflow-hidden rounded-2xl border border-border bg-card shadow-sm">
    <div className="flex flex-wrap items-center justify-end gap-3 border-b border-border bg-accentDim px-4 py-3">
      <label className="relative block min-w-60 max-w-md flex-1">
        <span className="pointer-events-none absolute left-3 top-2.5 text-textMuted">⌕</span>
        <input value={query} onChange={event => setQuery(event.target.value)} placeholder="Zoek op naam of thema…"
          className="w-full rounded-lg border border-border bg-input py-2 pl-9 pr-3 text-sm text-textPrimary outline-none focus:border-accent" />
      </label>
    </div>

    <div className="grid min-h-[590px] lg:grid-cols-[300px_minmax(0,1fr)]">
      <aside className="border-b border-border bg-cardDeep p-3 lg:border-b-0 lg:border-r">
        <button type="button" onClick={() => { setSelectedCategory("all"); setExpanded(value => !value); }}
          className={`flex w-full items-center gap-2 rounded-lg px-3 py-2 text-left text-sm font-bold transition ${selectedCategory === "all" ? "bg-accentDim text-accent" : "text-textPrimary hover:bg-cardHover"}`}>
          <Chevron open={expanded} />
          <Folder open={expanded} accent />
          Trainingsbibliotheek
          <span className="ml-auto rounded-full bg-card px-2 py-0.5 text-xs text-textMuted">{trainings.length}</span>
        </button>

        {expanded && <div className="relative ml-5 mt-1 space-y-0.5 border-l border-border pl-3">
          {TRAINING_AGE_CATEGORIES.map(category => {
            const count = trainings.filter(training => training.ageCategory === category).length;
            const active = selectedCategory === category;
            return <button key={category} type="button" onClick={() => setSelectedCategory(category)}
              className={`relative flex w-full items-center gap-2 rounded-lg px-3 py-2 text-left text-sm transition before:absolute before:-left-3 before:top-1/2 before:w-3 before:border-t before:border-border ${active ? "bg-accent text-page" : "text-textSecondary hover:bg-cardHover hover:text-textPrimary"}`}>
              <Folder open={active} />
              <span className="font-semibold">{category}</span>
              <span className={`ml-auto text-xs ${active ? "text-page/75" : "text-textMuted"}`}>{count}</span>
            </button>;
          })}
        </div>}
      </aside>

      <div className="min-w-0">
        <div className="flex flex-wrap items-center justify-between gap-2 border-b border-border px-5 py-4">
          <div>
            <p className="text-xs font-bold uppercase tracking-[.16em] text-accent">Intradesk</p>
            <h2 className="mt-1 text-xl font-black text-textBright">
              {selectedCategory === "all" ? "Alle trainingen" : selectedCategory}
            </h2>
          </div>
          <span className="text-sm text-textMuted">{visible.length} resultaat{visible.length === 1 ? "" : "en"}</span>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full min-w-[620px] text-left">
            <thead>
              <tr className="border-b border-border bg-cardDeep text-xs uppercase tracking-wide text-textMuted">
                <th className="px-5 py-3 font-bold">Naam</th>
                <th className="px-4 py-3 font-bold">Gewijzigd op</th>
                <th className="px-4 py-3 font-bold">Auteur</th>
                <th className="px-4 py-3 font-bold">Versie</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-borderSubtle">
              {visible.map(training => <tr key={training.id} className="group transition hover:bg-cardHover">
                <td className="px-5 py-4">
                  <Link href={`/dashboard/intradesk/${training.id}`} className="flex items-center gap-3 font-bold text-textPrimary group-hover:text-accent">
                    <DocumentIcon />
                    <span>
                      {training.title}
                      {!!training.themes.length && <small className="mt-1 block font-normal text-textMuted">{training.themes.join(" · ")}</small>}
                    </span>
                  </Link>
                </td>
                <td className="px-4 py-4 text-sm text-textSecondary">{new Date(training.updatedAt).toLocaleDateString("nl-BE")}</td>
                <td className="px-4 py-4 text-sm text-textSecondary">{training.author}</td>
                <td className="px-4 py-4 text-sm font-semibold text-textSecondary">v{training.version}</td>
              </tr>)}
            </tbody>
          </table>
          {!visible.length && <div className="grid min-h-56 place-items-center p-8 text-center">
            <div>
              <Folder open />
              <p className="mt-3 font-bold text-textPrimary">Deze map is nog leeg</p>
              <p className="mt-1 text-sm text-textMuted">Trainingen worden via de module Training aangemaakt en volgens het clubbeleid gepubliceerd.</p>
            </div>
          </div>}
        </div>
      </div>
    </div>
  </section>;
}

function Chevron({ open }: { open: boolean }) {
  return <svg viewBox="0 0 20 20" className={`h-4 w-4 shrink-0 transition ${open ? "rotate-90" : ""}`} fill="currentColor"><path d="m7 5 5 5-5 5V5Z" /></svg>;
}

function Folder({ open = false, accent = false }: { open?: boolean; accent?: boolean }) {
  return <svg viewBox="0 0 24 24" className={`h-5 w-5 shrink-0 ${accent ? "text-accent" : "text-amber-400"}`} fill="currentColor" aria-hidden="true">
    <path d={open ? "M3 6.5A2.5 2.5 0 0 1 5.5 4H10l2 2h6.5A2.5 2.5 0 0 1 21 8.5V9H6.2a2 2 0 0 0-1.9 1.35L2 17.1V6.5h1Zm3.2 4H22l-3.1 8.1a2 2 0 0 1-1.87 1.29H4.42a2 2 0 0 1-1.9-2.65l2.26-5.38A1.55 1.55 0 0 1 6.2 10.5Z" : "M3 6.5A2.5 2.5 0 0 1 5.5 4H10l2 2h6.5A2.5 2.5 0 0 1 21 8.5v9A2.5 2.5 0 0 1 18.5 20h-13A2.5 2.5 0 0 1 3 17.5v-11Z"} />
  </svg>;
}

function DocumentIcon() {
  return <svg viewBox="0 0 24 24" className="h-8 w-8 shrink-0 text-accent" fill="none" stroke="currentColor" strokeWidth="1.7" aria-hidden="true">
    <path d="M6 2.75h8l4 4v14.5H6z" /><path d="M14 2.75v4h4M8.5 12h7M8.5 15.5h7" />
  </svg>;
}
