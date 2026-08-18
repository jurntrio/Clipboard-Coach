import { NextResponse } from "next/server";
import { getClubContext } from "@/lib/auth/active-club";
import { syncFoot24Feed, validateFoot24Url } from "@/lib/foot24-calendar";
import { createAdminClient } from "@/lib/supabase/admin";

async function personalTrainerContext() {
  const context = await getClubContext();
  if (!context.user || !context.activeClubId) return null;
  const admin = createAdminClient();
  const { data: club } = await admin.from("clubs").select("id, is_personal, created_by")
    .eq("id", context.activeClubId).maybeSingle();
  if (!club?.is_personal || club.created_by !== context.user.id) return null;
  const { data: team } = await admin.from("club_teams").select("id, name")
    .eq("club_id", club.id).eq("status", "active").order("created_at").limit(1).maybeSingle();
  return team ? { admin, userId: context.user.id, clubId: club.id, team } : null;
}

export async function POST(request: Request) {
  const trainer = await personalTrainerContext();
  if (!trainer) return NextResponse.json({ error: "Geen persoonlijke trainersomgeving gevonden." }, { status: 403 });
  const body = await request.json() as { action?: string; foot24Url?: string };

  if (body.action === "complete") {
    const { error } = await trainer.admin.from("profiles")
      .update({ trainer_onboarding_completed_at: new Date().toISOString() }).eq("id", trainer.userId);
    return error ? NextResponse.json({ error: error.message }, { status: 400 }) : NextResponse.json({ ok: true });
  }

  if (body.action === "foot24") {
    let feedUrl: string;
    try {
      feedUrl = validateFoot24Url(String(body.foot24Url ?? "").trim());
    } catch (reason) {
      return NextResponse.json({ error: reason instanceof Error ? reason.message : "Ongeldige Foot24-link." }, { status: 400 });
    }
    const { error } = await trainer.admin.from("club_team_calendar_feeds").upsert({
      club_team_id: trainer.team.id,
      provider: "foot24",
      feed_url: feedUrl,
      enabled: true,
      last_sync_status: "pending",
      last_sync_message: "Eerste synchronisatie gestart.",
      updated_at: new Date().toISOString()
    }, { onConflict: "club_team_id" });
    if (error) return NextResponse.json({ error: error.message }, { status: 400 });
    try {
      const result = await syncFoot24Feed(trainer.team.id);
      return NextResponse.json({ ok: true, teamName: trainer.team.name, ...result });
    } catch (reason) {
      const message = reason instanceof Error ? reason.message : "De Foot24-kalender kon niet worden ingelezen.";
      await trainer.admin.from("club_team_calendar_feeds").update({
        last_sync_status: "error", last_sync_message: message, updated_at: new Date().toISOString()
      }).eq("club_team_id", trainer.team.id);
      return NextResponse.json({ error: message }, { status: 400 });
    }
  }

  return NextResponse.json({ error: "Onbekende actie." }, { status: 400 });
}
