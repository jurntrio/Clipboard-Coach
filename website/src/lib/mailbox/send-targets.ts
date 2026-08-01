import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";
import { getClubAccess } from "@/lib/auth/club-access";

export type MailboxTarget =
  | { type: "team_staff"; clubTeamId: string }
  | { type: "team_contacts"; clubTeamId: string }
  | { type: "user"; profileId: string };

export type MailboxPerson = { profileId: string; name: string };

export type MailboxTeamGroup = {
  clubTeamId: string;
  teamName: string;
  staff: MailboxPerson[];
  contacts: MailboxPerson[];
};

export type MailboxSendTargets = { teamGroups: MailboxTeamGroup[] };

// PostgREST unwraps a `returns setof uuid` function either as raw scalar rows
// or as single-column objects depending on client version -- accept both.
function unwrapIds(rows: unknown[] | null): string[] {
  return (rows ?? []).map((row) => (typeof row === "string" ? row : (Object.values(row as object)[0] as string)));
}

async function getGuardianClubTeamIds(clubId: string, userId: string): Promise<string[]> {
  const supabase = createClient();
  const { data: rows } = await supabase.rpc("guardian_dashboard_players");
  const teamIdColumn: (string | null)[] = (rows ?? []).map((row: { team_id: string | null }) => row.team_id);
  const operationalTeamIds = Array.from(new Set(teamIdColumn.filter((id): id is string => !!id)));
  if (!operationalTeamIds.length) return [];

  const admin = createAdminClient();
  const { data: teams } = await admin.from("teams").select("id, club_team_id").in("id", operationalTeamIds);
  const clubTeamIds = (teams ?? []).map((team) => team.club_team_id).filter((id): id is string => !!id);
  if (!clubTeamIds.length) return [];

  const { data: ownedTeams } = await admin.from("club_teams").select("id").eq("club_id", clubId).in("id", clubTeamIds);
  return (ownedTeams ?? []).map((team) => team.id);
}

async function toPeople(admin: ReturnType<typeof createAdminClient>, profileIds: string[]): Promise<MailboxPerson[]> {
  if (!profileIds.length) return [];
  const { data } = await admin.from("profiles").select("id, full_name").in("id", profileIds);
  return (data ?? []).map((profile) => ({ profileId: profile.id, name: profile.full_name?.trim() || "Clublid" }));
}

// Elk team waar de gebruiker via staf-toegang of als contactpersoon bij mag, biedt zowel
// "staf van dit team" als "contactpersonen van dit team" aan -- dat geldt voor beide rollen
// (een contactpersoon mag ook naar andere contactpersonen van hetzelfde team sturen).
export async function getMailboxSendTargets(clubId: string, user: { id: string; email?: string | null }): Promise<MailboxSendTargets> {
  const admin = createAdminClient();
  const access = await getClubAccess(clubId, user);
  const guardianTeamIds = await getGuardianClubTeamIds(clubId, user.id);

  let clubTeamIds: string[];
  if (access.exists && access.teamIds === null) {
    const { data } = await admin.from("club_teams").select("id").eq("club_id", clubId).eq("status", "active");
    clubTeamIds = (data ?? []).map((team) => team.id);
  } else {
    const staffTeamIds = access.exists ? Array.from(access.teamIds ?? []) : [];
    clubTeamIds = Array.from(new Set([...staffTeamIds, ...guardianTeamIds]));
  }
  if (!clubTeamIds.length) return { teamGroups: [] };

  const { data: teams } = await admin.from("club_teams").select("id, name").in("id", clubTeamIds).order("name");
  const teamGroups: MailboxTeamGroup[] = [];
  for (const team of teams ?? []) {
    const [staffResult, contactResult] = await Promise.all([
      admin.rpc("club_team_staff_profile_ids", { target_club_id: clubId, target_club_team_id: team.id }),
      admin.rpc("club_team_contact_profile_ids", { target_club_id: clubId, target_club_team_id: team.id })
    ]);
    const [staff, contacts] = await Promise.all([
      toPeople(admin, unwrapIds(staffResult.data)),
      toPeople(admin, unwrapIds(contactResult.data))
    ]);
    teamGroups.push({ clubTeamId: team.id, teamName: team.name, staff, contacts });
  }
  return { teamGroups };
}

export async function resolveMailboxRecipientIds(clubId: string, targets: MailboxTarget[]): Promise<Set<string>> {
  const admin = createAdminClient();
  const ids = new Set<string>();
  for (const target of targets) {
    if (target.type === "user") {
      ids.add(target.profileId);
    } else if (target.type === "team_staff") {
      const { data } = await admin.rpc("club_team_staff_profile_ids", { target_club_id: clubId, target_club_team_id: target.clubTeamId });
      for (const id of unwrapIds(data)) ids.add(id);
    } else if (target.type === "team_contacts") {
      const { data } = await admin.rpc("club_team_contact_profile_ids", { target_club_id: clubId, target_club_team_id: target.clubTeamId });
      for (const id of unwrapIds(data)) ids.add(id);
    }
  }
  return ids;
}

// Nooit de door de client meegestuurde targets blindelings vertrouwen: elke target moet
// voorkomen in de eigen sendable-targets van de afzender (anders kan bv. een contactpersoon
// van GU9 een target voor een ander team meesturen).
export function validateTargets(targets: MailboxTarget[], sendTargets: MailboxSendTargets): boolean {
  const teamById = new Map(sendTargets.teamGroups.map((group) => [group.clubTeamId, group]));
  const allPersonIds = new Set(sendTargets.teamGroups.flatMap((group) => [...group.staff, ...group.contacts].map((p) => p.profileId)));
  return targets.every((target) => {
    if (target.type === "user") return allPersonIds.has(target.profileId);
    return teamById.has(target.clubTeamId);
  });
}
