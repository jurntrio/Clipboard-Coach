import { NextResponse } from "next/server";
import { getClubAccess } from "@/lib/auth/club-access";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";

async function adminContext(clubId: string) {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { response: NextResponse.json({ error: "Niet aangemeld." }, { status: 401 }) };
  const access = await getClubAccess(clubId, user);
  if (!["club_admin", "platform_admin"].includes(access.role)) {
    return { response: NextResponse.json({ error: "Alleen een Club Admin kan rollen wijzigen." }, { status: 403 }) };
  }
  return { user, supabase };
}

export async function POST(request: Request) {
  const body = await request.json().catch(() => null);
  if (!body || typeof body.clubId !== "string" || typeof body.clubPersonId !== "string"
    || typeof body.roleType !== "string") {
    return NextResponse.json({ error: "Persoon en rol zijn verplicht." }, { status: 400 });
  }
  const auth = await adminContext(body.clubId);
  if (auth.response) return auth.response;
  const admin = createAdminClient();
  const { data: clubPerson } = await admin.from("club_people").select("id")
    .eq("id", body.clubPersonId).eq("club_id", body.clubId).eq("status", "active").maybeSingle();
  if (!clubPerson) return NextResponse.json({ error: "Persoon niet gevonden in deze club." }, { status: 404 });
  const clubTeamId = typeof body.clubTeamId === "string" && body.clubTeamId ? body.clubTeamId : null;
  if (clubTeamId) {
    const { data: clubTeam } = await admin.from("club_teams").select("id")
      .eq("id", clubTeamId).eq("club_id", body.clubId).neq("status", "merged").maybeSingle();
    if (!clubTeam) return NextResponse.json({ error: "Ploeg niet gevonden in deze club." }, { status: 404 });
  }
  const { data, error } = await auth.supabase!.rpc("assign_club_role", {
    target_club_person_id: body.clubPersonId,
    role_type_value: body.roleType,
    target_club_team_id: clubTeamId,
    valid_from_value: typeof body.validFrom === "string" && body.validFrom ? body.validFrom : new Date().toISOString().slice(0, 10),
    valid_until_value: typeof body.validUntil === "string" && body.validUntil ? body.validUntil : null
  });
  if (error) return NextResponse.json({ error: error.message }, { status: 400 });
  return NextResponse.json({ roleAssignmentId: data }, { status: 201 });
}

export async function DELETE(request: Request) {
  const body = await request.json().catch(() => null);
  if (!body || typeof body.clubId !== "string" || typeof body.roleAssignmentId !== "string") {
    return NextResponse.json({ error: "Rol ontbreekt." }, { status: 400 });
  }
  const auth = await adminContext(body.clubId);
  if (auth.response) return auth.response;
  const admin = createAdminClient();
  const { data: role } = await admin.from("club_role_assignments")
    .select("id, club_people!inner(club_id)")
    .eq("id", body.roleAssignmentId)
    .eq("club_people.club_id", body.clubId)
    .maybeSingle();
  if (!role) return NextResponse.json({ error: "Rol niet gevonden." }, { status: 404 });
  const { error } = await auth.supabase!.rpc("end_club_role", {
    target_role_assignment_id: body.roleAssignmentId,
    end_date_value: new Date().toISOString().slice(0, 10),
    reason_value: "club_admin_ended"
  });
  if (error) return NextResponse.json({ error: error.message }, { status: 400 });
  return new NextResponse(null, { status: 204 });
}
