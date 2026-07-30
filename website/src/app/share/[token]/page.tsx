import { notFound } from "next/navigation";
import Image from "next/image";
import { createAdminClient } from "@/lib/supabase/admin";
import { ShareClipPlayer } from "@/components/clips/ShareClipPlayer";
import { getServerI18n } from "@/i18n/server";
import { LegalLinks } from "@/components/legal/LegalLinks";
import type { Metadata } from "next";

export async function generateMetadata({ params }: { params: { token: string } }): Promise<Metadata> {
  const supabase = createAdminClient();
  const { data } = await supabase.from("share_links").select(
    "clips(name, videos(match_videos(matches(team_a_name, team_b_name, match_date, score_a, score_b))))"
  ).eq("token", params.token).maybeSingle();
  const clip = data?.clips as any;
  const match = clip?.videos?.match_videos?.[0]?.matches;
  const title = match ? `${match.team_a_name} – ${match.team_b_name}${match.score_a !== null && match.score_b !== null ? ` | ${match.score_a}–${match.score_b}` : ""}` : clip?.name || "Gedeelde clip";
  const description = match?.match_date
    ? `Bekijk de wedstrijdclips van ${new Intl.DateTimeFormat("nl-BE").format(new Date(`${match.match_date}T12:00:00`))}.`
    : "Bekijk deze gedeelde wedstrijdclip.";
  return { title, description, robots: { index: false, follow: false }, openGraph: { title, description, type: "video.other" } };
}

