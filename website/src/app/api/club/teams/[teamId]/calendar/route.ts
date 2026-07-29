import { NextResponse } from "next/server";
import { isAdminEmail } from "@/lib/auth/admin";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";
import { syncFoot24Feed, validateFoot24Url } from "@/lib/foot24-calendar";
import { parseVoetbalVlaanderenUrl, syncVoetbalVlaanderenFeed } from "@/lib/voetbal-vlaanderen-calendar";

async function authorize(teamId: string) {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { response: NextResponse.json({ error: "Niet aangemeld." }, { status: 401 }) };
  const admin = createAdminClient();
  const { data: team } = await admin.from("club_teams").select("id, club_id").eq("id", teamId).maybeSingle();
  if (!team) return { response: NextResponse.json({ error: "Ploeg niet gevonden." }, { status: 404 }) };
  if (!isAdminEmail(user.email)) {
    const { data: membership } = await admin.from("club_memberships").select("id").eq("club_id", team.club_id)
      .eq("profile_id", user.id).eq("role", "club_admin").eq("status", "active").maybeSingle();
    if (!membership) return { response: NextResponse.json({ error: "Geen toegang tot deze club." }, { status: 403 }) };
  }
  return { admin, team };
}

export async function GET(_request: Request, { params }: { params: { teamId: string } }) {
  const ctx = await authorize(params.teamId);
  if ("response" in ctx) return ctx.response;
  const { data } = await ctx.admin.from("club_team_calendar_feeds")
    .select("enabled, last_synced_at, last_sync_status, last_sync_message").eq("club_team_id", params.teamId).maybeSingle();
  return NextResponse.json({ configured: !!data, ...data });
}

export async function PUT(request: Request, { params }: { params: { teamId: string } }) {
  const ctx = await authorize(params.teamId);
  if ("response" in ctx) return ctx.response;
  const body = await request.json().catch(() => null) as { url?: unknown; enabled?: unknown } | null;
  const rawUrl = typeof body?.url === "string" ? body.url.trim() : "";
  const { data: existing } = await ctx.admin.from("club_team_calendar_feeds")
    .select("feed_url").eq("club_team_id", params.teamId).maybeSingle();
  if (!rawUrl && !existing) return NextResponse.json({ error: "Vul eerst een kalenderlink in." }, { status: 400 });
  let feedUrl = existing?.feed_url ?? "";
  try {
    if (rawUrl) feedUrl = rawUrl.includes("voetbalvlaanderen.be")
      ? parseVoetbalVlaanderenUrl(rawUrl).url
      : validateFoot24Url(rawUrl);
  }
  catch (error) { return NextResponse.json({ error: error instanceof Error ? error.message : "Ongeldige link." }, { status: 400 }); }
  const feedChanged = !!existing && existing.feed_url !== feedUrl;
  const { error } = await ctx.admin.from("club_team_calendar_feeds").upsert({
    club_team_id: params.teamId, provider: "foot24", feed_url: feedUrl,
    enabled: body?.enabled === true,
    ...(feedChanged ? {
      last_synced_at: null,
      last_sync_status: null,
      last_sync_message: null,
      last_etag: null,
      last_modified: null
    } : {}),
    updated_at: new Date().toISOString()
  }, { onConflict: "club_team_id" });
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}

export async function POST(_request: Request, { params }: { params: { teamId: string } }) {
  const ctx = await authorize(params.teamId);
  if ("response" in ctx) return ctx.response;
  try {
    const { data: feed } = await ctx.admin.from("club_team_calendar_feeds")
      .select("feed_url").eq("club_team_id", params.teamId).maybeSingle();
    if (!feed) throw new Error("Geen kalenderlink voor deze ploeg ingesteld.");
    return NextResponse.json(feed.feed_url.includes("voetbalvlaanderen.be")
      ? await syncVoetbalVlaanderenFeed(params.teamId)
      : await syncFoot24Feed(params.teamId));
  } catch (error) {
    const message = error instanceof Error ? error.message : "Synchronisatie mislukt.";
    await ctx.admin.from("club_team_calendar_feeds").update({
      last_synced_at: new Date().toISOString(), last_sync_status: "error", last_sync_message: message
    }).eq("club_team_id", params.teamId);
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
