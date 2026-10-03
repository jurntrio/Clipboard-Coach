import { pageTitle } from "@/lib/page-metadata";
import Link from "next/link";
import { notFound } from "next/navigation";
import { getClubContext } from "@/lib/auth/active-club";
import { canAccessTeam, getClubAccess, hasClubPermission } from "@/lib/auth/club-access";
import { createAdminClient } from "@/lib/supabase/admin";
import { IntradeskClipViewer, type IntradeskClipSegment } from "@/components/intradesk/IntradeskClipViewer";

type MatchRow = { id: string; club_id: string; club_team_id: string | null; team_a_name: string; team_b_name: string; score_a: number | null; score_b: number | null };
type ClipRow = {
  id: string; name: string; team_id: string | null; render_status: string; rendered_segments: Array<{ id?: string; url?: string; name?: string; color?: string; duration?: number; play_start?: number }> | null;
  videos: { video_url: string } | null;
  clip_segments: Array<{ id: string; sequence_order: number; videos: { video_url: string } | null; tags: { name: string; color: string; start_time: number; end_time: number } | null }>;
};

export default async function IntradeskClipPage({ params }: { params: { clipId: string } }) {
  const context = await getClubContext();
  if (!context.user || !context.activeClubId) notFound();
  const admin = createAdminClient();
  const [{ data: clipData }, { data: linkData }] = await Promise.all([
    admin.from("clips").select("id,name,team_id,render_status,rendered_segments,videos(video_url),clip_segments(id,sequence_order,videos(video_url),tags(name,color,start_time,end_time))").eq("id", params.clipId).maybeSingle(),
    admin.from("clips").select("video_id").eq("id", params.clipId).maybeSingle().then(async result => result.data?.video_id
      ? admin.from("match_videos").select("matches(id,club_id,club_team_id,team_a_name,team_b_name,score_a,score_b)").eq("video_id", result.data.video_id)
      : { data: [] })
  ]);
  const clip = clipData as unknown as ClipRow | null;
  const matches = (linkData ?? []).flatMap(link => { const value = link.matches as unknown as MatchRow | MatchRow[] | null; return Array.isArray(value) ? value : value ? [value] : []; });
  const match = matches.find(item => item.club_id === context.activeClubId);
  if (!clip) notFound();

  const { data: operationalTeam } = !match && clip.team_id
    ? await admin.from("teams").select("club_team_id,club_teams(club_id,name)").eq("id", clip.team_id).maybeSingle()
    : { data: null };
  const clubTeam = operationalTeam?.club_teams as unknown as { club_id: string; name: string } | null;
  const clubTeamId = match?.club_team_id ?? operationalTeam?.club_team_id ?? null;
  if (!match && clubTeam?.club_id !== context.activeClubId) notFound();

  const access = await getClubAccess(context.activeClubId, context.user);
  if (!canAccessTeam(access, clubTeamId) || !hasClubPermission(access, "games.view") || !hasClubPermission(access, "video.view")) notFound();

  const rendered = clip.render_status === "ready" ? (clip.rendered_segments ?? []).filter(segment => !!segment.url).map((segment, index): IntradeskClipSegment => ({
    id: segment.id ?? `rendered-${index}`, name: segment.name || `Fragment ${index + 1}`, color: segment.color || "#22c55e", startTime: segment.play_start ?? 0, endTime: segment.duration ?? 0, url: segment.url
  })) : [];
  const sourceSegments = [...(clip.clip_segments ?? [])].sort((a, b) => a.sequence_order - b.sequence_order).flatMap((segment): IntradeskClipSegment[] => segment.tags ? [{
    id: segment.id, name: segment.tags.name, color: segment.tags.color, startTime: segment.tags.start_time, endTime: segment.tags.end_time, url: segment.videos?.video_url
  }] : []);
  const segments = rendered.length ? rendered : sourceSegments;
  const score = match && match.score_a !== null && match.score_b !== null ? ` · ${match.score_a}–${match.score_b}` : "";

  return <main className="mx-auto w-full max-w-5xl space-y-5 p-4 sm:p-8">
    <div className="flex flex-wrap items-center justify-between gap-3"><Link href="/dashboard/media-archive" className="text-sm font-bold text-accent hover:underline">← Terug naar Media-archief</Link>{match && <Link href={`/dashboard/games/${match.id}#wedstrijdverslag`} className="text-sm font-bold text-accent hover:underline">Open wedstrijdverslag →</Link>}</div>
    <header className="rounded-2xl border border-border bg-card p-5"><p className="text-xs font-black uppercase tracking-[.16em] text-accent">Clip</p><h1 className="mt-1 text-2xl font-black text-textBright">{clip.name}</h1>{match ? <Link href={`/dashboard/games/${match.id}#wedstrijdverslag`} className="mt-2 inline-block font-semibold text-textSecondary underline decoration-accent/50 underline-offset-4 hover:text-accent">{match.team_a_name} – {match.team_b_name}{score}</Link> : <p className="mt-2 font-semibold text-textSecondary">{clubTeam?.name ?? "Clubclip"}</p>}</header>
    <IntradeskClipViewer videoUrl={clip.videos?.video_url ?? ""} segments={segments} />
  </main>;
}

export const generateMetadata = pageTitle("page.clip");
