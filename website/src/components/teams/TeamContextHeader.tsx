"use client";

import { useEffect, useState } from "react";
import { TeamContextPanel, type TeamContextOption } from "@/components/teams/TeamContextPanel";

type TeamOption = TeamContextOption;

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

  return <TeamContextPanel teams={teams} activeTeamId={activeTeamId} allowAll={allowAll} changing={changing} onSelect={teamId => void selectTeam(teamId)} />;
}
