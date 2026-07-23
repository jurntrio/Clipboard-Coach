import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

export async function GET() {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const [profile, legalAcceptances, teams, videos, matches, standardTags, clips] = await Promise.all([
    supabase.from("profiles").select("*").eq("id", user.id).maybeSingle(),
    supabase.from("legal_acceptances").select("terms_version, privacy_version, statement_version, locale, accepted_at, created_at").eq("user_id", user.id).order("accepted_at"),
    supabase.from("teams").select("*, players(*)").eq("coach_id", user.id).order("created_at"),
    supabase.from("videos").select("*, tags(*)").eq("coach_id", user.id).order("created_at"),
    supabase.from("matches").select("*, match_videos(*)").eq("coach_id", user.id).order("created_at"),
    supabase.from("standard_tags").select("*").eq("coach_id", user.id).order("created_at"),
    supabase.from("clips").select("*, clip_segments(*), share_links(id, view_count, expires_at, created_at)").eq("coach_id", user.id).order("created_at")
  ]);

  const failed = [profile, legalAcceptances, teams, videos, matches, standardTags, clips].find((result) => result.error);
  if (failed?.error) return NextResponse.json({ error: failed.error.message }, { status: 500 });

  const body = JSON.stringify({
    exported_at: new Date().toISOString(),
    account: { id: user.id, email: user.email, created_at: user.created_at },
    profile: profile.data,
    legal_acceptances: legalAcceptances.data ?? [],
    teams: teams.data ?? [], videos: videos.data ?? [], matches: matches.data ?? [],
    standard_tags: standardTags.data ?? [], clips: clips.data ?? []
  }, null, 2);

  return new NextResponse(body, { headers: { "Content-Type": "application/json; charset=utf-8", "Content-Disposition": `attachment; filename="clipboard-coach-export-${new Date().toISOString().slice(0, 10)}.json"`, "Cache-Control": "no-store" } });
}

