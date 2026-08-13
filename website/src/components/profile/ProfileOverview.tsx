"use client";

import Image from "next/image";
import Link from "next/link";
import { useEffect, useMemo, useState } from "react";

export type ProfileContext = {
  id: string;
  label: string;
  subject: string;
  role: string;
  teamName: string;
  teamIds: string[];
  clubTeamIds: string[];
};

export type ProfileActivity = {
  id: string;
  kind: "match" | "training";
  title: string;
  date: string | null;
  time: string | null;
  sortAt?: string | null;
  status: string;
  score: string | null;
  contextIds: string[];
  href: string;
};

function formatDate(value: string | null) {
  if (!value) return "Datum nog niet bepaald";
  return new Intl.DateTimeFormat("nl-BE", { weekday: "short", day: "numeric", month: "short" })
    .format(new Date(`${value}T12:00:00`));
}

function activityIdentity(activity: ProfileActivity) {
  const normalizedTitle = activity.title
    .replace(/\(\s*u\d{1,2}(?:\s+[a-z0-9]+)*\s*\)/gi, "")
    .toLocaleLowerCase("nl")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]/g, "");
  return `${activity.kind}:${activity.date ?? ""}:${activity.time ?? ""}:${normalizedTitle}`;
}

function withoutDuplicateActivities(activities: ProfileActivity[]) {
  const seen = new Set<string>();
  return activities.filter(activity => {
    const identity = activityIdentity(activity);
    if (seen.has(identity)) return false;
    seen.add(identity);
    return true;
  });
}

const ACTIVITY_DURATION_MS = {
  training: 2 * 60 * 60 * 1000,
  match: (2 * 60 + 15) * 60 * 1000
} as const;

function isActivityCompleted(activity: ProfileActivity, now: number | null) {
  if (activity.status === "completed" || activity.status === "finished") return true;
  if (!activity.date || now === null) return false;

  const today = new Date(now).toLocaleDateString("sv-SE");
  if (activity.date < today) return true;
  if (activity.date > today || !activity.time) return false;

  const startsAt = new Date(`${activity.date}T${activity.time}:00`).getTime();
  return Number.isFinite(startsAt) && now >= startsAt + ACTIVITY_DURATION_MS[activity.kind];
}

