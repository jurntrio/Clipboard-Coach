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
import { useI18n } from "@/i18n/client";
import { useActiveClub } from "@/components/clubs/ActiveClubProvider";
import { ImportRosterModal } from "@/components/teams/ImportRosterModal";

type TeamWithPlayers = Team & { players: Player[]; can_edit_roster?: boolean; can_import_roster?: boolean; club_managed?: boolean };
type ClipSummary = {
  id: string;
  team_id: string | null;
  audience_type: "full_team" | "selected_players" | "specific_players";
  audience_player_ids: string[];
  clip_segments: { tags: { player_ids: string[] } | null }[];
};
type LinkedStaff = { id: string; team_id: string; user_id: string; full_name: string; removable: boolean };
type StaffInvitation = { id: string; team_id: string; team_name: string; created_at: string };

export default function TeamsPage() {
  const { t } = useI18n();
  const { activeClubId } = useActiveClub();
  const [teams, setTeams] = useState<TeamWithPlayers[]>([]);
  const [clips, setClips] = useState<ClipSummary[]>([]);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [addPlayerTarget, setAddPlayerTarget] = useState<{ teamId: string; teamName: string; role: "player" | "staff" } | null>(null);
  const [editingTeamId, setEditingTeamId] = useState<string | null>(null);
  const [collapsed, setCollapsed] = useState<Record<string, boolean>>({});
  const [teamNameDraft, setTeamNameDraft] = useState("");
  const [deleteTarget, setDeleteTarget] = useState<{ kind: "team" | "player" | "linked-staff"; id: string; name: string } | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [currentUserId, setCurrentUserId] = useState("");
  const [linkedStaff, setLinkedStaff] = useState<LinkedStaff[]>([]);
  const [staffInvitations, setStaffInvitations] = useState<StaffInvitation[]>([]);
  const [linkStaffTarget, setLinkStaffTarget] = useState<{ teamId: string; teamName: string } | null>(null);
  const [importRosterTarget, setImportRosterTarget] = useState<{ teamId: string; clubTeamId: string | null; teamName: string } | null>(null);
  const supabase = createClient();

  useEffect(() => {
    void supabase.auth.getUser().then(({ data }) => setCurrentUserId(data.user?.id ?? ""));
    loadTeams();
    loadClips();
    loadLinkedStaff();
  }, [activeClubId]);

  async function loadTeams() {
    const response = await fetch("/api/teams");
    if (!response.ok) return;
    const body = await response.json() as { teams: TeamWithPlayers[] };
    const loaded = body.teams ?? [];
    setTeams([...loaded].sort((a, b) => Number(a.name.trim().toUpperCase() === "EXTRA") - Number(b.name.trim().toUpperCase() === "EXTRA") || a.name.localeCompare(b.name)));
  }

  async function loadClips() {
    const { data } = await supabase.from("clips").select("id, team_id, audience_type, audience_player_ids, clip_segments(tags(player_ids))");
    setClips((data as unknown as ClipSummary[] | null) ?? []);
  }

  async function loadLinkedStaff() {
    const response = await fetch("/api/team-staff");
    if (!response.ok) return;
    const body = await response.json() as { members: LinkedStaff[]; invitations?: StaffInvitation[] };
    setLinkedStaff(body.members);
    setStaffInvitations(body.invitations ?? []);
  }

  async function answerStaffInvitation(invitationId: string, action: "accept" | "decline") {
    const response = await fetch("/api/team-staff", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ invitationId, action })
    });
    if (!response.ok) return;
    await Promise.all([loadTeams(), loadLinkedStaff()]);
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
    await supabase.from("teams").insert({ coach_id: user.id, name: "EXTRA" });
    await loadTeams();
    await loadLinkedStaff();
  }

  return (
    <div className="p-8 max-w-6xl mx-auto">
      <SectionHeader title={t("common.teams")} artworkSrc="/branding/teams.png" showHome={false} />

      {staffInvitations.length > 0 && <div className="mb-6 space-y-3">{staffInvitations.map((invitation) => <div key={invitation.id} className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-accent/40 bg-accentDim p-4"><p className="text-sm text-textPrimary">{t("team.invitedTo", { team: invitation.team_name })}</p><div className="flex gap-2"><button type="button" onClick={() => void answerStaffInvitation(invitation.id, "decline")} className="rounded-lg border border-borderButton px-3 py-2 text-sm text-textSecondary">{t("team.declineInvitation")}</button><button type="button" onClick={() => void answerStaffInvitation(invitation.id, "accept")} className="rounded-lg bg-accent px-3 py-2 text-sm font-semibold text-page">{t("team.acceptInvitation")}</button></div></div>)}</div>}

      <div className="flex flex-col gap-6">
        {teams.length === 0 && (
          <div className="border border-borderButton rounded-lg bg-cardAlt p-4 text-textSecondary">
            {t("team.none")}
          </div>
        )}

        {teams.map((team) => {
          const ownsTeam = team.coach_id === currentUserId;
          const canEditRoster = ownsTeam || team.can_edit_roster === true;
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
                      {t("common.save")}
                    </button>
                    <button onClick={() => setEditingTeamId(null)} className="px-3 py-1.5 text-textSecondary text-sm">
                      {t("common.cancel")}
                    </button>
                  </div>
                ) : (
                  <>
                    <div className="flex items-center gap-2.5">
                      <strong className="text-textCardTitle">{team.name}</strong>
                      {team.club_managed && <span className="rounded-full bg-blue-500/15 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-blue-300">{canEditRoster ? "Clubteam · bewerken toegestaan" : "Beheerd door club"}</span>}
                      <small className="text-textMuted text-sm">
                        {t("team.summary", { players: players.length, staff: staff.length + registeredStaff.length })}
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
                        {t("common.edit")}
                      </button>
                      <button onClick={() => setDeleteTarget({ kind: "team", id: team.id, name: team.name })} className="text-textSecondary hover:text-red-400 text-sm">
                        {t("team.delete")}
                      </button>
                    </div>}
                    <button type="button" onClick={() => setCollapsed((current) => ({ ...current, [team.id]: !current[team.id] }))} aria-label="Spelerslijst in- of uitklappen" className="ml-2 text-accent">
                      <span className={`inline-block transition ${collapsed[team.id] ? "" : "rotate-90"}`}>▶</span>
                    </button>
                  </>
                )}
              </div>

              {!collapsed[team.id] && <>
              <div className="flex flex-col gap-2.5 p-3.5">
                {players.map((player) => (
                  <PlayerCard key={player.id} player={player} clipCount={clipCountFor(team, player)} onDelete={canEditRoster ? () => setDeleteTarget({ kind: "player", id: player.id, name: `${player.first_name} ${player.last_name}`.trim() }) : undefined} />
                ))}
                {canEditRoster && <button type="button" onClick={() => setAddPlayerTarget({ teamId: team.id, teamName: team.name, role: "player" })} className="min-h-14 rounded-lg border border-dashed border-accent/60 bg-accentDim px-4 py-3 text-left text-sm font-semibold text-accent hover:border-accent">+ {t("team.addPlayer").replace("+ ", "")}</button>}
                {(ownsTeam || team.can_import_roster === true) && <button type="button" onClick={() => setImportRosterTarget({ teamId: team.id, clubTeamId: team.club_team_id ?? null, teamName: team.name })} className="min-h-11 rounded-lg border border-borderButton bg-button px-4 py-2 text-left text-sm font-semibold text-textPrimary hover:border-accent hover:text-accent">PSD/Excel spelerslijst importeren</button>}
              </div>

              <div className="mt-1 pt-2.5 mx-3.5 mb-3.5 border-t border-borderSubtle">
                <p className="text-textMuted text-xs font-bold uppercase tracking-wide mb-2">{t("team.staff")}</p>
                <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-2.5">
                  {staff.map((player) => (
                    <PlayerCard key={player.id} player={player} clipCount={clipCountFor(team, player)} onDelete={canEditRoster ? () => setDeleteTarget({ kind: "player", id: player.id, name: `${player.first_name} ${player.last_name}`.trim() }) : undefined} />
                  ))}
                  {registeredStaff.map((member) => <div key={member.id} className="relative flex min-h-24 flex-col items-center justify-center rounded-lg border border-accent/40 bg-accentDim p-3 text-center"><div className="grid h-10 w-10 place-items-center rounded-full bg-avatar font-bold text-accent">{member.full_name.split(/\s+/).map((part) => part[0]).slice(0, 2).join("").toUpperCase()}</div><span className="mt-2 text-sm text-textCard">{member.full_name}</span><span className="text-[10px] uppercase tracking-wide text-accent">{t("team.registeredStaff")}</span>{member.removable && <button type="button" onClick={() => setDeleteTarget({ kind: "linked-staff", id: member.id, name: member.full_name })} className="absolute right-2 top-2 rounded px-1.5 py-0.5 text-xs text-textMuted hover:bg-red-500/15 hover:text-red-400" aria-label={t("team.removeMessage", { name: member.full_name })}>{t("common.remove")}</button>}</div>)}
                  {ownsTeam && <AddPlayerTile
                    label={t("team.addStaff")}
                    onClick={() => setAddPlayerTarget({ teamId: team.id, teamName: team.name, role: "staff" })}
                  />}
                  {ownsTeam && <button type="button" onClick={() => setLinkStaffTarget({ teamId: team.id, teamName: team.name })} className="min-h-24 rounded-lg border border-dashed border-accent/60 bg-accentDim p-3 text-sm font-semibold text-accent hover:border-accent">{t("team.linkRegistered")}</button>}
                </div>
              </div>
              </>}
            </article>
          );
        })}
      </div>

      <div className="flex flex-wrap justify-end gap-3 mt-6">
        {!teams.some((team) => team.name.trim().toUpperCase() === "EXTRA") && (
          <button onClick={() => void createExtraGroup()} className="px-5 py-2.5 border border-borderButton bg-button text-textPrimary rounded-lg font-semibold hover:border-accent">{t("team.extraGroup")}</button>
        )}
        <button
          onClick={() => setShowCreateModal(true)}
          className="px-5 py-2.5 bg-accent text-page rounded-lg font-semibold hover:opacity-90"
        >
          {t("team.create")}
        </button>
      </div>

      {showCreateModal && (
        <CreateTeamModal
          onClose={() => setShowCreateModal(false)}
          onCreated={() => { void Promise.all([loadTeams(), loadLinkedStaff()]); }}
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
      {importRosterTarget && <ImportRosterModal teamId={importRosterTarget.teamId} clubTeamId={importRosterTarget.clubTeamId} teamName={importRosterTarget.teamName} onClose={() => setImportRosterTarget(null)} onImported={() => void loadTeams()} />}
      <ConfirmDialog open={!!deleteTarget} title={deleteTarget?.kind === "team" ? t("team.deleteTeam") : deleteTarget?.kind === "linked-staff" ? t("team.removeLinked") : t("team.deletePlayer")} message={deleteTarget?.kind === "team" ? t("team.deleteTeamMessage", { name: deleteTarget.name }) : t("team.removeMessage", { name: deleteTarget?.name ?? "" })} confirmLabel={deleteTarget?.kind === "linked-staff" ? t("common.remove") : t("team.delete")} busy={deleting} onCancel={() => setDeleteTarget(null)} onConfirm={() => void confirmDelete()} />
    </div>
  );
}
