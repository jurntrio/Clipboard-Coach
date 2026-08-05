"use client";

import { useEffect, useState } from "react";

type TeamOption = { id: string; name: string };

export function TeamContextHeader({ teams: suppliedTeams, activeTeamId: suppliedActiveTeamId, allowAll = true }: {
  teams?: TeamOption[];
  activeTeamId?: string | null;
  allowAll?: boolean;
}) {
  const [teams, setTeams] = useState<TeamOption[]>(suppliedTeams ?? []);
  const [activeTeamId, setActiveTeamId] = useState<string | null>(suppliedActiveTeamId ?? null);
  const [changing, setChanging] = useState(false);

  useEffect(() => {
    if (suppliedTeams) {
      setTeams(suppliedTeams);
      setActiveTeamId(suppliedActiveTeamId ?? null);
      return;
    }
    void fetch("/api/team-context", { cache: "no-store" }).then(async response => {
      if (!response.ok) return;
      const body = await response.json() as { teams?: TeamOption[]; activeTeamId?: string | null };
      setTeams(body.teams ?? []);
      setActiveTeamId(body.activeTeamId ?? null);
    });
  }, [suppliedTeams, suppliedActiveTeamId]);

  if (teams.length <= 1) return null;

  async function selectTeam(clubTeamId: string | null) {
    if (clubTeamId === activeTeamId) return;
    setChanging(true);
    setActiveTeamId(clubTeamId);
    const response = await fetch("/api/team-context", {
      method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ clubTeamId })
    });
    if (!response.ok) {
      setActiveTeamId(suppliedActiveTeamId ?? null);
      setChanging(false);
      return;
    }
    window.location.reload();
  }

  return <nav className="mb-5 flex flex-wrap gap-2 rounded-xl border border-border bg-card p-3" aria-label="Ploeg kiezen">
    {allowAll && <button type="button" disabled={changing} onClick={() => void selectTeam(null)} className={`rounded-lg px-3 py-2 text-sm font-semibold ${activeTeamId ? "text-textPrimary hover:bg-cardDeep" : "bg-accent text-page"}`}>Alles</button>}
    {teams.map(team => <button key={team.id} type="button" disabled={changing} onClick={() => void selectTeam(team.id)} className={`rounded-lg px-3 py-2 text-sm font-semibold ${activeTeamId === team.id ? "bg-accent text-page" : "text-textPrimary hover:bg-cardDeep"}`}>{team.name}</button>)}
  </nav>;
}
