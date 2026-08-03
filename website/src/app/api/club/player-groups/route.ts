import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { getClubContext } from "@/lib/auth/active-club";
import { getClubAccess } from "@/lib/auth/club-access";

const GROUP_TYPES = new Set(["goalkeeper_training", "technique_training", "talent_development", "position_training", "physical_training", "rehabilitation", "selection_group", "other"]);
const clean = (value: unknown, max = 500) => typeof value === "string" ? value.trim().replace(/\s+/g, " ").slice(0, max) : "";
const ids = (value: unknown) => Array.isArray(value) ? [...new Set(value.filter((id): id is string => typeof id === "string" && /^[0-9a-f-]{36}$/i.test(id)))] : [];

async function authorized() {
  const context = await getClubContext();
  if (!context.user || !context.activeClubId) return { response: NextResponse.json({ error: "Niet aangemeld." }, { status: 401 }) };
  const admin = createAdminClient();
  const access = await getClubAccess(context.activeClubId, context.user);
  const canManage = context.isPlatformAdmin || access.role === "platform_admin" || access.role === "club_admin";
  if (!canManage || access.readOnly) return { response: NextResponse.json({ error: "Alleen een clubadmin kan Extra groepen beheren." }, { status: 403 }) };
  return { context, admin };
}

export async function GET() {
  const auth = await authorized();
  if ("response" in auth) return auth.response;
  const { data, error } = await auth.admin.from("player_groups")
    .select("*, player_group_players(player_id), player_group_staff(trainer_id, role_label), player_group_evaluation_criteria(id, name, description, sort_order, active)")
    .eq("club_id", auth.context.activeClubId).order("active", { ascending: false }).order("name");
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ groups: data ?? [] });
}

export async function POST(request: Request) {
  const auth = await authorized();
  if ("response" in auth) return auth.response;
  const body = await request.json().catch(() => null) as Record<string, unknown> | null;
  return save(auth.admin, auth.context.activeClubId!, auth.context.user!.id, body, null);
}

export async function PATCH(request: Request) {
  const auth = await authorized();
  if ("response" in auth) return auth.response;
  const body = await request.json().catch(() => null) as Record<string, unknown> | null;
  const groupId = clean(body?.groupId, 36);
  if (!groupId) return NextResponse.json({ error: "Extra groep ontbreekt." }, { status: 400 });
  return save(auth.admin, auth.context.activeClubId!, auth.context.user!.id, body, groupId);
}

async function save(admin: ReturnType<typeof createAdminClient>, clubId: string, userId: string, body: Record<string, unknown> | null, groupId: string | null) {
  const name = clean(body?.name, 120);
  const groupType = clean(body?.groupType, 40);
  const playerIds = ids(body?.playerIds);
  const trainerIds = ids(body?.trainerIds);
  const criteria = Array.isArray(body?.criteria) ? body.criteria.map((item, index) => ({
    name: clean((item as Record<string, unknown>)?.name, 100),
    description: clean((item as Record<string, unknown>)?.description, 300) || null,
    sort_order: index
  })).filter(item => item.name) : [];
  if (!name || !GROUP_TYPES.has(groupType)) return NextResponse.json({ error: "Naam en een geldig type zijn verplicht." }, { status: 400 });

  const [{ data: validPlayers }, { data: validTrainers }] = await Promise.all([
    playerIds.length ? admin.from("players").select("id, teams!inner(club_teams!inner(club_id))").in("id", playerIds).eq("teams.club_teams.club_id", clubId) : Promise.resolve({ data: [] }),
    trainerIds.length ? admin.from("club_trainers").select("id").in("id", trainerIds).eq("club_id", clubId) : Promise.resolve({ data: [] })
  ]);
  if ((validPlayers ?? []).length !== playerIds.length || (validTrainers ?? []).length !== trainerIds.length) {
    return NextResponse.json({ error: "Een gekozen speler of trainer behoort niet tot deze club." }, { status: 400 });
  }

  const values = {
    club_id: clubId, name, group_type: groupType,
    description: clean(body?.description) || null,
    age_category: clean(body?.ageCategory, 60) || null,
    icon: clean(body?.icon, 30) || null,
    active: body?.active !== false
  };
  let id = groupId;
  if (id) {
    const { data, error } = await admin.from("player_groups").update(values).eq("id", id).eq("club_id", clubId).select("id").maybeSingle();
    if (error || !data) return NextResponse.json({ error: error?.message || "Extra groep niet gevonden." }, { status: error ? 400 : 404 });
  } else {
    const { data, error } = await admin.from("player_groups").insert({ ...values, created_by: userId }).select("id").single();
    if (error) return NextResponse.json({ error: error.code === "23505" ? "Deze groepsnaam bestaat al." : error.message }, { status: 400 });
    id = data.id;
  }

  await Promise.all([
    admin.from("player_group_players").delete().eq("group_id", id),
    admin.from("player_group_staff").delete().eq("group_id", id)
  ]);
  const writes = [];
  if (playerIds.length) writes.push(admin.from("player_group_players").insert(playerIds.map(playerId => ({ group_id: id, player_id: playerId, added_by: userId }))));
  if (trainerIds.length) writes.push(admin.from("player_group_staff").insert(trainerIds.map(trainerId => ({ group_id: id, trainer_id: trainerId, added_by: userId }))));
  const results = await Promise.all(writes);
  const writeError = results.find(result => result.error)?.error;
  if (writeError) return NextResponse.json({ error: writeError.message }, { status: 400 });
  if (criteria.length) {
    const { data: activeCriteria, error: criteriaError } = await admin.from("player_group_evaluation_criteria").upsert(criteria.map(item => ({ ...item, group_id: id, active: true })), { onConflict: "group_id,name" }).select("id");
    if (criteriaError) return NextResponse.json({ error: criteriaError.message }, { status: 400 });
    const activeIds = (activeCriteria ?? []).map(item => item.id);
    if (activeIds.length) await admin.from("player_group_evaluation_criteria").update({ active: false }).eq("group_id", id).not("id", "in", `(${activeIds.join(",")})`);
  } else {
    await admin.from("player_group_evaluation_criteria").update({ active: false }).eq("group_id", id);
  }
  return NextResponse.json({ groupId: id }, { status: groupId ? 200 : 201 });
}
