import { NextResponse } from "next/server";
import { getClubAccess } from "@/lib/auth/club-access";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";

async function authorize(clubId: string) {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { response: NextResponse.json({ error: "Niet aangemeld." }, { status: 401 }) };
  const access = await getClubAccess(clubId, user);
  if (!["club_admin", "club_admin_viewer", "platform_admin"].includes(access.role)) {
    return { response: NextResponse.json({ error: "Geen toegang." }, { status: 403 }) };
  }
  return { user, readOnly: access.role === "club_admin_viewer" };
}

export async function GET(request: Request) {
  const clubId = new URL(request.url).searchParams.get("clubId");
  if (!clubId) return NextResponse.json({ error: "Club ontbreekt." }, { status: 400 });
  const authorization = await authorize(clubId);
  if (authorization.response) return authorization.response;

  const admin = createAdminClient();
  const { data: clubPeople, error } = await admin
    .from("club_people")
    .select(`
      id, person_id, external_member_id, status, joined_at, left_at,
      people(
        id, first_name, last_name, date_of_birth, status,
        person_accounts(
          id, profile_id, status, link_method, verified_at, revoked_at,
          profiles!person_accounts_profile_id_fkey(email)
        )
      ),
      club_role_assignments(
        id, role_type, club_team_id, valid_from, valid_until, status,
        club_teams(name)
      ),
      person_account_invitations(id, intended_email, status, expires_at, created_at)
    `)
    .eq("club_id", clubId)
    .order("created_at");
  if (error) return NextResponse.json({ error: error.message }, { status: 400 });

  const profileIds = [...new Set((clubPeople ?? []).flatMap((clubPerson) => {
    const person = clubPerson.people as unknown as { person_accounts?: Array<{ profile_id: string; status: string; revoked_at: string | null }> } | null;
    return (person?.person_accounts ?? [])
      .filter((account) => account.status === "active" && !account.revoked_at)
      .map((account) => account.profile_id);
  }))];
  const [{ data: clubPlayers, error: playersError }, { data: contactLinks, error: contactsError }] = await Promise.all([
    admin.from("club_players").select("id, first_name, last_name").eq("club_id", clubId).order("last_name").order("first_name"),
    profileIds.length
      ? admin.from("player_guardians").select("id, club_player_id, profile_id, revoked_at").in("profile_id", profileIds).is("revoked_at", null)
      : Promise.resolve({ data: [], error: null })
  ]);
  if (playersError) return NextResponse.json({ error: playersError.message }, { status: 400 });
  if (contactsError) return NextResponse.json({ error: contactsError.message }, { status: 400 });

  const people = (clubPeople ?? []).map((clubPerson) => {
    const person = clubPerson.people as unknown as {
      id: string;
      first_name: string;
      last_name: string;
      date_of_birth: string | null;
      status: string;
      person_accounts: Array<{
        id: string;
        profile_id: string;
        status: string;
        link_method: string;
        verified_at: string | null;
        revoked_at: string | null;
        profiles: { email: string } | null;
      }>;
    };
    return {
      id: clubPerson.id,
      personId: clubPerson.person_id,
      externalMemberId: clubPerson.external_member_id,
      status: clubPerson.status,
      joinedAt: clubPerson.joined_at,
      leftAt: clubPerson.left_at,
      firstName: person.first_name,
      lastName: person.last_name,
      dateOfBirth: person.date_of_birth,
      personStatus: person.status,
      accounts: person.person_accounts ?? [],
      playerContacts: (contactLinks ?? []).filter((link) =>
        person.person_accounts.some((account) => account.profile_id === link.profile_id)
      ),
      roles: clubPerson.club_role_assignments ?? [],
      invitations: clubPerson.person_account_invitations ?? []
    };
  });
  return NextResponse.json({ people, players: clubPlayers ?? [], readOnly: authorization.readOnly });
}
