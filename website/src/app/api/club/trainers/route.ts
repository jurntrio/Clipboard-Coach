import { NextResponse } from "next/server";
import { isAdminEmail } from "@/lib/auth/admin";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";

export async function DELETE(request: Request) {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Niet aangemeld." }, { status: 401 });
  const body = await request.json().catch(() => null) as { clubId?: string; trainerId?: string } | null;
  if (!body?.clubId || !body.trainerId) {
    return NextResponse.json({ error: "Club en persoon zijn verplicht." }, { status: 400 });
  }

  const admin = createAdminClient();
  const [{ data: membership }, { data: trainer }] = await Promise.all([
    admin.from("club_memberships").select("role").eq("club_id", body.clubId)
      .eq("profile_id", user.id).maybeSingle(),
    admin.from("club_trainers").select("id, club_id, profile_id, display_name")
      .eq("id", body.trainerId).eq("club_id", body.clubId).maybeSingle()
  ]);
  if (!isAdminEmail(user.email) && membership?.role !== "club_admin") {
    return NextResponse.json({ error: "Geen toegang." }, { status: 403 });
  }
  if (!trainer) return NextResponse.json({ error: "Persoon niet gevonden." }, { status: 404 });
  if (trainer.profile_id === user.id) {
    return NextResponse.json({ error: "Je kunt jezelf niet via deze lijst uit de club verwijderen." }, { status: 400 });
  }

  if (trainer.profile_id) {
    const { data: clubTeams } = await admin.from("club_teams").select("id").eq("club_id", body.clubId);
    const clubTeamIds = (clubTeams ?? []).map(team => team.id);
    if (clubTeamIds.length) {
      const { data: operationalTeams } = await admin.from("teams").select("id").in("club_team_id", clubTeamIds);
      const operationalTeamIds = (operationalTeams ?? []).map(team => team.id);
      if (operationalTeamIds.length) {
        await admin.from("team_staff_members").delete()
          .eq("user_id", trainer.profile_id).in("team_id", operationalTeamIds);
      }
    }
    await Promise.all([
      admin.from("club_member_permissions").delete().eq("club_id", body.clubId).eq("profile_id", trainer.profile_id),
      admin.from("club_member_team_access").delete().eq("club_id", body.clubId).eq("profile_id", trainer.profile_id),
      admin.from("club_memberships").delete().eq("club_id", body.clubId).eq("profile_id", trainer.profile_id)
    ]);

    const { data: account } = await admin.from("person_accounts").select("person_id")
      .eq("profile_id", trainer.profile_id).eq("status", "active").maybeSingle();
    if (account?.person_id) {
      await admin.from("club_people").delete()
        .eq("club_id", body.clubId).eq("person_id", account.person_id);
    }
  }

  const { error } = await admin.from("club_trainers").delete().eq("id", trainer.id);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true, removedName: trainer.display_name });
}
