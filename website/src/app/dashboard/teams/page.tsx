"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { SectionHeader } from "@/components/ui/SectionHeader";
import { useActiveClub } from "@/components/clubs/ActiveClubProvider";
import { useI18n } from "@/i18n/client";
import type { Team } from "@/types/database";
import { TeamContextHeader } from "@/components/teams/TeamContextHeader";

type TeamSummary = Team & { player_count?: number };
type StaffInvitation = { id: string; team_name: string };

export default function TeamsPage() {
  const router = useRouter();
  const { t } = useI18n();
  const { activeClubId } = useActiveClub();
  const [teams, setTeams] = useState<TeamSummary[]>([]);
  const [invitations, setInvitations] = useState<StaffInvitation[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    void Promise.all([loadTeams(), loadInvitations()]).finally(() => setLoading(false));
  }, [activeClubId]);

  async function loadTeams() {
    const response = await fetch("/api/teams");
    if (!response.ok) return;
    const body = await response.json() as { teams: TeamSummary[] };
    const visibleTeams = (body.teams ?? []).filter((team) => team.name.trim().toUpperCase() !== "EXTRA");
    setTeams(visibleTeams);
    if (visibleTeams.length === 1) router.replace(`/dashboard/teams/${visibleTeams[0].id}`);
  }

  async function loadInvitations() {
    const response = await fetch("/api/team-staff?invitationsOnly=true");
    if (!response.ok) return;
    const body = await response.json() as { invitations?: StaffInvitation[] };
    setInvitations(body.invitations ?? []);
  }

  async function answerInvitation(invitationId: string, action: "accept" | "decline") {
    const response = await fetch("/api/team-staff", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ invitationId, action })
    });
    if (!response.ok) return;
    await Promise.all([loadTeams(), loadInvitations()]);
  }

  return <div className="mx-auto max-w-6xl p-5 sm:p-7">
    <SectionHeader title="Spelerslijsten" subtitle="Open een ploeg om de volledige spelerslijst en de individuele spelersfiches te bekijken." artworkSrc="/branding/cbcs_black_icons/selecties.png" showHome={false} />
    <TeamContextHeader />

    {invitations.length > 0 && <div className="mb-6 space-y-3">{invitations.map((invitation) => <div key={invitation.id} className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-accent/40 bg-accentDim p-4"><p className="text-sm text-textPrimary">{t("team.invitedTo", { team: invitation.team_name })}</p><div className="flex gap-2"><button type="button" onClick={() => void answerInvitation(invitation.id, "decline")} className="rounded-lg border border-borderButton px-3 py-2 text-sm text-textSecondary">{t("team.declineInvitation")}</button><button type="button" onClick={() => void answerInvitation(invitation.id, "accept")} className="rounded-lg bg-accent px-3 py-2 text-sm font-semibold text-page">{t("team.acceptInvitation")}</button></div></div>)}</div>}

    {loading && <p className="rounded-xl border border-border bg-card p-5 text-sm text-textMuted">{t("team.loading")}</p>}
    {!loading && teams.length === 0 && <p className="rounded-xl border border-border bg-card p-5 text-sm text-textMuted">{t("team.none")}</p>}
    <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
      {teams.map((team) => <Link key={team.id} href={`/dashboard/teams/${team.id}`} className="group flex min-h-32 items-center justify-between rounded-2xl border border-border bg-card p-5 transition hover:-translate-y-0.5 hover:border-accent hover:bg-cardHover focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent">
        <div><h2 className="text-lg font-bold text-textBright group-hover:text-accent">{team.name}</h2>{typeof team.player_count === "number" && <p className="mt-1 text-sm text-textMuted">{t("team.playerCount", { count: team.player_count })}</p>}</div>
        <span aria-hidden="true" className="text-2xl text-accent">›</span>
      </Link>)}
    </div>
  </div>;
}
