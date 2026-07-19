"use client";

import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import type { Clip, Player, Team } from "@/types/database";
import { SectionHeader } from "@/components/ui/SectionHeader";
import { PlayerCard } from "@/components/teams/PlayerCard";
import { AddPlayerTile } from "@/components/teams/AddPlayerTile";
import { AddPlayerModal } from "@/components/teams/AddPlayerModal";
import { CreateTeamModal } from "@/components/teams/CreateTeamModal";

type TeamWithPlayers = Team & { players: Player[] };
type ClipSummary = Pick<Clip, "id" | "team_id" | "audience_type" | "audience_player_ids">;

export default function TeamsPage() {
  const [teams, setTeams] = useState<TeamWithPlayers[]>([]);
  const [clips, setClips] = useState<ClipSummary[]>([]);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [addPlayerTarget, setAddPlayerTarget] = useState<{ teamId: string; teamName: string; role: "player" | "staff" } | null>(null);
  const [editingTeamId, setEditingTeamId] = useState<string | null>(null);
  const [teamNameDraft, setTeamNameDraft] = useState("");
  const supabase = createClient();

  useEffect(() => {
    loadTeams();
    loadClips();
  }, []);

  async function loadTeams() {
    const { data } = await supabase
      .from("teams")
      .select("*, players(*)")
      .order("created_at", { ascending: false });

    setTeams((data as TeamWithPlayers[] | null) ?? []);
  }

  async function loadClips() {
    const { data } = await supabase.from("clips").select("id, team_id, audience_type, audience_player_ids");
    setClips(data ?? []);
  }

  function clipCountFor(team: Team, player: Player) {
    return clips.filter(
      (clip) =>
        clip.team_id === team.id &&
        (clip.audience_type === "full_team" || clip.audience_player_ids.includes(player.id))
    ).length;
  }

  async function deleteTeam(teamId: string) {
    if (!confirm("Delete this team and all its players?")) return;
    await supabase.from("teams").delete().eq("id", teamId);
    loadTeams();
  }

  async function saveTeamName(teamId: string) {
    if (!teamNameDraft.trim()) return;
    await supabase.from("teams").update({ name: teamNameDraft.trim() }).eq("id", teamId);
    setEditingTeamId(null);
    loadTeams();
  }

  async function deletePlayer(playerId: string) {
    await supabase.from("players").delete().eq("id", playerId);
    loadTeams();
  }

  return (
    <div className="p-8 max-w-4xl mx-auto">
      <SectionHeader title="Teams" artworkSrc="/branding/teams.png" />

      <div className="flex flex-col gap-6">
        {teams.length === 0 && (
          <div className="border border-borderButton rounded-lg bg-cardAlt p-4 text-textSecondary">
            No teams yet. Create one to get started.
          </div>
        )}

        {teams.map((team) => {
          const players = [...team.players].filter((p) => p.role !== "staff");
          const staff = [...team.players].filter((p) => p.role === "staff");

          return (
            <article key={team.id} className="bg-card border border-border rounded-xl overflow-hidden">
              <div className="flex items-center justify-between px-4 py-3.5 border-b border-borderSubtle bg-cardDeep">
                {editingTeamId === team.id ? (
                  <div className="flex items-center gap-2 w-full">
                    <input
                      value={teamNameDraft}
                      onChange={(event) => setTeamNameDraft(event.target.value)}
                      className="flex-1 px-3 py-1.5 bg-input text-textPrimary rounded-lg border border-border text-sm"
                      autoFocus
                    />
                    <button onClick={() => saveTeamName(team.id)} className="px-3 py-1.5 bg-accent text-page rounded-lg text-sm font-semibold">
                      Save
                    </button>
                    <button onClick={() => setEditingTeamId(null)} className="px-3 py-1.5 text-textSecondary text-sm">
                      Cancel
                    </button>
                  </div>
                ) : (
                  <>
                    <div className="flex items-center gap-2.5">
                      <strong className="text-textCardTitle">{team.name}</strong>
                      <small className="text-textMuted text-sm">
                        {players.length} players · {staff.length} staff
                      </small>
                    </div>
                    <div className="flex gap-2">
                      <button
                        onClick={() => {
                          setEditingTeamId(team.id);
                          setTeamNameDraft(team.name);
                        }}
                        className="text-textSecondary hover:text-textPrimary text-sm"
                      >
                        Edit
                      </button>
                      <button onClick={() => deleteTeam(team.id)} className="text-textSecondary hover:text-red-400 text-sm">
                        Delete
                      </button>
                    </div>
                  </>
                )}
              </div>

              <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-2.5 p-3.5">
                {players.map((player) => (
                  <PlayerCard key={player.id} player={player} clipCount={clipCountFor(team, player)} onDelete={() => deletePlayer(player.id)} />
                ))}
                <AddPlayerTile
                  label="Add player"
                  onClick={() => setAddPlayerTarget({ teamId: team.id, teamName: team.name, role: "player" })}
                />
              </div>

              <div className="mt-1 pt-2.5 mx-3.5 mb-3.5 border-t border-borderSubtle">
                <p className="text-textMuted text-xs font-bold uppercase tracking-wide mb-2">Staff</p>
                <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-2.5">
                  {staff.map((player) => (
                    <PlayerCard key={player.id} player={player} clipCount={clipCountFor(team, player)} onDelete={() => deletePlayer(player.id)} />
                  ))}
                  <AddPlayerTile
                    label="Add staff"
                    onClick={() => setAddPlayerTarget({ teamId: team.id, teamName: team.name, role: "staff" })}
                  />
                </div>
              </div>
            </article>
          );
        })}
      </div>

      <div className="flex justify-end mt-6">
        <button
          onClick={() => setShowCreateModal(true)}
          className="px-5 py-2.5 bg-accent text-page rounded-lg font-semibold hover:opacity-90"
        >
          Create Team
        </button>
      </div>

      {showCreateModal && (
        <CreateTeamModal
          onClose={() => setShowCreateModal(false)}
          onCreated={loadTeams}
        />
      )}

      {addPlayerTarget && (
        <AddPlayerModal
          teamId={addPlayerTarget.teamId}
          teamName={addPlayerTarget.teamName}
          role={addPlayerTarget.role}
          onClose={() => setAddPlayerTarget(null)}
          onAdded={loadTeams}
        />
      )}
    </div>
  );
}
