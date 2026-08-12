"use client";

import { useMemo, useState, type ReactNode } from "react";
import Link from "next/link";

export type TrainingStatistic = { playerId: string; playerName: string; teamId: string; teamName: string; confirmedTrainings: number; presentTrainings: number; missedTrainings: number; injuredTrainings: number };
type SortKey = "player" | "missed" | "present" | "injured" | "attendance";
type SortDirection = "asc" | "desc";

function lastName(value: string) {
  const parts = value.trim().split(/\s+/);
  return parts.at(-1) ?? value;
}

export function TrainingStatistics({ rows }: { rows: TrainingStatistic[] }) {
  const [sort, setSort] = useState<{ key: SortKey; direction: SortDirection }>({ key: "player", direction: "asc" });
  const visible = useMemo(() => [...rows].sort((a, b) => {
    const presentA = a.presentTrainings;
    const presentB = b.presentTrainings;
    const percentageA = a.confirmedTrainings ? presentA / a.confirmedTrainings : 0;
    const percentageB = b.confirmedTrainings ? presentB / b.confirmedTrainings : 0;
    let comparison = 0;
    if (sort.key === "player") comparison = lastName(a.playerName).localeCompare(lastName(b.playerName), "nl", { sensitivity: "base" }) || a.playerName.localeCompare(b.playerName, "nl", { sensitivity: "base" });
    if (sort.key === "missed") comparison = a.missedTrainings - b.missedTrainings;
    if (sort.key === "present") comparison = presentA - presentB;
    if (sort.key === "injured") comparison = a.injuredTrainings - b.injuredTrainings;
    if (sort.key === "attendance") comparison = percentageA - percentageB;
    return (sort.direction === "asc" ? comparison : -comparison) || a.playerName.localeCompare(b.playerName, "nl", { sensitivity: "base" });
  }), [rows, sort]);

  function selectSort(key: SortKey) {
    setSort(current => current.key === key
      ? { key, direction: current.direction === "asc" ? "desc" : "asc" }
      : { key, direction: key === "player" ? "asc" : "desc" });
  }

  function SortButton({ sortKey, children }: { sortKey: SortKey; children: ReactNode }) {
    const active = sort.key === sortKey;
    return <button type="button" onClick={() => selectSort(sortKey)} className="inline-flex items-center gap-1 font-bold hover:text-accent" aria-label={`Sorteer op ${children}`}>
      {children}<span aria-hidden="true" className={active ? "text-accent" : "text-textMuted/50"}>{active ? (sort.direction === "asc" ? "▲" : "▼") : "↕"}</span>
    </button>;
  }

  return <section className="overflow-hidden rounded-xl border border-border bg-card">
    <div className="border-b border-borderSubtle bg-cardDeep px-4 py-3"><h2 className="font-bold text-textBright">Aanwezigheidslijst</h2><p className="text-sm text-textMuted">Gebaseerd op bevestigde, afgelopen trainingen.</p></div>
    <div className="overflow-x-auto"><table className="w-full min-w-[760px] text-center text-sm"><thead className="border-b border-borderSubtle text-xs uppercase text-textMuted"><tr><th className="px-4 py-3" aria-sort={sort.key === "player" ? (sort.direction === "asc" ? "ascending" : "descending") : "none"}><SortButton sortKey="player">Speler</SortButton></th><th className="px-4 py-3">Trainingen</th><th className="px-4 py-3" aria-sort={sort.key === "present" ? (sort.direction === "asc" ? "ascending" : "descending") : "none"}><SortButton sortKey="present">Aanwezig</SortButton></th><th className="px-4 py-3" aria-sort={sort.key === "missed" ? (sort.direction === "asc" ? "ascending" : "descending") : "none"}><SortButton sortKey="missed">Gemist</SortButton></th><th className="px-4 py-3" aria-sort={sort.key === "injured" ? (sort.direction === "asc" ? "ascending" : "descending") : "none"}><SortButton sortKey="injured">Gekwetst</SortButton></th><th className="px-4 py-3" aria-sort={sort.key === "attendance" ? (sort.direction === "asc" ? "ascending" : "descending") : "none"}><SortButton sortKey="attendance">Aanwezigheid</SortButton></th></tr></thead><tbody className="divide-y divide-borderSubtle">{visible.map(row => { const percentage = row.confirmedTrainings ? Math.round(row.presentTrainings / row.confirmedTrainings * 100) : 0; return <tr key={row.playerId}><td className="px-4 py-3 font-semibold"><Link href={`/dashboard/teams/players/${row.playerId}`} title={`Open spelerspagina van ${row.playerName}`} className="text-textBright underline decoration-accent/50 underline-offset-4 hover:text-accent">{row.playerName}</Link></td><td className="px-4 py-3 text-textPrimary">{row.confirmedTrainings}</td><td className="px-4 py-3 text-textPrimary">{row.presentTrainings}</td><td className="px-4 py-3 font-semibold text-red-400">{row.missedTrainings}</td><td className="px-4 py-3 font-semibold text-amber-400">{row.injuredTrainings}</td><td className="px-4 py-3 font-bold text-accent">{percentage}%</td></tr>; })}</tbody></table></div>
    {!visible.length && <p className="p-5 text-sm text-textMuted">Nog geen spelers of bevestigde trainingen voor deze ploeg.</p>}
  </section>;
}
