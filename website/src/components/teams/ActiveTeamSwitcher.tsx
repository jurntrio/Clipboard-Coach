"use client";

import { useState } from "react";

export function ActiveTeamSwitcher({ teams, activeTeamId, allTeamsLabel = "Alle ploegen" }: {
  teams: Array<{ id: string; name: string }>;
  activeTeamId: string | null;
  allTeamsLabel?: string;
}) {
  const [open, setOpen] = useState(false);
  const [changing, setChanging] = useState(false);
  const teamsByName = new Map<string, { id: string; name: string }>();
  for (const team of teams) {
    const key = team.name.trim().toLocaleLowerCase();
    if (!teamsByName.has(key) || team.id === activeTeamId) teamsByName.set(key, team);
  }
  const uniqueTeams = Array.from(teamsByName.values());
  if (uniqueTeams.length <= 1) return null;
  const activeTeam = uniqueTeams.find((team) => team.id === activeTeamId) ?? null;
  const label = activeTeam ? activeTeam.name : allTeamsLabel;

  async function selectTeam(clubTeamId: string | null) {
    if (clubTeamId === activeTeamId) { setOpen(false); return; }
    setChanging(true);
    const response = await fetch("/api/team-context", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ clubTeamId })
    });
    if (!response.ok) { setChanging(false); return; }
    window.location.reload();
  }

  return (
    <div className="relative">
      <button
        type="button"
        disabled={changing}
        onClick={() => setOpen((current) => !current)}
        className="flex items-center gap-2 rounded-xl border border-borderButton bg-button px-4 py-3 text-sm font-semibold text-textPrimary hover:border-accent disabled:opacity-60"
      >
        {label}<span className={`text-accent transition ${open ? "rotate-90" : ""}`}>▶</span>
      </button>
      {open && (
        <div className="absolute left-0 z-20 mt-2 max-h-72 w-64 overflow-y-auto rounded-xl border border-border bg-cardAlt p-2 shadow-lg">
          <button
            type="button"
            onClick={() => void selectTeam(null)}
            className={`flex w-full items-center gap-2 rounded-lg px-2 py-1.5 text-left text-sm font-semibold hover:bg-cardHover ${!activeTeamId ? "text-accent" : "text-textPrimary"}`}
          >
            {!activeTeamId ? "✓" : <span className="w-3.5" />} {allTeamsLabel}
          </button>
          <div className="my-1 border-t border-borderSubtle" />
          {uniqueTeams.map((team) => (
            <button
              key={team.id}
              type="button"
              onClick={() => void selectTeam(team.id)}
              className={`flex w-full items-center gap-2 rounded-lg px-2 py-1.5 text-left text-sm font-semibold hover:bg-cardHover ${activeTeamId === team.id ? "text-accent" : "text-textPrimary"}`}
            >
              {activeTeamId === team.id ? "✓" : <span className="w-3.5" />} {team.name}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
