import { createAdminClient } from "@/lib/supabase/admin";
import type { Player, Profile, Team, Video } from "@/types/database";

export type CoachOverview = Profile & {
  banned_until: string | null;
  last_sign_in_at: string | null;
  teamCount: number;
  playerCount: number;
  videoCount: number;
  failedVideoCount: number;
  clipCount: number;
  storageBytes: number;
};

type StoredClipSegment = { file_size?: number | null };
type StoredClip = { coach_id: string; rendered_segments?: StoredClipSegment[] | null };

export function cloudVideoBytes(video: Pick<Video, "video_url" | "file_size">) {
  return video.video_url.startsWith("local://") ? 0 : (video.file_size ?? 0);
}

export function renderedClipBytes(clip: Pick<StoredClip, "rendered_segments">) {
  return (clip.rendered_segments ?? []).reduce((sum, segment) => sum + (segment.file_size ?? 0), 0);
}

export function isBanned(bannedUntil: string | null): boolean {
  return !!bannedUntil && new Date(bannedUntil).getTime() > Date.now();
}

// Service-role reads for the admin dashboard: joins auth.users (ban status,
// last sign-in) with the app tables, which RLS otherwise hides per-coach.
export async function getCoachOverviews(): Promise<CoachOverview[]> {
  const admin = createAdminClient();

  const [{ data: authUsers }, { data: profiles }, { data: teams }, { data: players }, { data: videos }, { data: clips }] =
    await Promise.all([
      admin.auth.admin.listUsers({ perPage: 1000 }),
      admin.from("profiles").select("*").order("created_at", { ascending: false }),
      admin.from("teams").select("id, coach_id"),
      admin.from("players").select("id, team_id"),
      admin.from("videos").select("id, coach_id, video_url, file_size, processing_status").eq("status", "active"),
      admin.from("clips").select("id, coach_id, rendered_segments")
    ]);

  const authById = new Map(authUsers?.users.map((u) => [u.id, u]) ?? []);
  const coachIdByTeamId = new Map((teams ?? []).map((t) => [t.id, t.coach_id]));

  return (profiles ?? []).map((profile) => {
    const auth = authById.get(profile.id);
    const coachVideos = (videos ?? []).filter((v) => v.coach_id === profile.id);
    const coachClips = ((clips ?? []) as StoredClip[]).filter((clip) => clip.coach_id === profile.id);

    return {
      ...profile,
      banned_until: (auth as any)?.banned_until ?? null,
      last_sign_in_at: auth?.last_sign_in_at ?? null,
      teamCount: (teams ?? []).filter((t) => t.coach_id === profile.id).length,
      playerCount: (players ?? []).filter((p) => coachIdByTeamId.get(p.team_id) === profile.id).length,
      videoCount: coachVideos.length,
      failedVideoCount: coachVideos.filter((v) => v.processing_status === "failed").length,
      clipCount: (clips ?? []).filter((c) => c.coach_id === profile.id).length,
      storageBytes:
        coachVideos.reduce((sum, video) => sum + cloudVideoBytes(video), 0) +
        coachClips.reduce((sum, clip) => sum + renderedClipBytes(clip), 0)
    };
  });
}

export type AdminVideo = {
  id: string;
  coach_id: string;
  coach_email: string;
  title: string | null;
  home_team: string | null;
  away_team: string | null;
  file_size: number | null;
  video_url: string;
  processing_status: string;
  processing_error: string | null;
  created_at: string;
};

export async function getAllVideos(): Promise<AdminVideo[]> {
  const admin = createAdminClient();

  const [{ data: videos }, { data: profiles }] = await Promise.all([
    admin
      .from("videos")
      .select("id, coach_id, title, home_team, away_team, video_url, file_size, processing_status, processing_error, created_at")
      .eq("status", "active")
      .order("created_at", { ascending: false }),
    admin.from("profiles").select("id, email")
  ]);

  const emailById = new Map((profiles ?? []).map((p) => [p.id, p.email]));

  return (videos ?? []).map((v) => ({ ...v, coach_email: emailById.get(v.coach_id) ?? "unknown" }));
}

export type CoachDetail = {
  profile: Profile;
  banned_until: string | null;
  last_sign_in_at: string | null;
  email_confirmed_at: string | null;
  teams: (Team & { players: Player[] })[];
  videos: Video[];
  clipCount: number;
  clipStorageBytes: number;
};

export async function getCoachDetail(coachId: string): Promise<CoachDetail | null> {
  const admin = createAdminClient();

  const [{ data: authUser }, { data: profile }, { data: teams }, { data: clips }] = await Promise.all([
    admin.auth.admin.getUserById(coachId),
    admin.from("profiles").select("*").eq("id", coachId).maybeSingle(),
    admin.from("teams").select("*, players(*)").eq("coach_id", coachId).order("created_at", { ascending: false }),
    admin.from("clips").select("id, rendered_segments").eq("coach_id", coachId)
  ]);

  if (!profile) return null;

  const { data: videos } = await admin
    .from("videos")
    .select("*")
    .eq("coach_id", coachId)
    .eq("status", "active")
    .order("created_at", { ascending: false });

  return {
    profile,
    banned_until: (authUser?.user as any)?.banned_until ?? null,
    last_sign_in_at: authUser?.user?.last_sign_in_at ?? null,
    email_confirmed_at: authUser?.user?.email_confirmed_at ?? null,
    teams: (teams as (Team & { players: Player[] })[] | null) ?? [],
    videos: videos ?? [],
    clipCount: clips?.length ?? 0,
    clipStorageBytes: ((clips ?? []) as Pick<StoredClip, "rendered_segments">[]).reduce(
      (sum, clip) => sum + renderedClipBytes(clip),
      0
    )
  };
}
