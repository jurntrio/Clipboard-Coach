"use client";

import Image from "next/image";
import Link from "next/link";
import { useMemo, useState } from "react";

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
  status: string;
  score: string | null;
  contextIds: string[];
  href: string;
};

export type ProfileQuickLink = { href: string; label: string; icon: string };

function formatDate(value: string | null) {
  if (!value) return "Datum nog niet bepaald";
  return new Intl.DateTimeFormat("nl-BE", { weekday: "short", day: "numeric", month: "short" })
    .format(new Date(`${value}T12:00:00`));
}

export function ProfileOverview({ name, email, clubName, contexts, activities, quickLinks }: {
  name: string;
  email: string;
  clubName: string | null;
  contexts: ProfileContext[];
  activities: ProfileActivity[];
  quickLinks: ProfileQuickLink[];
}) {
  const [activeContext, setActiveContext] = useState("all");
  const today = new Date().toISOString().slice(0, 10);
  const filtered = useMemo(() => activities.filter(activity =>
    activeContext === "all" || activity.contextIds.includes(activeContext)
  ), [activities, activeContext]);
  const upcoming = filtered.filter(item => !!item.date && item.date >= today && item.status !== "finished" && item.status !== "completed")
    .sort((a, b) => `${a.date}${a.time}`.localeCompare(`${b.date}${b.time}`)).slice(0, 6);
  const recent = filtered.filter(item => item.status === "completed" || item.status === "finished" || (!!item.date && item.date < today))
    .sort((a, b) => `${b.date}${b.time}`.localeCompare(`${a.date}${a.time}`)).slice(0, 6);
  const contextNames = new Map(contexts.map(item => [item.id, item.subject]));

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
        <p className="text-sm text-textMuted">Open een kaart voor een apart overzicht.</p>
      </div>
      {contexts.length ? <div className="grid gap-3 lg:grid-cols-3">
        {contexts.map(context => {
          const next = activities.filter(item => item.contextIds.includes(context.id) && !!item.date && item.date >= today && item.status !== "completed")
            .sort((a, b) => `${a.date}${a.time}`.localeCompare(`${b.date}${b.time}`)).slice(0, 3);
          return <details key={context.id} className="group rounded-xl border border-border bg-card">
            <summary className="flex cursor-pointer list-none items-center gap-3 p-4">
              <div className="grid h-11 w-11 place-items-center rounded-full bg-accent/15 text-sm font-black text-accent">{context.subject.split(/\s+/).map(part => part[0]).slice(0, 2).join("")}</div>
              <div className="min-w-0 flex-1"><strong className="block truncate text-textBright">{context.label}</strong><span className="text-xs text-textMuted">{context.role}</span></div>
              <span className="text-accent transition group-open:rotate-90">▶</span>
            </summary>
            <div className="border-t border-borderSubtle p-4">
              {next.length ? <div className="space-y-2">{next.map(item => <ActivityRow key={item.id} item={item} labels={contextNames} compact />)}</div>
                : <p className="text-sm text-textMuted">Geen komende wedstrijden of trainingen gepland.</p>}
              <button type="button" onClick={() => setActiveContext(context.id)} className="mt-3 text-sm font-semibold text-accent hover:underline">Toon in mijn planning</button>
            </div>
          </details>;
        })}
      </div> : <div className="rounded-xl border border-dashed border-border p-5 text-sm text-textMuted">Er is nog geen ploeg- of spelerscontext aan je account gekoppeld.</div>}
    </section>

    <section className="rounded-2xl border border-border bg-card p-5">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div><h2 className="text-xl font-bold text-textBright">Mijn planning</h2><p className="text-sm text-textMuted">Wedstrijden en geplande trainingen, chronologisch samengebracht.</p></div>
        <div className="flex max-w-full gap-2 overflow-x-auto pb-1">
          <button onClick={() => setActiveContext("all")} className={`shrink-0 rounded-full px-3 py-1.5 text-xs font-bold ${activeContext === "all" ? "bg-accent text-page" : "bg-button text-textPrimary"}`}>Alles</button>
          {contexts.map(context => <button key={context.id} onClick={() => setActiveContext(context.id)} className={`shrink-0 rounded-full px-3 py-1.5 text-xs font-bold ${activeContext === context.id ? "bg-accent text-page" : "bg-button text-textPrimary"}`}>{context.label}</button>)}
        </div>
      </div>
      <div className="mt-4 grid gap-4 lg:grid-cols-2">
        <div><h3 className="mb-2 text-sm font-bold uppercase tracking-wide text-textSecondary">Komend</h3>
          {upcoming.length ? <div className="space-y-2">{upcoming.map(item => <ActivityRow key={item.id} item={item} labels={contextNames} />)}</div>
            : <div className="rounded-xl border border-dashed border-border p-5 text-sm text-textMuted">Geen komende wedstrijden of trainingen.</div>}
        </div>
        <div><h3 className="mb-2 text-sm font-bold uppercase tracking-wide text-textSecondary">Recent afgerond</h3>
          {recent.length ? <div className="space-y-2">{recent.map(item => <ActivityRow key={item.id} item={item} labels={contextNames} />)}</div>
            : <div className="rounded-xl border border-dashed border-border p-5 text-sm text-textMuted">Nog geen afgeronde activiteiten.</div>}
        </div>
      </div>
    </section>

    <section>
      <h2 className="mb-3 text-lg font-bold text-textBright">Snel naar</h2>
      {quickLinks.length ? <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
        {quickLinks.map(link => <Link key={link.href} href={link.href} title={link.label} className="flex min-h-32 flex-col items-center justify-center gap-2 rounded-xl border border-border bg-card p-4 text-center transition hover:border-accent hover:bg-cardHover">
          <Image src={link.icon} alt="" width={64} height={64} className="h-16 w-16 object-contain" />
          <span className="text-xs font-bold text-textPrimary">{link.label}</span>
        </Link>)}
      </div> : <div className="rounded-xl border border-dashed border-border p-5 text-sm text-textMuted">Er zijn nog geen modules aan je account toegewezen.</div>}
    </section>
  </main>;
}

function ActivityRow({ item, labels, compact = false }: { item: ProfileActivity; labels: Map<string, string>; compact?: boolean }) {
  const subjects = item.contextIds.map(id => labels.get(id)).filter(Boolean).join(", ");
  return <Link href={item.href} className="flex items-center gap-3 rounded-xl border border-borderSubtle bg-cardDeep p-3 transition hover:border-accent">
    <Image src={item.kind === "match" ? "/branding/games.png" : "/branding/training.png"} alt="" width={40} height={40} className="h-10 w-10 shrink-0 object-contain" />
    <span className="min-w-0 flex-1">
      <strong className="block truncate text-sm text-textBright">{item.title}</strong>
      <span className="block text-xs text-textMuted">{formatDate(item.date)}{item.time ? ` · ${item.time}` : ""}{subjects ? ` · ${subjects}` : ""}</span>
    </span>
    {!compact && item.score && <strong className="text-sm text-accent">{item.score}</strong>}
  </Link>;
}