export default async function SharePage({ params }: { params: { token: string } }) {
  const { t } = getServerI18n();
  const supabase = createAdminClient();

  const { data: shareLink } = await supabase
    .from("share_links")
    .select(
      `id, view_count, expires_at,
       clips (
         name, team_id, render_status, rendered_segments,
         videos ( video_url, title, home_team, away_team,
           match_videos ( match_id, matches ( id, club_id, club_team_id, team_a_name, team_b_name, match_date, start_time, score_a, score_b, public_location, show_public_location, sponsor_source, sponsor_caption ) )
         ),
         clip_segments ( id, sequence_order, video_id, videos ( video_url ), tags ( id, name, start_time, end_time, color ) )
       )`
    )
    .eq("token", params.token)
    .single();

  if (!shareLink || !shareLink.clips) {
    notFound();
  }

  if (shareLink.expires_at && new Date(shareLink.expires_at) < new Date()) {
    notFound();
  }

  const { error: incrementError } = await supabase.rpc("increment_share_link_view", { target_link_id: shareLink.id });
  // Compatibility while migration 0054 is being rolled out; once present,
  // the RPC path above is atomic and this fallback is never used.
  if (incrementError) {
    await supabase.from("share_links").update({ view_count: shareLink.view_count + 1 }).eq("id", shareLink.id);
  }

  const clip = shareLink.clips as any;
  const match = clip.videos?.match_videos?.[0]?.matches ?? null;
  const sourceSegments = (clip.clip_segments ?? [])
    .sort((a: any, b: any) => a.sequence_order - b.sequence_order)
    .filter((segment: any) => !!segment.tags)
    .map((segment: any) => ({ id: segment.id, name: segment.tags.name, color: segment.tags.color, start_time: segment.tags.start_time, end_time: segment.tags.end_time, url: segment.videos?.video_url }));
  const segments = clip.render_status === "ready" && clip.rendered_segments?.length
    ? clip.rendered_segments.map((segment: any) => ({
        id: segment.id,
        name: segment.name,
        color: segment.color,
        start_time: segment.play_start ?? 0,
        end_time: segment.duration,
        url: segment.url,
        drawings: (segment.mobile_compatible ? [] : segment.drawings ?? []).map((drawing: any) => ({
          id: drawing.id,
          url: drawing.url,
          at_time: (segment.drawing_time_base === "clip" ? (segment.play_start ?? 0) : 0) + drawing.at_seconds,
          duration_seconds: drawing.duration_seconds
        })),
        source_start: segment.source_start,
        source_end: segment.source_end
      }))
    : sourceSegments;
  const hasOnlineSegments = clip.render_status === "ready" && segments.length > 0 && segments.every((segment: any) => typeof segment.url === "string" && /^https?:\/\//.test(segment.url));
  let sponsorUrl: string | null = null;
  let sponsorCaption: string | null = null;
  if (match?.club_id && match.sponsor_source !== "none") {
    const { data: club } = await supabase.from("clubs").select("clip_advertising_enabled, general_sponsor_url").eq("id", match.club_id).maybeSingle();
    if (club?.clip_advertising_enabled) {
      if (match.sponsor_source === "club") sponsorUrl = club.general_sponsor_url;
      if (match.sponsor_source === "team" && match.club_team_id) {
        const { data: clubTeam } = await supabase.from("club_teams").select("sponsor_url, sponsor_enabled").eq("id", match.club_team_id).maybeSingle();
        sponsorUrl = clubTeam?.sponsor_enabled ? clubTeam.sponsor_url : null;
      }
      sponsorCaption = sponsorUrl ? match.sponsor_caption : null;
    }
  } else if (!match && clip.team_id) {
    const { data: team } = await supabase.from("teams").select("club_team_id").eq("id", clip.team_id).maybeSingle();
    if (team?.club_team_id) {
      const { data: clubTeam } = await supabase.from("club_teams").select("club_id, sponsor_url, sponsor_enabled").eq("id", team.club_team_id).maybeSingle();
      if (clubTeam?.club_id) {
        const { data: club } = await supabase.from("clubs").select("clip_advertising_enabled, general_sponsor_url, use_general_sponsor").eq("id", clubTeam.club_id).maybeSingle();
        sponsorUrl = club?.clip_advertising_enabled === true
          ? (club?.use_general_sponsor !== false ? club?.general_sponsor_url : (clubTeam.sponsor_enabled ? clubTeam.sponsor_url : null))
          : null;
      }
    }
  }

  return (
    <div className="flex min-h-screen flex-col bg-page">
      <header className="border-b border-border bg-black/80 px-4 py-5">
        <div className="mx-auto flex max-w-6xl justify-center">
          <Image src="/branding/banner.png" alt="Clipboard Coach Studio" width={480} height={150} className="h-auto w-full max-w-md" priority />
        </div>
      </header>

      <main className="mx-auto flex w-full max-w-6xl flex-1 flex-col justify-center px-4 py-6">
        {match && <section className="mb-5 rounded-xl border border-border bg-card p-5 text-center">
          <p className="text-xs font-bold uppercase tracking-[0.16em] text-accent">Wedstrijd</p>
          <div className="mt-3 flex flex-wrap items-center justify-center gap-3 text-textBright">
            <h1 className="text-xl font-black sm:text-2xl">{match.team_a_name}</h1>
            <strong className="rounded-lg bg-cardDeep px-3 py-1.5 text-xl">{match.score_a !== null && match.score_b !== null ? `${match.score_a} – ${match.score_b}` : "–"}</strong>
            <h2 className="text-xl font-black sm:text-2xl">{match.team_b_name}</h2>
          </div>
          <p className="mt-3 text-sm text-textMuted">{match.match_date ? new Intl.DateTimeFormat("nl-BE", { day: "numeric", month: "long", year: "numeric" }).format(new Date(`${match.match_date}T12:00:00`)) : ""}{match.start_time ? ` · ${match.start_time.slice(0, 5)}` : ""}{match.show_public_location && match.public_location ? ` · ${match.public_location}` : ""}</p>
        </section>}
        <div className="overflow-hidden rounded-xl border border-border bg-card">
          {hasOnlineSegments ? (
            <ShareClipPlayer videoUrl={clip.videos?.video_url} segments={segments} />
          ) : (
            <div className="grid min-h-72 place-items-center bg-black p-8 text-center">
              <div><h2 className="font-semibold text-textBright">{t("public.unavailable")}</h2><p className="mt-2 text-sm text-textMuted">{t("public.unavailableBody")}</p></div>
            </div>
          )}
        </div>
        {sponsorUrl && (
          <div className="mt-5 overflow-hidden rounded-xl border border-border bg-white text-center">
            <Image
              src={sponsorUrl}
              alt="Sponsors"
              width={2048}
              height={768}
              className="h-auto w-full"
              unoptimized
            />
            {sponsorCaption && <p className="border-t border-black/10 px-4 py-3 text-sm font-semibold text-black">{sponsorCaption}</p>}
          </div>
        )}
      </main>

      <footer className="mt-auto border-t border-border bg-black px-4 py-8 text-center">
        <div className="mx-auto flex max-w-6xl flex-col items-center">
          <Image src="/branding/logo.png" alt="" width={48} height={48} className="mb-3 h-12 w-12" />
          <p className="text-sm font-semibold text-textPrimary">{t("public.madeWith")}</p>
          <p className="mt-1 text-xs text-textMuted">{t("public.tagline")}</p>
          <a href="/signup" className="mt-4 inline-block rounded-lg bg-accent px-6 py-2 font-semibold text-page">
            {t("public.start")}
          </a>
          <div className="mt-5"><LegalLinks includeReport /></div>
        </div>
      </footer>
    </div>
  );
}
