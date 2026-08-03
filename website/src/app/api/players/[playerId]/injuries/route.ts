import { NextResponse } from "next/server";
import { canAccessTeam, getClubAccess, hasClubPermission } from "@/lib/auth/club-access";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";

async function context(playerId: string) {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { response: NextResponse.json({ error: "Niet aangemeld." }, { status: 401 }) };
  const admin = createAdminClient();
  const { data: player } = await admin.from("players").select("id, first_name, last_name, teams!inner(club_team_id, club_teams!inner(id, club_id))").eq("id", playerId).maybeSingle();
  const team = player?.teams as unknown as { club_team_id: string; club_teams: { id: string; club_id: string } } | null;
  if (!player || !team?.club_teams) return { response: NextResponse.json({ error: "Speler niet gevonden." }, { status: 404 }) };
  const access = await getClubAccess(team.club_teams.club_id, user);
  if (!canAccessTeam(access, team.club_team_id) || !hasClubPermission(access, "injuries.view")) {
    return { response: NextResponse.json({ error: "Geen toegang tot de blessuregegevens van deze speler." }, { status: 403 }) };
  }
  const injuryManagers = ["doctor", "physiotherapist", "youth_coordinator", "head_youth_development", "technical_director"];
  return {
    user, admin, player, clubId: team.club_teams.club_id, clubTeamId: team.club_team_id,
    canManage: hasClubPermission(access, "injuries.manage")
      && (access.role === "club_admin" || access.role === "platform_admin" || injuryManagers.includes(access.functionRole))
  };
}

export async function GET(_: Request, { params }: { params: { playerId: string } }) {
  const ctx = await context(params.playerId);
  if (ctx.response) return ctx.response;
  const [{ data: injuries, error }, { data: history }] = await Promise.all([
    ctx.admin!.from("player_injuries").select("*").eq("club_id", ctx.clubId!).eq("player_id", params.playerId).order("created_at", { ascending: false }),
    ctx.admin!.from("player_injury_history").select("*, profiles!player_injury_history_changed_by_fkey(full_name)").eq("club_id", ctx.clubId!).eq("player_id", params.playerId).order("changed_at", { ascending: false })
  ]);
  if (error) return NextResponse.json({ error: "Blessuregegevens konden niet geladen worden." }, { status: 500 });
  return NextResponse.json({ injuries: injuries ?? [], history: history ?? [], canManage: ctx.canManage });
}

export async function POST(request: Request, { params }: { params: { playerId: string } }) {
  const ctx = await context(params.playerId);
  if (ctx.response) return ctx.response;
  if (!ctx.canManage) return NextResponse.json({ error: "Alleen medische staf, een coÃ¶rdinator of Club Admin kan een blessure registreren." }, { status: 403 });
  const body = await request.json().catch(() => null);
  const startDate = typeof body?.startDate === "string" ? body.startDate : "";
  const expectedEndDate = typeof body?.expectedEndDate === "string" && body.expectedEndDate ? body.expectedEndDate : null;
  const message = typeof body?.message === "string" ? body.message.trim() : "";
  if (!/^\d{4}-\d{2}-\d{2}$/.test(startDate) || !message || message.length > 2000 || (expectedEndDate && expectedEndDate < startDate)) return NextResponse.json({ error: "Controleer startdatum, einddatum en bericht." }, { status: 400 });
  const { data: active } = await ctx.admin!.from("player_injuries").select("id").eq("club_id", ctx.clubId!).eq("player_id", params.playerId).eq("status", "injured").maybeSingle();
  if (active) return NextResponse.json({ error: "Deze speler heeft al een actieve blessure." }, { status: 409 });
  const { data: injury, error } = await ctx.admin!.from("player_injuries").insert({ club_id: ctx.clubId, player_id: params.playerId, start_date: startDate, expected_end_date: expectedEndDate, created_by: ctx.user!.id }).select("id").single();
  if (error || !injury) return NextResponse.json({ error: error?.message ?? "Blessure kon niet worden bewaard." }, { status: 400 });
  const { error: historyError } = await ctx.admin!.from("player_injury_history").insert({ injury_id: injury.id, club_id: ctx.clubId, player_id: params.playerId, old_status: "available", new_status: "injured", start_date: startDate, expected_end_date: expectedEndDate, message, changed_by: ctx.user!.id });
  if (historyError) { await ctx.admin!.from("player_injuries").delete().eq("id", injury.id); return NextResponse.json({ error: "Historiek kon niet worden bewaard." }, { status: 500 }); }
  await notify(ctx, `Blessure-update â€” ${ctx.player!.first_name} ${ctx.player!.last_name}`, `${ctx.player!.first_name} ${ctx.player!.last_name} staat vanaf ${formatDate(startDate)} als geblesseerd geregistreerd.\n\nBericht staf:\n${message}`);
  return NextResponse.json({ id: injury.id }, { status: 201 });
}

