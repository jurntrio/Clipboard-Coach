"use client";

import { useMemo, useState } from "react";
import { TrainingWeek } from "@/components/training/TrainingWeek";
import type { TrainingSessionSummary } from "@/components/training/types";

export function TrainingOverview({ sessions, teams, groups = [], optionNames, canManage }: { sessions: TrainingSessionSummary[]; teams: { id: string; name: string }[]; groups?: { id: string; name: string; icon: string | null }[]; optionNames: Record<string, string>; canManage: boolean }) {
  const [selectedTeamIds, setSelectedTeamIds] = useState<string[]>([]);
  const filtered = useMemo(() => selectedTeamIds.length ? sessions.filter(item => selectedTeamIds.includes(item.club_team_id ?? item.player_group_id ?? "")) : sessions, [sessions, selectedTeamIds]);
  const weeks = useMemo(() => groupByWeek(filtered), [filtered]);
  const today = new Date().toISOString().slice(0, 10);
  const upcoming = weeks.filter(week => week.sessions.some(session => session.training_date >= today));
  const past = weeks.filter(week => week.sessions.every(session => session.training_date < today)).reverse();
  return <>
    {teams.length + groups.length > 1 && <div className="mb-5 flex flex-wrap gap-2 rounded-xl border border-border bg-card p-3"><button onClick={() => setSelectedTeamIds([])} className={`rounded-lg px-3 py-2 text-sm font-semibold ${selectedTeamIds.length ? "text-textPrimary" : "bg-accent text-page"}`}>Alles</button>{teams.map(team => <button key={team.id} onClick={() => setSelectedTeamIds(current => current.includes(team.id) ? current.filter(id => id !== team.id) : [...current, team.id])} className={`rounded-lg px-3 py-2 text-sm font-semibold ${selectedTeamIds.includes(team.id) ? "bg-accent text-page" : "text-textPrimary hover:bg-cardDeep"}`}>{team.name}</button>)}{groups.map(group => <button key={group.id} onClick={() => setSelectedTeamIds(current => current.includes(group.id) ? current.filter(id => id !== group.id) : [...current, group.id])} className={`rounded-lg border border-dashed px-3 py-2 text-sm font-semibold ${selectedTeamIds.includes(group.id) ? "border-accent bg-accent text-page" : "border-borderButton text-textPrimary hover:bg-cardDeep"}`}>{group.icon ?? "＋"} {group.name}</button>)}</div>}
    <TrainingWeekList title="Komende trainingen" weeks={upcoming} optionNames={optionNames} canManage={canManage} empty="Er zijn nog geen komende trainingen gepland." />
    <div className="mt-6"><TrainingWeekList title="Afgelopen trainingen" weeks={past} optionNames={optionNames} canManage={canManage} empty="Nog geen afgelopen trainingen." /></div>
  </>;
}

function TrainingWeekList({ title, weeks, optionNames, canManage, empty }: { title: string; weeks: TrainingWeekGroup[]; optionNames: Record<string, string>; canManage: boolean; empty: string }) {
  return <section><h2 className="mb-3 text-lg font-bold text-textBright">{title}</h2><div className="space-y-4">{weeks.map(week => <TrainingWeek key={week.key} week={week} optionNames={optionNames} canManage={canManage} />)}</div>{!weeks.length && <p className="rounded-xl border border-dashed border-border p-5 text-sm text-textMuted">{empty}</p>}</section>;
}

export type TrainingWeekGroup = { key: string; monday: string; sunday: string; sessions: TrainingSessionSummary[] };
function groupByWeek(sessions: TrainingSessionSummary[]) {
  return sessions.reduce((groups, session) => {
    const date = new Date(`${session.training_date}T12:00:00`); const offset = (date.getDay() + 6) % 7;
    const monday = new Date(date); monday.setDate(date.getDate() - offset); const sunday = new Date(monday); sunday.setDate(monday.getDate() + 6);
    const key = monday.toISOString().slice(0, 10); let group = groups.find(item => item.key === key);
    if (!group) { group = { key, monday: key, sunday: sunday.toISOString().slice(0, 10), sessions: [] }; groups.push(group); }
    group.sessions.push(session); return groups;
  }, [] as TrainingWeekGroup[]);
}
