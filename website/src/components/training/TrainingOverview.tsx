"use client";

import Image from "next/image";
import Link from "next/link";
import { useMemo, useState } from "react";

type Session = { id: string; club_team_id: string; training_date: string; start_time: string; field_option_id: string | null; locker_room_option_id: string | null; club_teams: { name: string } | null };

export function TrainingOverview({ sessions, teams, optionNames }: { sessions: Session[]; teams: { id: string; name: string }[]; optionNames: Record<string, string> }) {
  const [selectedTeamIds, setSelectedTeamIds] = useState<string[]>([]);
  const [open, setOpen] = useState(false);
  const today = new Date().toISOString().slice(0, 10);
  const filtered = useMemo(() => selectedTeamIds.length ? sessions.filter(item => selectedTeamIds.includes(item.club_team_id)) : sessions, [sessions, selectedTeamIds]);
  const upcoming = filtered.filter(item => item.training_date >= today);
  const past = filtered.filter(item => item.training_date < today).reverse().slice(0, 20);
  const label = selectedTeamIds.length ? teams.filter(team => selectedTeamIds.includes(team.id)).map(team => team.name).join(", ") : "Alle ploegen";

  return <>
    {teams.length > 1 && <div className="mb-5 flex justify-end"><div className="relative">
      <button type="button" onClick={() => setOpen(value => !value)} className="flex max-w-72 items-center gap-2 rounded-xl border border-borderButton bg-button px-4 py-3 text-sm font-semibold text-textPrimary hover:border-accent">
        <span className="truncate">{label}</span><span className={`shrink-0 text-accent transition ${open ? "rotate-90" : ""}`}>▶</span>
      </button>
      {open && <div className="absolute right-0 z-20 mt-2 max-h-72 w-64 overflow-y-auto rounded-xl border border-border bg-cardAlt p-2 shadow-lg">
        <button type="button" onClick={() => setSelectedTeamIds([])} className={`flex w-full items-center gap-2 rounded-lg px-2 py-1.5 text-left text-sm font-semibold hover:bg-cardHover ${selectedTeamIds.length === 0 ? "text-accent" : "text-textPrimary"}`}>
          {selectedTeamIds.length === 0 ? "✓" : <span className="w-3.5" />} Alle ploegen
        </button>
        <div className="my-1 border-t border-borderSubtle" />
        {teams.map(team => { const selected = selectedTeamIds.includes(team.id); return <label key={team.id} className="flex items-center gap-2 rounded-lg px-2 py-1.5 text-sm text-textPrimary hover:bg-cardHover">
          <input type="checkbox" checked={selected} onChange={() => setSelectedTeamIds(current => selected ? current.filter(id => id !== team.id) : [...current, team.id])} className="h-4 w-4 accent-accent" />{team.name}
        </label>; })}
      </div>}
    </div></div>}
    <TrainingSection title="Komende trainingen" sessions={upcoming} optionNames={optionNames} empty="Er zijn nog geen komende trainingen gepland." />
    <div className="mt-6"><TrainingSection title="Voorbije trainingen" sessions={past} optionNames={optionNames} empty="Nog geen voorbije trainingen." /></div>
  </>;
}

function TrainingSection({ title, sessions, optionNames, empty }: { title: string; sessions: Session[]; optionNames: Record<string, string>; empty: string }) {
  return <section className="rounded-2xl border border-border bg-card p-5">
    <h2 className="text-xl font-bold text-textBright">{title}</h2>
    <div className="mt-4 grid gap-3 md:grid-cols-2">{sessions.map(session => <Link key={session.id} href={`/dashboard/training/${session.id}`} className="flex items-center gap-3 rounded-xl border border-borderSubtle bg-cardDeep p-4 transition hover:border-accent">
      <Image src="/branding/training.png" alt="" width={52} height={52} className="h-12 w-12 object-contain" />
      <span className="min-w-0 flex-1"><strong className="block text-textBright">{session.club_teams?.name ?? "Teamtraining"}</strong>
        <span className="block text-sm text-textMuted">{new Date(`${session.training_date}T12:00:00`).toLocaleDateString("nl-BE", { weekday: "long", day: "numeric", month: "long" })} · {session.start_time.slice(0, 5)}</span>
        <span className="block truncate text-xs text-textSecondary">{session.field_option_id ? optionNames[session.field_option_id] ?? "Veld nog niet bepaald" : "Veld nog niet bepaald"}{session.locker_room_option_id && optionNames[session.locker_room_option_id] ? ` · ${optionNames[session.locker_room_option_id]}` : ""}</span>
      </span><span className="text-accent">▶</span>
    </Link>)}</div>
    {!sessions.length && <p className="mt-4 rounded-xl border border-dashed border-border p-5 text-sm text-textMuted">{empty}</p>}
  </section>;
}
