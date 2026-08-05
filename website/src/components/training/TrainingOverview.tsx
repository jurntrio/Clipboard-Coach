"use client";

import { useMemo } from "react";
import { TrainingWeek } from "@/components/training/TrainingWeek";
import type { TrainingSessionSummary } from "@/components/training/types";

export function TrainingOverview({ sessions, optionNames, canManage }: { sessions: TrainingSessionSummary[]; optionNames: Record<string, string>; canManage: boolean }) {
  const weeks = useMemo(() => groupByWeek(sessions), [sessions]);
  const today = new Date().toISOString().slice(0, 10);
  const upcoming = weeks.filter(week => week.sessions.some(session => session.training_date >= today));
  const past = weeks.filter(week => week.sessions.every(session => session.training_date < today)).reverse();
  return <>
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
