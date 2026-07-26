import { NextResponse } from "next/server";
import { isAdminEmail } from "@/lib/auth/admin";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";

type PlayerInput = {
  firstName?: unknown;
  lastName?: unknown;
  dateOfBirth?: unknown;
  email?: unknown;
  phoneNumbers?: unknown;
};

function text(value: unknown, max = 160) {
  return typeof value === "string" ? value.trim().slice(0, max) : "";
}

export async function PUT(request: Request, { params }: { params: { teamId: string } }) {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Niet aangemeld." }, { status: 401 });

  const admin = createAdminClient();
  const { data: clubTeam } = await admin.from("club_teams").select("id, club_id, trainers_can_edit_roster").eq("id", params.teamId).maybeSingle();
  if (!clubTeam) return NextResponse.json({ error: "Team niet gevonden." }, { status: 404 });
  const { data: membership } = await admin.from("club_memberships").select("id").eq("club_id", clubTeam.club_id)
    .eq("profile_id", user.id).eq("role", "club_admin").eq("status", "active").maybeSingle();
  let authorized = !!membership || isAdminEmail(user.email);
  // Spiegelt can_manage_club_roster (0023): een trainer met rosterrechten en een actieve
  // toewijzing op dit team mag ook via de bulk-import opslaan, net zoals via de losse
  // AddPlayerModal/EditPlayerModal-RLS-policies vandaag al kan.
  if (!authorized && clubTeam.trainers_can_edit_roster) {
    const { data: trainerLink } = await admin
      .from("club_trainer_teams")
      .select("id, club_trainers!inner(profile_id)")
      .eq("club_team_id", clubTeam.id)
      .eq("status", "active")
      .eq("club_trainers.profile_id", user.id)
      .maybeSingle();
    authorized = !!trainerLink;
  }
  if (!authorized) return NextResponse.json({ error: "Geen toegang tot dit team." }, { status: 403 });

  const body = await request.json().catch(() => null) as { players?: PlayerInput[]; removePlayerIds?: unknown } | null;
  if (!Array.isArray(body?.players) || body.players.length > 500) {
    return NextResponse.json({ error: "Ongeldige spelerslijst." }, { status: 400 });
  }
  const removePlayerIds = Array.isArray(body?.removePlayerIds)
    ? body.removePlayerIds.filter((id): id is string => typeof id === "string").slice(0, 500)
    : [];
  const { data: operationalTeam } = await admin.from("teams").select("id").eq("club_team_id", clubTeam.id).maybeSingle();
  if (!operationalTeam) return NextResponse.json({ error: "De operationele spelerslijst ontbreekt." }, { status: 409 });

  const players = body.players.map((player) => ({
    team_id: operationalTeam.id,
    first_name: text(player.firstName, 80),
    last_name: text(player.lastName, 80),
    date_of_birth: text(player.dateOfBirth, 10) || null,
    email: text(player.email, 160) || null,
    phone_numbers: Array.isArray(player.phoneNumbers)
      ? player.phoneNumbers.map((phone) => text(phone, 40)).filter(Boolean)
      : text(player.phoneNumbers).split(",").map((phone) => phone.trim()).filter(Boolean),
    role: "player"
  })).filter((player) => player.first_name && player.last_name);

  // Toevoegen/bijwerken-modus: bestaande spelers van dit team worden nooit verwijderd.
  // Zie import_roster_rows_merge (0032) voor de match-or-create + membership-upsert-logica.
  const { data: result, error: importError } = await admin.rpc("import_roster_rows_merge", {
    target_team_id: operationalTeam.id,
    p_players: players.map((player) => ({
      first_name: player.first_name,
      last_name: player.last_name,
      date_of_birth: player.date_of_birth,
      email: player.email,
      phone: player.phone_numbers[0] ?? null
    }))
  });
  if (importError) return NextResponse.json({ error: importError.message }, { status: 500 });

  let removed = 0;
  if (removePlayerIds.length) {
    // Enkel bereikt vanuit de synchroniseren/volledig-vervangen-modi in de UI, na expliciete
    // clubadminbevestiging welke ontbrekende spelers het team mogen verlaten. Toevoegen/bijwerken
    // stuurt hier nooit iets naartoe. Zie remove_roster_players (0033): sluit de membership af
    // (canonieke geschiedenis) en verwijdert de operationele players-rij.
    const { data: removeResult, error: removeError } = await admin.rpc("remove_roster_players", {
      target_team_id: operationalTeam.id,
      p_player_ids: removePlayerIds
    });
    if (removeError) return NextResponse.json({ error: removeError.message }, { status: 500 });
    removed = removeResult?.removed ?? 0;
  }

  return NextResponse.json({ saved: result.saved, failed: result.failed, removed });
}
