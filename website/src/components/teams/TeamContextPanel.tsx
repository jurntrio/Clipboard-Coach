"use client";

export type TeamContextOption = { id: string; name: string };

export function TeamContextPanel({ teams, activeTeamId, onSelect, allowAll = true, changing = false }: {
  teams: TeamContextOption[];
  activeTeamId: string | null;
  onSelect: (teamId: string | null) => void;
  allowAll?: boolean;
  changing?: boolean;
}) {
  if (teams.length <= 1 && !allowAll) return null;

  return <nav className="mb-5 flex flex-wrap gap-2 rounded-xl border border-border bg-card p-3" aria-label="Ploeg kiezen">
    {allowAll && <button type="button" disabled={changing} onClick={() => onSelect(null)} className={`rounded-lg px-3 py-2 text-sm font-semibold ${activeTeamId ? "text-textPrimary hover:bg-cardDeep" : "bg-accent text-page"}`}>Alles</button>}
    {teams.map(team => <button key={team.id} type="button" disabled={changing} onClick={() => onSelect(team.id)} className={`rounded-lg px-3 py-2 text-sm font-semibold ${activeTeamId === team.id ? "bg-accent text-page" : "text-textPrimary hover:bg-cardDeep"}`}>{team.name}</button>)}
  </nav>;
}
