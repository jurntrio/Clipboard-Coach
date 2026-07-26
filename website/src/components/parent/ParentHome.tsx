"use client";

import { useEffect, useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";
import { getPlayerDisplayName } from "@/lib/utils";
import { ClipCard } from "@/components/clips/ClipCard";
import { ClipPreviewModal, type ClipSegmentPlayback } from "@/components/clips/ClipPreviewModal";
import { ExitCard } from "@/components/ui/ExitCard";
import { useI18n } from "@/i18n/client";

// Fase 3: 1 rij per operationele players-rij (een club-breed kind kan er meerdere hebben, 1 per
// team/seizoen-lidmaatschap). child_key groepeert ze -- club_player_id voor een clubbrede speler,
// anders het players.id zelf voor een persoonlijk-teamspeler. Zie guardian_dashboard_players()
// (0034_guardian_club_player_identity.sql).
type DashboardRow = { child_key: string; first_name: string; last_name: string; date_of_birth: string | null; player_id: string; team_id: string | null; team_name: string | null };
type Child = { key: string; firstName: string; lastName: string; playerIds: string[]; teamIds: string[]; teamNames: string[] };
type PlayerClip = {
  id: string; name: string; team_id: string | null;
  audience_type: "full_team" | "selected_players" | "specific_players";
  audience_player_ids: string[]; render_status: string;
  rendered_segments: { id: string; url: string; name: string; color: string; duration: number; play_start?: number; mobile_compatible?: boolean }[];
  videos: { id: string; title: string | null; video_url: string; match_videos: { match_id: string; matches: { id: string; team_a_name: string; team_b_name: string; match_date: string | null; score_a: number | null; score_b: number | null } | null }[] } | null;
  clip_segments: { sequence_order: number; tags: { id: string; name: string; start_time: number; end_time: number; color: string; player_ids: string[] } | null }[];
};

export function ParentHome({ showBackLink }: { showBackLink?: boolean } = {}) {
  const supabase = createClient();
  const [children, setChildren] = useState<Child[]>([]);
  const [activeChildKey, setActiveChildKey] = useState("");
  const [loading, setLoading] = useState(true);

  useEffect(() => { void loadChildren(); }, []);

  async function loadChildren() {
    const { data } = await supabase.rpc("guardian_dashboard_players");
    const rows = (data as DashboardRow[] | null) ?? [];
    const grouped = new Map<string, Child>();
    for (const row of rows) {
      const existing = grouped.get(row.child_key);
      if (existing) {
        existing.playerIds.push(row.player_id);
        if (row.team_id && !existing.teamIds.includes(row.team_id)) existing.teamIds.push(row.team_id);
        if (row.team_name && !existing.teamNames.includes(row.team_name)) existing.teamNames.push(row.team_name);
      } else {
        grouped.set(row.child_key, {
          key: row.child_key, firstName: row.first_name, lastName: row.last_name,
          playerIds: [row.player_id], teamIds: row.team_id ? [row.team_id] : [], teamNames: row.team_name ? [row.team_name] : []
        });
      }
    }
    const list = Array.from(grouped.values());
    setChildren(list);
    setActiveChildKey((current) => (current && list.some((child) => child.key === current)) ? current : (list[0]?.key ?? ""));
    setLoading(false);
  }

  if (!loading && !children.length) {
    return <div className="mx-auto max-w-2xl p-8 text-center">
      {showBackLink && <Link href="/dashboard" className="mb-6 inline-block text-sm text-accent hover:underline">&larr; Terug naar dashboard</Link>}
      <Image src="/branding/banner.png" alt="Clipboard Coach Studio" width={280} height={90} className="mx-auto mb-6" />
      <p className="text-textMuted">Je account is nog niet aan een speler gekoppeld.</p>
      <div className="mt-6"><ExitCard /></div>
    </div>;
  }

  const activeChild = children.find((child) => child.key === activeChildKey);

  return (
    <div className="mx-auto max-w-5xl space-y-8 p-6">
      {showBackLink && <Link href="/dashboard" className="inline-block text-sm text-accent hover:underline">&larr; Terug naar dashboard</Link>}
      <header className="flex flex-wrap items-center gap-3 rounded-xl border border-border bg-card p-4">
        <Image src="/branding/logo.png" alt="" width={44} height={44} />
        <div className="min-w-0 flex-1">
          <h1 className="text-xl font-bold text-textBright">Clipboard Coach Studio</h1>
        </div>
      </header>
      {children.length > 1 && (
        <div className="flex flex-wrap gap-2 rounded-xl border border-border bg-card p-2">
          {children.map((child) => (
            <button
              key={child.key}
              type="button"
              onClick={() => setActiveChildKey(child.key)}
              className={`rounded-lg px-4 py-2 text-sm font-semibold transition ${child.key === activeChildKey ? "bg-accent text-page" : "text-textSecondary hover:bg-cardDeep"}`}
            >
              {getPlayerDisplayName({ first_name: child.firstName, last_name: child.lastName })}
            </button>
          ))}
        </div>
      )}
      {loading ? <p className="text-sm text-textMuted">Laden…</p> : activeChild ? <ChildSection key={activeChild.key} child={activeChild} /> : null}
      <ExitCard />
    </div>
  );
}

function ChildSection({ child }: { child: Child }) {
  const { t, locale } = useI18n();
  const supabase = createClient();
  const [stats, setStats] = useState({ goals: 0, assists: 0 });
  const [clips, setClips] = useState<PlayerClip[]>([]);
  const [selectedClip, setSelectedClip] = useState<PlayerClip | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => { void loadClips(); }, [child.key]);

  async function loadClips() {
    setLoading(true);
    const [{ data: clipData }, { data: statData }] = await Promise.all([
      supabase.from("clips").select(`
        id, name, team_id, audience_type, audience_player_ids, render_status, rendered_segments,
        videos(id, title, video_url, match_videos(match_id, matches(id, team_a_name, team_b_name, match_date, score_a, score_b))),
        clip_segments(sequence_order, tags(id, name, start_time, end_time, color, player_ids))
      `).order("created_at", { ascending: false }),
      supabase.from("player_career_stats").select("goals, assists").in("player_id", child.playerIds)
    ]);
    const allClips = (clipData as unknown as PlayerClip[] | null) ?? [];
    setClips(allClips.filter((clip) => {
      if (child.playerIds.some((id) => clip.audience_player_ids.includes(id))) return true;
      if (clip.clip_segments.some((segment) => segment.tags?.player_ids.some((id) => child.playerIds.includes(id)))) return true;
      return clip.audience_type === "full_team" && !!clip.team_id && child.teamIds.includes(clip.team_id);
    }));
    const totals = (statData ?? []).reduce((sum, row) => ({ goals: sum.goals + (row.goals ?? 0), assists: sum.assists + (row.assists ?? 0) }), { goals: 0, assists: 0 });
    setStats(totals);
    setLoading(false);
  }

  function segmentsFor(clip: PlayerClip): ClipSegmentPlayback[] {
    if (clip.render_status === "ready" && clip.rendered_segments?.length) {
      return clip.rendered_segments.map((segment) => ({ id: segment.id, name: segment.name, color: segment.color, start_time: segment.play_start ?? 0, end_time: segment.duration, url: segment.url }));
    }
    return [...clip.clip_segments].sort((a, b) => a.sequence_order - b.sequence_order).map((item) => item.tags).filter((tag): tag is NonNullable<typeof tag> => !!tag).map((tag) => ({ id: tag.id, name: tag.name, color: tag.color, start_time: tag.start_time, end_time: tag.end_time }));
  }

  const matchGroups = clips.reduce((groups, clip) => {
    const match = clip.videos?.match_videos?.[0]?.matches ?? null;
    const key = match?.id ?? `video:${clip.videos?.id ?? clip.id}`;
    const existing = groups.find((group) => group.key === key);
    if (existing) existing.clips.push(clip);
    else groups.push({ key, match, videoTitle: clip.videos?.title || t("team.untitledVideo"), clips: [clip] });
    return groups;
  }, [] as { key: string; match: NonNullable<PlayerClip["videos"]>["match_videos"][number]["matches"]; videoTitle: string; clips: PlayerClip[] }[]);
  const matchesPlayed = matchGroups.filter((group) => group.match).length;

  return (
    <section className="space-y-4">
      <div className="flex flex-wrap items-baseline gap-2 border-b border-borderSubtle pb-2">
        <h2 className="text-xl font-bold text-textBright">{getPlayerDisplayName({ first_name: child.firstName, last_name: child.lastName })}</h2>
        {!!child.teamNames.length && <p className="text-sm text-textMuted">{child.teamNames.join(", ")}</p>}
      </div>

      <section className="grid gap-3 rounded-xl border border-border bg-cardDeep p-4 sm:grid-cols-3">
        <div><p className="text-xs font-bold uppercase tracking-wide text-textMuted">{t("playerPage.matchesPlayed")}</p><p className="mt-1 text-2xl font-bold text-textBright">{matchesPlayed}</p></div>
        <div><p className="text-xs font-bold uppercase tracking-wide text-textMuted">{t("playerPage.goals")}</p><p className="mt-1 text-2xl font-bold text-textBright">{stats.goals}</p></div>
        <div><p className="text-xs font-bold uppercase tracking-wide text-textMuted">{t("playerPage.assists")}</p><p className="mt-1 text-2xl font-bold text-textBright">{stats.assists}</p></div>
      </section>

      <h3 className="text-sm font-bold uppercase tracking-wider text-textSecondary">{t("playerPage.sharedClipsMatches")}</h3>
      {loading ? <p className="text-sm text-textMuted">{t("team.loadingClips")}</p> : matchGroups.length ? (
        <div className="space-y-5">{matchGroups.map((group) => (
          <section key={group.key} className="overflow-hidden rounded-xl border border-border bg-cardDeep">
            <div className="border-b border-borderSubtle px-4 py-3">
              <h4 className="font-semibold text-textBright">{group.match ? `${group.match.team_a_name} – ${group.match.team_b_name}` : group.videoTitle}</h4>
              <p className="mt-0.5 text-xs text-textMuted">{group.match?.match_date ? new Date(`${group.match.match_date}T00:00:00`).toLocaleDateString(locale === "nl" ? "nl-BE" : "en-GB") : ""}{group.match && group.match.score_a !== null && group.match.score_b !== null ? ` · ${group.match.score_a}–${group.match.score_b}` : ""}</p>
            </div>
            <div className="grid grid-cols-1 gap-3 p-4 sm:grid-cols-2 lg:grid-cols-3">
              {group.clips.map((clip) => <ClipCard key={clip.id} name={clip.name} videoTitle={clip.videos?.title || t("team.untitledVideo")} segmentCount={clip.clip_segments.length} onClick={() => setSelectedClip(clip)} />)}
            </div>
          </section>
        ))}</div>
      ) : <div className="rounded-xl border border-border bg-cardDeep p-5 text-sm text-textMuted">{t("team.noTaggedClips")}</div>}

      {selectedClip && selectedClip.videos && <ClipPreviewModal clipName={selectedClip.name} videoUrl={selectedClip.videos.video_url} segments={segmentsFor(selectedClip)} onClose={() => setSelectedClip(null)} />}
    </section>
  );
}
