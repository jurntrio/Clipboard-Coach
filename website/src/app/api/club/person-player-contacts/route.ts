import { NextResponse } from "next/server";
import { getClubAccess } from "@/lib/auth/club-access";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";

async function authorize(clubId: string) {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { response: NextResponse.json({ error: "Niet aangemeld." }, { status: 401 }) };
  const access = await getClubAccess(clubId, user);
  if (!["club_admin", "platform_admin"].includes(access.role)) {
    return { response: NextResponse.json({ error: "Alleen een clubadmin of algemene admin kan contactpersonen koppelen." }, { status: 403 }) };
  }
  return { user };
}

async function resolveTargets(clubId: string, clubPersonId: string, clubPlayerId: string) {
  const admin = createAdminClient();
  const [{ data: clubPerson }, { data: clubPlayer }] = await Promise.all([
    admin.from("club_people").select("person_id").eq("id", clubPersonId).eq("club_id", clubId).maybeSingle(),
    admin.from("club_players").select("id").eq("id", clubPlayerId).eq("club_id", clubId).maybeSingle()
  ]);
  if (!clubPerson || !clubPlayer) return { error: "Persoon of speler behoort niet tot deze club." };
  const { data: account } = await admin.from("person_accounts").select("profile_id")
    .eq("person_id", clubPerson.person_id).eq("status", "active").is("revoked_at", null).maybeSingle();
  if (!account) return { error: "Deze persoon heeft geen actief account dat als contactpersoon kan worden gekoppeld." };
  return { admin, profileId: account.profile_id };
}

export async function POST(request: Request) {
  const body = await request.json().catch(() => null) as { clubId?: string; clubPersonId?: string; clubPlayerId?: string } | null;
  if (!body?.clubId || !body.clubPersonId || !body.clubPlayerId) return NextResponse.json({ error: "Onvolledige koppeling." }, { status: 400 });
  const authorization = await authorize(body.clubId);
  if (authorization.response) return authorization.response;
  const resolved = await resolveTargets(body.clubId, body.clubPersonId, body.clubPlayerId);
  if ("error" in resolved) return NextResponse.json({ error: resolved.error }, { status: 400 });

  const now = new Date().toISOString();
  const { data: existing } = await resolved.admin.from("player_guardians").select("id")
    .eq("club_player_id", body.clubPlayerId).eq("profile_id", resolved.profileId).maybeSingle();
  const result = existing
    ? await resolved.admin.from("player_guardians").update({ revoked_at: null, valid_until: null, valid_from: now }).eq("id", existing.id)
    : await resolved.admin.from("player_guardians").insert({ club_player_id: body.clubPlayerId, player_id: null, profile_id: resolved.profileId, access_scope: "from_acceptance", valid_from: now });
  if (result.error) return NextResponse.json({ error: result.error.message }, { status: 400 });
  return NextResponse.json({ ok: true });
}

export async function DELETE(request: Request) {
  const body = await request.json().catch(() => null) as { clubId?: string; clubPersonId?: string; clubPlayerId?: string } | null;
  if (!body?.clubId || !body.clubPersonId || !body.clubPlayerId) return NextResponse.json({ error: "Onvolledige koppeling." }, { status: 400 });
  const authorization = await authorize(body.clubId);
  if (authorization.response) return authorization.response;
  const resolved = await resolveTargets(body.clubId, body.clubPersonId, body.clubPlayerId);
  if ("error" in resolved) return NextResponse.json({ error: resolved.error }, { status: 400 });

  const { error } = await resolved.admin.from("player_guardians").update({ revoked_at: new Date().toISOString() })
    .eq("club_player_id", body.clubPlayerId).eq("profile_id", resolved.profileId).is("revoked_at", null);
  if (error) return NextResponse.json({ error: error.message }, { status: 400 });
  return NextResponse.json({ ok: true });
}
