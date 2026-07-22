"use client";

import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import type { Player, Team } from "@/types/database";
import { SectionHeader } from "@/components/ui/SectionHeader";
import { PlayerCard } from "@/components/teams/PlayerCard";
import { AddPlayerTile } from "@/components/teams/AddPlayerTile";
import { AddPlayerModal } from "@/components/teams/AddPlayerModal";
import { CreateTeamModal } from "@/components/teams/CreateTeamModal";
import { ConfirmDialog } from "@/components/ui/ConfirmDialog";
import { LinkStaffModal } from "@/components/teams/LinkStaffModal";

type TeamWithPlayers = Team & { players: Player[] };
type ClipSummary = {
  id: string;
  team_id: string | null;
  audience_type: "full_team" | "selected_players" | "specific_players";
  audience_player_ids: string[];
  clip_segments: { tags: { player_ids: string[] } | null }[];
};
type LinkedStaff = { id: string; team_id: string; user_id: string; full_name: string; removable: boolean };

export default function TeamsPage() {
  const [teams, setTeams] = useState<TeamWithPlayers[]>([]);
  const [clips, setClips] = useState<ClipSummary[]>([]);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [addPlayerTarget, setAddPlayerTarget] = useState<{ teamId: string; teamName: string; role: "player" | "staff" } | null>(null);
  const [editingTeamId, setEditingTeamId] = useState<string | null>(null);
  const [teamNameDraft, setTeamNameDraft] = useState("");
  const [deleteTarget, setDeleteTarget] = useState<{ kind: "team" | "player" | "linked-staff"; id: string; name: string } | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [currentUserId, setCurrentUserId] = useState("");
  const [linkedStaff, setLinkedStaff] = useState<LinkedStaff[]>([]);
  const [linkStaffTarget, setLinkStaffTarget] = useState<{ teamId: string; teamName: string } | null>(null);
  const supabase = createClient();

  useEffect(() => {
    void supabase.auth.getUser().then(({ data }) => setCurrentUserId(data.user?.id ?? ""));
    loadTeams();
    loadClips();
    loadLinkedStaff();
  }, []);

  async function loadTeams() {
    const { data } = await supabase
      .from("teams")
      .select("*, players(*)")
      .order("created_at", { ascending: false });

    const loaded = (data as TeamWithPlayers[] | null) ?? [];
    setTeams([...loaded].sort((a, b) => Number(a.name.trim().toUpperCase() === "EXTRA") - Number(b.name.trim().toUpperCase() === "EXTRA") || a.name.localeCompare(b.name)));
  }

  async function loadClips() {
    const { data } = await supabase.from("clips").select("id, team_id, audience_type, audience_player_ids, clip_segments(tags(player_ids))");
    setClips((data as unknown as ClipSummary[] | null) ?? []);
  }

  async function loadLinkedStaff() {
    const response = await fetch("/api/team-staff");
    if (!response.ok) return;
    const body = await response.json() as { members: LinkedStaff[] };
    setLinkedStaff(body.members);
  }

  function clipCountFor(team: Team, player: Player) {
    return clips.filter((clip) => {
      if (clip.audience_player_ids.includes(player.id) || clip.clip_segments.some((segment) => segment.tags?.player_ids.includes(player.id))) return true;
      return clip.team_id === team.id && clip.audience_type === "full_team";
    }).length;
  }

  async function saveTeamName(teamId: string) {
    if (!teamNameDraft.trim()) return;
    await supabase.from("teams").update({ name: teamNameDraft.trim() }).eq("id", teamId);
    setEditingTeamId(null);
    loadTeams();
  }

  async function confirmDelete() {
    if (!deleteTarget) return;
    setDeleting(true);
    if (deleteTarget.kind === "linked-staff") {
      const response = await fetch("/api/team-staff", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ membershipId: deleteTarget.id })
      });
      setDeleting(false);
      if (!response.ok) return;
      setDeleteTarget(null);
      await loadLinkedStaff();
      return;
    }
    await supabase.from(deleteTarget.kind === "team" ? "teams" : "players").delete().eq("id", deleteTarget.id);
    setDeleting(false);
    setDeleteTarget(null);
    await loadTeams();
  }

  async function createExtraGroup() {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user || teams.some((team) => team.name.trim().toUpperCase() === "EXTRA")) return;
    const { data: team } = await supabase.from("teams").insert({ coach_id: user.id, name: "EXTRA" }).select("id").single();
    if (team) await supabase.from("team_staff_members").insert({ team_id: team.id, user_id: user.id, added_by: user.id });
    await loadTeams();
  }

  return (
    <div className="p-8 max-w-6xl mx-auto">
      <SectionHeader title="Teams" artworkSrc="/branding/teams.png" />

      <div className="flex flex-col gap-6">
        {teams.length === 0 && (
          <div className="border border-borderButton rounded-lg bg-cardAlt p-4 text-textSecondary">
            No teams yet. Create one to get started.
          </div>
        )}

        {teams.map((team) => {
          const ownsTeam = team.coach_id === currentUserId;
          const players = [...team.players].filter((p) => p.role !== "staff");
          const staff = [...team.players].filter((p) => p.role === "staff");
          const registeredStaff = linkedStaff.filter((member) => member.team_id === team.id);

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
                        {players.length} players · {staff.length + registeredStaff.length} staff
                      </small>
                    </div>
                    {ownsTeam && <div className="flex gap-2">
                      <button
                        onClick={() => {
                          setEditingTeamId(team.id);
                          setTeamNameDraft(team.name);
                        }}
                        className="text-textSecondary hover:text-textPrimary text-sm"
                      >
                        Edit
                      </button>
                      <button onClick={() => setDeleteTarget({ kind: "team", id: team.id, name: team.name })} className="text-textSecondary hover:text-red-400 text-sm">
                        Delete
                      </button>
                    </div>}
                  </>
                )}
              </div>

              <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-2.5 p-3.5">
                {players.map((player) => (
                  <PlayerCard key={player.id} player={player} clipCount={clipCountFor(team, player)} onDelete={() => setDeleteTarget({ kind: "player", id: player.id, name: `${player.first_name} ${player.last_name}`.trim() })} />
                ))}
                {ownsTeam && <AddPlayerTile
                  label="Add player"
                  onClick={() => setAddPlayerTarget({ teamId: team.id, teamName: team.name, role: "player" })}
                />}
              </div>

              <div className="mt-1 pt-2.5 mx-3.5 mb-3.5 border-t border-borderSubtle">
                <p className="text-textMuted text-xs font-bold uppercase tracking-wide mb-2">Staff</p>
                <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-2.5">
                  {staff.map((player) => (
                    <PlayerCard key={player.id} player={player} clipCount={clipCountFor(team, player)} onDelete={() => setDeleteTarget({ kind: "player", id: player.id, name: `${player.first_name} ${player.last_name}`.trim() })} />
                  ))}
                  {registeredStaff.map((member) => <div key={member.id} className="relative flex min-h-24 flex-col items-center justify-center rounded-lg border border-accent/40 bg-accentDim p-3 text-center"><div className="grid h-10 w-10 place-items-center rounded-full bg-avatar font-bold text-accent">{member.full_name.split(/\s+/).map((part) => part[0]).slice(0, 2).join("").toUpperCase()}</div><span className="mt-2 text-sm text-textCard">{member.full_name}</span><span className="text-[10px] uppercase tracking-wide text-accent">Registered staff</span>{member.removable && <button type="button" onClick={() => setDeleteTarget({ kind: "linked-staff", id: member.id, name: member.full_name })} className="absolute right-2 top-2 rounded px-1.5 py-0.5 text-xs text-textMuted hover:bg-red-500/15 hover:text-red-400" aria-label={`Remove ${member.full_name} from team`}>Remove</button>}</div>)}
                  {ownsTeam && <AddPlayerTile
                    label="Add staff"
                    onClick={() => setAddPlayerTarget({ teamId: team.id, teamName: team.name, role: "staff" })}
                  />}
                  {ownsTeam && <button type="button" onClick={() => setLinkStaffTarget({ teamId: team.id, teamName: team.name })} className="min-h-24 rounded-lg border border-dashed border-accent/60 bg-accentDim p-3 text-sm font-semibold text-accent hover:border-accent">+ Link registered user</button>}
                </div>
              </div>
            </article>
          );
        })}
      </div>

      <div className="flex flex-wrap justify-end gap-3 mt-6">
        {!teams.some((team) => team.name.trim().toUpperCase() === "EXTRA") && (
          <button onClick={() => void createExtraGroup()} className="px-5 py-2.5 border border-borderButton bg-button text-textPrimary rounded-lg font-semibold hover:border-accent">+ EXTRA group</button>
        )}
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
      {linkStaffTarget && <LinkStaffModal teamId={linkStaffTarget.teamId} teamName={linkStaffTarget.teamName} onClose={() => setLinkStaffTarget(null)} onLinked={() => void loadLinkedStaff()} />}
      <ConfirmDialog open={!!deleteTarget} title={deleteTarget?.kind === "team" ? "Delete team?" : deleteTarget?.kind === "linked-staff" ? "Remove linked staff?" : "Delete player?"} message={deleteTarget?.kind === "team" ? `Delete ${deleteTarget.name} and all its players and staff? This cannot be undone.` : `Remove ${deleteTarget?.name} from this team? This cannot be undone.`} confirmLabel={deleteTarget?.kind === "linked-staff" ? "Remove" : "Delete"} busy={deleting} onCancel={() => setDeleteTarget(null)} onConfirm={() => void confirmDelete()} />
    </div>
  );
}
