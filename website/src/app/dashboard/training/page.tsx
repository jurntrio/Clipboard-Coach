import { cookies } from "next/headers";
import Link from "next/link";
import { SectionHeader } from "@/components/ui/SectionHeader";
import { TrainingOverview } from "@/components/training/TrainingOverview";
import { getClubContext } from "@/lib/auth/active-club";
import { ACTIVE_TEAM_COOKIE, readActiveTeamSelection } from "@/lib/auth/active-team";
import { resolveDefaultTeamId } from "@/lib/auth/default-team";
import { createAdminClient } from "@/lib/supabase/admin";
import { getClubAccess, hasClubPermission } from "@/lib/auth/club-access";
import { TeamTrainingScheduler } from "@/components/teams/TeamTrainingScheduler";
import { TeamContextHeader } from "@/components/teams/TeamContextHeader";

export default async function TrainingPage() {
  const context = await getClubContext();
  const admin = createAdminClient();
  const clubId = context.activeClubId;
  const access = clubId && context.user ? await getClubAccess(clubId, context.user) : null;
  const { data: activeSeason } = clubId ? await admin.from("club_seasons").select("id").eq("club_id", clubId).eq("status", "ACTIVE").maybeSingle() : { data: null };
  const [{ data: options }, { data: intradeskEntitlement }, { data: builderEntitlement }, { data: ownTrainer }, { data: clubTeams }] = await Promise.all([
    clubId
      ? admin.from("club_match_options").select("id, club_id, option_type, label").eq("club_id", clubId).eq("active", true)
      : Promise.resolve({ data: [] }),
    clubId
      ? admin.from("club_module_entitlements").select("club_id").eq("club_id", clubId).eq("module_key", "intradesk").eq("enabled", true).maybeSingle()
      : Promise.resolve({ data: null }),
    clubId && !context.isPlatformAdmin
      ? admin.from("club_module_entitlements").select("club_id").eq("club_id", clubId).eq("module_key", "training_builder").eq("enabled", true).maybeSingle()
      : Promise.resolve({ data: { club_id: clubId } }),
    clubId && context.user
      ? admin.from("club_trainers").select("id").eq("club_id", clubId).eq("profile_id", context.user.id).maybeSingle()
      : Promise.resolve({ data: null }),
    clubId && activeSeason
      ? admin.from("club_teams").select("id, name").eq("club_id", clubId).eq("season_id", activeSeason.id).neq("status", "merged").order("display_order").order("name")
      : Promise.resolve({ data: [] })
  ]);
  const { data: groupLinks } = ownTrainer ? await admin.from("player_group_staff").select("group_id").eq("trainer_id", ownTrainer.id) : { data: [] };
  const accessibleGroupIds = new Set((groupLinks ?? []).map(link => link.group_id));

  const validTeamIds = access?.teamIds ?? new Set((clubTeams ?? []).map(team => team.id));
  const accessibleTeamIdsOrdered = (clubTeams ?? []).map(team => team.id).filter(id => validTeamIds.has(id));
  const selection = clubId ? readActiveTeamSelection(cookies().get(ACTIVE_TEAM_COOKIE)?.value, validTeamIds) : { teamId: null, explicitAll: false };
  let activeTeamId = selection.teamId;
  if (clubId && context.user && !activeTeamId && !selection.explicitAll) {
    activeTeamId = await resolveDefaultTeamId(admin, clubId, context.user.id, accessibleTeamIdsOrdered);
  }
  const restrictedTeamIds = activeTeamId ? [activeTeamId] : access?.teamIds ? Array.from(access.teamIds) : null;

  const orParts: string[] = [];
  if (activeTeamId) {
    orParts.push(`club_team_id.eq.${activeTeamId}`);
  } else if (restrictedTeamIds !== null) {
    if (restrictedTeamIds.length) orParts.push(`club_team_id.in.(${restrictedTeamIds.join(",")})`);
    if (accessibleGroupIds.size) orParts.push(`player_group_id.in.(${Array.from(accessibleGroupIds).join(",")})`);
    if (ownTrainer?.id) orParts.push(`staff_ids.cs.{${ownTrainer.id}}`);
  }
  const hasNoScope = restrictedTeamIds !== null && !orParts.length;
  let sessionsQuery = admin.from("team_training_sessions").select("id, club_team_id, player_group_id, training_date, start_time, season_phase, field_option_id, locker_room_option_id, staff_ids, personal_training_id, club_training_id, attendance_confirmed_at, club_teams(name), player_groups(name, icon)")
    .eq("club_id", clubId ?? "").order("training_date").order("start_time");
  if (orParts.length) sessionsQuery = sessionsQuery.or(orParts.join(","));
  const { data: sessions } = clubId && !hasNoScope ? await sessionsQuery : { data: [] };

  const visible = sessions ?? [];
  const teamOptions = (clubTeams ?? []).filter(team => validTeamIds.has(team.id));
  const groupIds = [...new Set([...accessibleGroupIds, ...visible.map(session => session.player_group_id).filter((id): id is string => !!id)])];
  const groupsQuery = admin.from("player_groups").select("id, name, icon, group_type, player_group_players(players(id, first_name, last_name)), player_group_staff(trainer_id, club_trainers(id, profile_id, display_name))").eq("club_id", clubId ?? "").eq("active", true).order("name");
  const { data: filterGroups } = access?.teamIds === null ? await groupsQuery : groupIds.length ? await groupsQuery.in("id", groupIds) : { data: [] };
  const optionNames = Object.fromEntries((options ?? []).map(option => [option.id, option.label]));
  const sessionIds = visible.map(session => session.id);
  const operationalTeamQuery = teamOptions.length ? admin.from("teams").select("club_team_id, players(id, role)").in("club_team_id", teamOptions.map(team => team.id)) : Promise.resolve({ data: [] });
  const [{ data: attendance }, { data: contactUpdates }, { data: operationalTeams }] = await Promise.all([
    sessionIds.length ? admin.from("team_training_attendance").select("training_session_id, attendance_status").in("training_session_id", sessionIds) : Promise.resolve({ data: [] }),
    sessionIds.length ? admin.from("training_availability_notifications").select("training_session_id").in("training_session_id", sessionIds).is("read_at", null) : Promise.resolve({ data: [] }),
    operationalTeamQuery
  ]);
  const rosterTotals = new Map((operationalTeams ?? []).map(team => [team.club_team_id, (team.players ?? []).filter(player => player.role !== "staff").length]));
  const summaries = visible.map(session => ({ ...session, attendance_total: (attendance ?? []).filter(row => row.training_session_id === session.id).length, attendance_absent: (attendance ?? []).filter(row => row.training_session_id === session.id && row.attendance_status === "absent").length, roster_total: session.club_team_id ? rosterTotals.get(session.club_team_id) ?? 0 : (attendance ?? []).filter(row => row.training_session_id === session.id).length, new_contact_updates: (contactUpdates ?? []).filter(row => row.training_session_id === session.id).length }));
  const canManage = !!access && !access.readOnly && hasClubPermission(access, "training.manage");

  return <div className="mx-auto max-w-6xl p-4 sm:p-8">
    <SectionHeader title="Trainingen" artworkSrc="/branding/training.webp" showHome={false} />
    <div className="mb-5 flex flex-wrap items-center justify-between gap-2">
      <nav className="flex flex-wrap gap-2 rounded-xl border border-border bg-card p-2" aria-label="Trainingstool">
        <Link href="/dashboard/training" className="rounded-lg bg-accent px-4 py-2 text-sm font-bold text-page">Overzicht</Link>
        {!!builderEntitlement && <Link href="/dashboard/training/new" className="rounded-lg px-4 py-2 text-sm font-bold text-textPrimary hover:bg-cardDeep">Losse training maken</Link>}
        <Link href="/dashboard/training/statistics" className="rounded-lg px-4 py-2 text-sm font-bold text-textPrimary hover:bg-cardDeep">Statistieken</Link>
        {intradeskEntitlement && <Link href="/dashboard/intradesk" className="rounded-lg px-4 py-2 text-sm font-bold text-textPrimary hover:bg-cardDeep">Open Intradesk</Link>}
      </nav>
    </div>
    <TeamContextHeader teams={teamOptions} activeTeamId={activeTeamId} />
    {!!filterGroups?.length && <section className="mb-5"><h2 className="mb-3 text-lg font-bold text-textBright">Mijn Extra groepen</h2><div className="grid gap-3 md:grid-cols-2">{filterGroups.map(group => {
      const members = (group.player_group_players ?? []).flatMap(link => {
        const value = link.players as unknown as { id: string; first_name: string; last_name: string } | { id: string; first_name: string; last_name: string }[] | null;
        return value ? (Array.isArray(value) ? value : [value]) : [];
      });
      const groupStaff = (group.player_group_staff ?? []).flatMap(link => {
        const value = link.club_trainers as unknown as { id: string; profile_id: string | null; display_name: string } | { id: string; profile_id: string | null; display_name: string }[] | null;
        return value ? (Array.isArray(value) ? value : [value]) : [];
      });
      return <details key={group.id} className="rounded-xl border border-dashed border-accent/40 bg-card"><summary className="cursor-pointer list-none p-4"><strong className="text-textBright">{group.icon ?? "＋"} {group.name}</strong><p className="mt-1 text-xs text-textMuted">{members.length} spelers · {groupStaff.map(person => person.display_name).join(", ") || "Geen staf"}</p></summary><div className="border-t border-borderSubtle p-4"><div className="flex flex-wrap gap-2">{members.map(player => <span key={player.id} className="rounded-full bg-cardDeep px-2.5 py-1 text-xs text-textPrimary">{player.first_name} {player.last_name}</span>)}</div>{canManage && <div className="mt-4"><TeamTrainingScheduler groupId={group.id} trainers={groupStaff} assignedTrainerIds={groupStaff.map(person => person.id)} options={(options ?? []) as any} /></div>}{!canManage && <p className="mt-3 text-xs text-textMuted">Je kunt deze groep en haar trainingen bekijken. Trainingen aanmaken vereist het afzonderlijke recht ‘Trainingen toevoegen en versies maken’.</p>}</div></details>;
    })}</div></section>}
    <TrainingOverview sessions={summaries as any} optionNames={optionNames} canManage={canManage} />
  </div>;
}