export async function PATCH(request: Request, { params }: { params: { playerId: string } }) {
  const ctx = await context(params.playerId);
  if (ctx.response) return ctx.response;
  if (!ctx.canManage) return NextResponse.json({ error: "Alleen medische staf, een coÃ¶rdinator of Club Admin kan deze status aanpassen." }, { status: 403 });
  const body = await request.json().catch(() => null);
  const message = typeof body?.message === "string" ? body.message.trim() : "";
  if (!message || message.length > 2000) return NextResponse.json({ error: "Een bericht is verplicht (maximaal 2000 tekens)." }, { status: 400 });
  const { data: injury } = await ctx.admin!.from("player_injuries").select("*").eq("id", body?.injuryId).eq("club_id", ctx.clubId!).eq("player_id", params.playerId).eq("status", "injured").maybeSingle();
  if (!injury) return NextResponse.json({ error: "Actieve blessure niet gevonden." }, { status: 404 });
  const fit = body?.action === "fit";
  const expectedEndDate = typeof body?.expectedEndDate === "string" && body.expectedEndDate ? body.expectedEndDate : null;
  if (!fit && expectedEndDate && expectedEndDate < injury.start_date) return NextResponse.json({ error: "De einddatum ligt voor de startdatum." }, { status: 400 });
  const update = fit ? { status: "available", ended_at: new Date().toISOString() } : { expected_end_date: expectedEndDate, updated_at: new Date().toISOString() };
  const { error } = await ctx.admin!.from("player_injuries").update(update).eq("id", injury.id).eq("status", "injured");
  if (error) return NextResponse.json({ error: error.message }, { status: 400 });
  const { error: historyError } = await ctx.admin!.from("player_injury_history").insert({ injury_id: injury.id, club_id: ctx.clubId, player_id: params.playerId, old_status: "injured", new_status: fit ? "available" : "injured", start_date: injury.start_date, expected_end_date: fit ? injury.expected_end_date : expectedEndDate, message, changed_by: ctx.user!.id });
  if (historyError) {
    await ctx.admin!.from("player_injuries").update({ status: "injured", ended_at: null, expected_end_date: injury.expected_end_date, updated_at: injury.updated_at }).eq("id", injury.id);
    return NextResponse.json({ error: "Historiek kon niet worden bewaard; de statuswijziging is teruggedraaid." }, { status: 500 });
  }
  const name = `${ctx.player!.first_name} ${ctx.player!.last_name}`;
  await notify(ctx, fit ? `${name} opnieuw beschikbaar` : `Blessure-update â€” ${name}`, `Bericht staf:\n${message}`);
  return NextResponse.json({ ok: true });
}

async function notify(ctx: Awaited<ReturnType<typeof context>>, subject: string, body: string) {
  const admin = ctx.admin!;
  const [{ data: assigned }, { data: coordinators }] = await Promise.all([
    admin.from("club_trainer_teams").select("club_trainers!inner(profile_id)").eq("club_team_id", ctx.clubTeamId!).eq("status", "active"),
    admin.from("club_memberships").select("profile_id").eq("club_id", ctx.clubId!).eq("status", "active").in("function_role", ["youth_coordinator", "head_youth_development", "technical_director"])
  ]);
  const recipientIds = new Set<string>([...(assigned ?? []).map(row => (row.club_trainers as unknown as { profile_id: string | null })?.profile_id), ...(coordinators ?? []).map(row => row.profile_id)].filter((id): id is string => !!id && id !== ctx.user!.id));
  if (!recipientIds.size) return;
  const threadId = crypto.randomUUID();
  const { data: message } = await admin.from("mailbox_messages").insert({ club_id: ctx.clubId, sender_id: ctx.user!.id, thread_id: threadId, subject, body }).select("id").single();
  if (message) await admin.from("mailbox_recipients").insert([{ message_id: message.id, profile_id: ctx.user!.id, read_at: new Date().toISOString() }, ...[...recipientIds].map(profile_id => ({ message_id: message.id, profile_id }))]);
}

function formatDate(value: string) { return new Intl.DateTimeFormat("nl-BE").format(new Date(`${value}T12:00:00`)); }