export function ProfileOverview({ name, email, clubName, contexts, activities }: {
  name: string;
  email: string;
  clubName: string | null;
  contexts: ProfileContext[];
  activities: ProfileActivity[];
}) {
  const [activeContext, setActiveContext] = useState("all");
  const [expandedContext, setExpandedContext] = useState<string | null>(null);
  const [now, setNow] = useState<number | null>(null);
  const today = now === null ? new Date().toISOString().slice(0, 10) : new Date(now).toLocaleDateString("sv-SE");
  useEffect(() => {
    setNow(Date.now());
    const timer = window.setInterval(() => setNow(Date.now()), 60_000);
    return () => window.clearInterval(timer);
  }, []);
  const uniqueActivities = useMemo(() => withoutDuplicateActivities(activities), [activities]);
  const filtered = useMemo(() => uniqueActivities.filter(activity =>
    activeContext === "all" || activity.contextIds.includes(activeContext)
  ), [uniqueActivities, activeContext]);
  const upcoming = filtered.filter(item => !!item.date && item.date >= today && !isActivityCompleted(item, now))
    .sort((a, b) => `${a.date}${a.time}`.localeCompare(`${b.date}${b.time}`)).slice(0, 6);
  const recent = filtered.filter(item => isActivityCompleted(item, now))
    .sort((a, b) => (b.sortAt ?? `${b.date}${b.time ?? ""}`).localeCompare(a.sortAt ?? `${a.date}${a.time ?? ""}`)).slice(0, 6);
  const contextNames = new Map(contexts.map(item => [item.id, item.subject]));
  const activeContextLabel = activeContext === "all" ? "Alles" : contexts.find(item => item.id === activeContext)?.label ?? "Alles";

  function showContextInPlanning(contextId: string) {
    setActiveContext(contextId);
    window.requestAnimationFrame(() => {
      document.getElementById("mijn-planning")?.scrollIntoView({ behavior: "smooth", block: "start" });
    });
  }

  return <main className="mx-auto w-full max-w-7xl space-y-6 p-4 sm:p-7">
    <header className="flex flex-wrap items-center gap-4 rounded-2xl border border-border bg-card p-5">
      <Image src="/branding/profile.png" alt="" width={82} height={82} className="h-20 w-20 shrink-0 object-contain" />
      <div className="min-w-0 flex-1">
        <p className="text-xs font-bold uppercase tracking-[0.16em] text-textMuted">Mijn overzicht</p>
        <h1 className="truncate text-2xl font-bold text-textBright">{name}</h1>
        <p className="truncate text-sm text-textMuted">{email}{clubName ? ` · ${clubName}` : ""}</p>
      </div>
      <Link href="/dashboard/settings" className="rounded-xl border border-borderButton bg-button px-4 py-2 text-sm font-semibold text-textPrimary hover:border-accent">Profiel bewerken</Link>
    </header>

    <section>
      <div className="mb-3">
        <h2 className="text-lg font-bold text-textBright">Mijn rollen en spelers</h2>
      </div>
      {contexts.length ? <div className="grid items-start gap-3 lg:grid-cols-3">
        {contexts.map(context => {
          const next = uniqueActivities.filter(item => item.contextIds.includes(context.id) && !!item.date && item.date >= today && !isActivityCompleted(item, now))
            .sort((a, b) => `${a.date}${a.time}`.localeCompare(`${b.date}${b.time}`)).slice(0, 3);
          const expanded = expandedContext === context.id;
          return <article key={context.id} className="self-start rounded-xl border border-border bg-card">
            <button type="button" aria-expanded={expanded} onClick={() => setExpandedContext(expanded ? null : context.id)} className="flex w-full cursor-pointer items-center gap-3 p-4 text-left">
              <div className="grid h-11 w-11 place-items-center rounded-full bg-accent/15 text-sm font-black text-accent">{context.subject.split(/\s+/).map(part => part[0]).slice(0, 2).join("")}</div>
              <div className="min-w-0 flex-1"><strong className="block truncate text-textBright">{context.label}</strong><span className="text-xs text-textMuted">{context.role}</span></div>
              <span aria-hidden="true" className={`text-accent transition ${expanded ? "rotate-90" : ""}`}>▶</span>
            </button>
            {expanded && <div className="border-t border-borderSubtle p-4">
              {next.length ? <div className="space-y-2">{next.map(item => <ActivityRow key={item.id} item={item} labels={contextNames} compact />)}</div>
                : <p className="text-sm text-textMuted">Geen komende wedstrijden of trainingen gepland.</p>}
              <button type="button" onClick={() => showContextInPlanning(context.id)} className="mt-3 text-sm font-semibold text-accent hover:underline">Toon in mijn planning</button>
            </div>}
          </article>;
        })}
      </div> : <div className="rounded-xl border border-dashed border-border p-5 text-sm text-textMuted">Er is nog geen ploeg- of spelerscontext aan je account gekoppeld.</div>}
      {contexts.length > 1 && <div className="mt-4 flex max-w-full gap-2 overflow-x-auto pb-1">
        <button onClick={() => setActiveContext("all")} className={`shrink-0 rounded-full px-3 py-1.5 text-xs font-bold ${activeContext === "all" ? "bg-accent text-page" : "bg-button text-textPrimary"}`}>Alles</button>
        {contexts.map(context => <button key={context.id} onClick={() => setActiveContext(context.id)} className={`shrink-0 rounded-full px-3 py-1.5 text-xs font-bold ${activeContext === context.id ? "bg-accent text-page" : "bg-button text-textPrimary"}`}>{context.label}</button>)}
      </div>}
    </section>

    <section id="mijn-planning" className="min-w-0 scroll-mt-4 overflow-hidden rounded-2xl border border-border bg-card p-4 sm:p-5">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div><h2 className="text-xl font-bold text-textBright">Mijn planning</h2><p className="text-sm font-semibold text-textMuted">Planning: <span className="text-textPrimary">{activeContextLabel}</span></p></div>
      </div>
      <div className="mt-4 grid min-w-0 gap-4 lg:grid-cols-2">
        <div className="min-w-0"><h3 className="mb-2 text-sm font-bold uppercase tracking-wide text-textSecondary">Komend</h3>
          {upcoming.length ? <div className="space-y-2">{upcoming.map(item => <ActivityRow key={item.id} item={item} labels={contextNames} />)}</div>
            : <div className="rounded-xl border border-dashed border-border p-5 text-sm text-textMuted">Geen komende wedstrijden of trainingen.</div>}
        </div>
        <div className="min-w-0"><h3 className="mb-2 text-sm font-bold uppercase tracking-wide text-textSecondary">Recent afgerond</h3>
          {recent.length ? <div className="space-y-2">{recent.map(item => <ActivityRow key={item.id} item={item} labels={contextNames} />)}</div>
            : <div className="rounded-xl border border-dashed border-border p-5 text-sm text-textMuted">Nog geen afgeronde activiteiten.</div>}
        </div>
      </div>
    </section>

  </main>;
}

function ActivityRow({ item, labels, compact = false }: { item: ProfileActivity; labels: Map<string, string>; compact?: boolean }) {
  const subjects = item.contextIds.map(id => labels.get(id)).filter(Boolean).join(", ");
  return <Link href={item.href} className="flex min-w-0 max-w-full items-center gap-3 overflow-hidden rounded-xl border border-borderSubtle bg-cardDeep p-3 transition hover:border-accent">
    <Image src={item.kind === "match" ? "/branding/games.png" : "/branding/training.png"} alt="" width={40} height={40} className="h-10 w-10 shrink-0 object-contain" />
    <span className="min-w-0 flex-1">
      <strong className="block truncate text-sm text-textBright">{item.title}</strong>
      <span className="block text-xs text-textMuted">{formatDate(item.date)}{item.time ? ` · ${item.time}` : ""}{subjects ? ` · ${subjects}` : ""}</span>
    </span>
    {!compact && item.score && <strong className="text-sm text-accent">{item.score}</strong>}
  </Link>;
}
