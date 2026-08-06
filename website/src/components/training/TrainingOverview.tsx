"use client";

import { useMemo, useState } from "react";
import { TrainingWeek } from "@/components/training/TrainingWeek";
import type { TrainingSessionSummary } from "@/components/training/types";

export function TrainingOverview({ sessions, optionNames, canManage }: { sessions: TrainingSessionSummary[]; optionNames: Record<string, string>; canManage: boolean }) {
  const [activeTab, setActiveTab] = useState<"upcoming" | "past">("upcoming");
  const today = new Date().toISOString().slice(0, 10);
  const upcoming = useMemo(() => groupByWeek(sessions.filter(session => session.training_date >= today)), [sessions, today]);
  const past = useMemo(() => groupByWeek(sessions.filter(session => session.training_date < today)).reverse(), [sessions, today]);
  return <section>
    <div className="mb-4 flex flex-wrap gap-2 border-b border-border" role="tablist" aria-label="Trainingen filteren">
      <TabButton active={activeTab === "upcoming"} onClick={() => setActiveTab("upcoming")}>Komende trainingen</TabButton>
      <TabButton active={activeTab === "past"} onClick={() => setActiveTab("past")}>Afgelopen trainingen</TabButton>
    </div>
    <div role="tabpanel">
      {activeTab === "upcoming"
        ? <TrainingWeekList weeks={upcoming} optionNames={optionNames} canManage={canManage} empty="Er zijn nog geen komende trainingen gepland." past={false} />
        : <TrainingWeekList weeks={past} optionNames={optionNames} canManage={canManage} empty="Nog geen afgelopen trainingen." past />}
    </div>
  </section>;
}

function TabButton({ active, onClick, children }: { active: boolean; onClick: () => void; children: React.ReactNode }) {
  return <button type="button" role="tab" aria-selected={active} onClick={onClick} className={`border-b-2 px-3 py-2 text-lg font-bold transition ${active ? "border-accent text-textBright" : "border-transparent text-textMuted hover:text-textPrimary"}`}>{children}</button>;
}

function TrainingWeekList({ weeks, optionNames, canManage, empty, past }: { weeks: TrainingWeekGroup[]; optionNames: Record<string, string>; canManage: boolean; empty: string; past: boolean }) {
  return <div className="space-y-4">{weeks.map(week => <TrainingWeek key={week.key} week={week} optionNames={optionNames} canManage={canManage} past={past} />)}{!weeks.length && <p className="rounded-xl border border-dashed border-border p-5 text-sm text-textMuted">{empty}</p>}</div>;
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
