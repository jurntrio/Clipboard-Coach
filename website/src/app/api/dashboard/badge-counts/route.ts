import { NextResponse } from "next/server";
import { getClubContext } from "@/lib/auth/active-club";
import { createAdminClient } from "@/lib/supabase/admin";
import { canAccessTeam, getClubAccess, hasClubPermission } from "@/lib/auth/club-access";
import { getUnresolvedClubNameCount } from "@/lib/belgian-clubs/unresolved-club-names";
import { downloadRbfaClubFixtures, filterUnlinkedRbfaFixtures } from "@/lib/rbfa-club-downloads";

export async function GET() {
  const context = await getClubContext();
  if (!context.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const clubId = context.activeClubId;
  const admin = createAdminClient();
  const access = clubId ? await getClubAccess(clubId, context.user) : null;
  const canApproveRequests = !!access && (["club_admin", "platform_admin"].includes(access.role) || hasClubPermission(access, "teams.manage_all"));
  const { data: profile } = await admin.from("profiles").select("account_role").eq("id", context.user.id).maybeSingle();
  const canReviewClubNames = context.isPlatformAdmin || profile?.account_role === "admin_viewer";
  const canReviewOfficialImports = !!clubId && !!access && ["club_admin", "platform_admin"].includes(access.role);

  const [{ count: unreadMailboxCount }, approvalCounts, unresolvedClubNameCount] = await Promise.all([
    clubId ? admin.from("mailbox_recipients").select("id, mailbox_messages!inner(club_id)", { count: "exact", head: true })
      .eq("profile_id", context.user.id).is("read_at", null).eq("mailbox_messages.club_id", clubId)
      : Promise.resolve({ count: 0 }),
    canApproveRequests ? Promise.all([
      admin.from("club_memberships").select("profile_id", { count: "exact", head: true }).eq("club_id", clubId).eq("status", "pending"),
      admin.from("club_teams").select("id", { count: "exact", head: true }).eq("club_id", clubId).eq("status", "pending"),
      admin.from("person_claim_reviews").select("id", { count: "exact", head: true }).eq("club_id", clubId).eq("status", "pending")
      ,admin.from("club_registration_requests").select("id", { count: "exact", head: true }).eq("club_id", clubId).eq("status", "pending")
    ]) : Promise.resolve([]),
    canReviewClubNames ? getUnresolvedClubNameCount(admin) : Promise.resolve(0)
  ]);
  const pendingApprovalCount = approvalCounts.reduce((total, result) => total + (result.count ?? 0), 0);
  let pendingOfficialImportCount = 0;
  if (canReviewOfficialImports && clubId) {
    const { data: club } = await admin.from("clubs").select("name, rbfa_registration_number").eq("id", clubId).maybeSingle();
    if (club?.rbfa_registration_number) {
      try {
        const fixtures = await downloadRbfaClubFixtures(club.name, club.rbfa_registration_number);
        const { data: matches } = await admin.from("matches").select("club_team_id, match_date, start_time, team_b_name").eq("club_id", clubId);
        pendingOfficialImportCount = filterUnlinkedRbfaFixtures(fixtures, matches ?? []).length;
      } catch {
        pendingOfficialImportCount = 0;
      }
    }
  }
  const canManageTraining = !!access && !access.readOnly && hasClubPermission(access, "training.manage");
  let unconfirmedTrainings: { id: string; training_date: string; start_time: string; teamName: string }[] = [];
  if (clubId && canManageTraining) {
    const { data: ownTrainer } = await admin.from("club_trainers").select("id").eq("club_id", clubId).eq("profile_id", context.user.id).maybeSingle();
    const { data: groupLinks } = ownTrainer
      ? await admin.from("player_group_staff").select("group_id").eq("trainer_id", ownTrainer.id)
      : { data: [] };
    const groupIds = new Set((groupLinks ?? []).map(link => link.group_id));
    const { data: pendingTrainings } = await admin.from("team_training_sessions")
      .select("id, club_team_id, player_group_id, staff_ids, training_date, start_time, club_teams(name), player_groups(name)")
      .eq("club_id", clubId).lt("training_date", new Date().toISOString().slice(0, 10))
      .is("attendance_confirmed_at", null).order("training_date", { ascending: false }).order("start_time", { ascending: false }).limit(100);
    unconfirmedTrainings = (pendingTrainings ?? []).filter(session =>
      access.teamIds === null
      || (!!session.club_team_id && access.teamIds.has(session.club_team_id))
      || (!!session.player_group_id && groupIds.has(session.player_group_id))
      || session.staff_ids.includes(ownTrainer?.id ?? "")
    ).map(session => ({
      id: session.id,
      training_date: session.training_date,
      start_time: session.start_time,
      teamName: (session.player_groups as unknown as { name: string } | null)?.name
        ?? (session.club_teams as unknown as { name: string } | null)?.name
        ?? "Training"
    }));
  }
  const canManageReports = !!access && !access.readOnly && hasClubPermission(access, "games.report.manage");
  let pendingMatchReports: { id: string; match_date: string; start_time: string | null; title: string }[] = [];
  if (clubId && canManageReports) {
    const hasClubWideReportScope = access.teamIds === null;
    const reportTeamIds = access.teamIds ?? new Set<string>();
    const today = new Date().toLocaleDateString("sv-SE", { timeZone: "Europe/Brussels" });
    const { data: playedMatches } = await admin.from("matches")
      .select("id, club_team_id, team_a_name, team_b_name, match_date, start_time, status")
      .eq("club_id", clubId).not("match_date", "is", null).or(`status.eq.finished,match_date.lt.${today}`)
      .order("match_date", { ascending: false }).order("start_time", { ascending: false }).limit(100);
    const accessibleMatches = (playedMatches ?? []).filter(match =>
      !!match.club_team_id
      && canAccessTeam(access, match.club_team_id)
      && (hasClubWideReportScope || reportTeamIds.has(match.club_team_id))
    );
    const matchIds = accessibleMatches.map(match => match.id);
    const { data: dossiers } = matchIds.length
      ? await admin.from("match_dossiers").select("match_id, general_report, positives, improvements, highlights, cards, chances, goal_events").in("match_id", matchIds)
      : { data: [] };
    const reportsByMatch = new Map((dossiers ?? []).map(dossier => [dossier.match_id, dossier]));
    pendingMatchReports = accessibleMatches.filter(match => {
      const dossier = reportsByMatch.get(match.id);
      if (!dossier) return true;
      return ![dossier.general_report, dossier.positives, dossier.improvements, dossier.highlights, dossier.cards, dossier.chances]
        .some(value => value?.trim()) && !(Array.isArray(dossier.goal_events) && dossier.goal_events.length);
    }).map(match => ({
      id: match.id,
      match_date: match.match_date!,
      start_time: match.start_time,
      title: `${match.team_a_name} – ${match.team_b_name}`
    }));
  }

  return NextResponse.json({ unreadMailboxCount: unreadMailboxCount ?? 0, pendingApprovalCount, canApproveRequests, unresolvedClubNameCount, canReviewClubNames, unconfirmedTrainings, pendingMatchReports, pendingOfficialImportCount, canReviewOfficialImports });
}
