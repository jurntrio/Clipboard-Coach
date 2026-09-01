import { SectionHeader } from "@/components/ui/SectionHeader";
import { requireAdminOrViewer } from "@/lib/auth/admin";
import { createAdminClient } from "@/lib/supabase/admin";
import { ClubAdminManager } from "./ClubAdminManager";

type ClubUsage = {
  teams: number;
  players: number;
  members: number;
  trainings: number;
  matches: number;
  videos: number;
  clips: number;
  videoBytes: number;
  clipBytes: number;
  trainingBytes: number;
  clipsWithUnknownSize: number;
};

function jsonBytes(value: unknown) {
  return Buffer.byteLength(JSON.stringify(value ?? null), "utf8");
}

function renderedSegmentBytes(value: unknown) {
  if (!Array.isArray(value)) return { bytes: 0, unknown: false };
  let bytes = 0;
  let unknown = false;
  for (const segment of value) {
    if (!segment || typeof segment !== "object") continue;
    const size = Number((segment as { file_size?: unknown }).file_size);
    if (Number.isFinite(size) && size >= 0) bytes += size;
    else if ((segment as { key?: unknown }).key) unknown = true;
  }
  return { bytes, unknown };
}

export default async function AdminClubsPage() {
  const { isFullAdmin } = await requireAdminOrViewer();
  const admin = createAdminClient();
  const { data: profiles } = await admin.from("profiles").select("id, email, full_name").order("full_name");
  const clubRelations = "club_teams:club_teams!club_teams_club_id_fkey(id, name), club_memberships(profile_id, role), club_module_entitlements(module_key, enabled), club_trainers(id, profile_id, display_name, phone_number, invitation_status, profiles(email), club_trainer_teams(club_teams(name)))";
  const withLogos = await admin.from("clubs").select(`id, name, rbfa_registration_number, logo_url, clip_advertising_enabled, external_recording_url_template, external_recording_camera_count, ${clubRelations}`).order("name");
  const fallback = withLogos.error
    ? await admin.from("clubs").select(`id, name, rbfa_registration_number, ${clubRelations}`).order("name")
    : null;
  const clubs = withLogos.data ?? fallback?.data ?? [];
  const clubIds = (clubs ?? []).map((club) => club.id);
  const [
    { data: clubPlayers },
    { data: clubTrainings },
    { data: trainerTrainings },
    { data: matches },
    { data: teams },
    { data: videos },
    { data: clips },
    { data: matchVideos }
  ] = clubIds.length ? await Promise.all([
    admin.from("club_players").select("id, club_id").in("club_id", clubIds),
    admin.from("club_trainings").select("id, club_id").in("club_id", clubIds),
    admin.from("trainer_trainings").select("id, club_id, club_training_id, content").in("club_id", clubIds),
    admin.from("matches").select("id, club_id").in("club_id", clubIds),
    admin.from("teams").select("id, club_team_id"),
    admin.from("videos").select("id, team_id, file_size"),
    admin.from("clips").select("id, video_id, rendered_segments"),
    admin.from("match_videos").select("match_id, video_id")
  ]) : Array.from({ length: 8 }, () => ({ data: [] }));

  const clubTeamToClub = new Map<string, string>();
  for (const club of clubs ?? []) {
    for (const team of club.club_teams ?? []) clubTeamToClub.set(team.id, club.id);
  }
  const teamToClub = new Map((teams ?? []).flatMap((team) => {
    const clubId = team.club_team_id ? clubTeamToClub.get(team.club_team_id) : null;
    return clubId ? [[team.id, clubId] as const] : [];
  }));
  const matchToClub = new Map((matches ?? []).flatMap((match) => match.club_id ? [[match.id, match.club_id] as const] : []));
  const videoToClub = new Map<string, string>();
  for (const video of videos ?? []) {
    const clubId = video.team_id ? teamToClub.get(video.team_id) : null;
    if (clubId) videoToClub.set(video.id, clubId);
  }
  for (const link of matchVideos ?? []) {
    const clubId = matchToClub.get(link.match_id);
    if (clubId) videoToClub.set(link.video_id, clubId);
  }

  const usageByClub = Object.fromEntries(clubIds.map((clubId) => [clubId, {
    teams: clubTeamToClub.size ? [...clubTeamToClub.values()].filter((value) => value === clubId).length : 0,
    players: (clubPlayers ?? []).filter((item) => item.club_id === clubId).length,
    members: (clubs ?? []).find((club) => club.id === clubId)?.club_memberships?.length ?? 0,
    trainings: (clubTrainings ?? []).filter((item) => item.club_id === clubId).length
      + (trainerTrainings ?? []).filter((item) => item.club_id === clubId && !item.club_training_id).length,
    matches: (matches ?? []).filter((item) => item.club_id === clubId).length,
    videos: [...videoToClub.values()].filter((value) => value === clubId).length,
    clips: (clips ?? []).filter((clip) => videoToClub.get(clip.video_id) === clubId).length,
    videoBytes: (videos ?? []).filter((video) => videoToClub.get(video.id) === clubId)
      .reduce((sum, video) => sum + Math.max(0, Number(video.file_size) || 0), 0),
    clipBytes: (clips ?? []).filter((clip) => videoToClub.get(clip.video_id) === clubId)
      .reduce((sum, clip) => sum + renderedSegmentBytes(clip.rendered_segments).bytes, 0),
    trainingBytes: (trainerTrainings ?? []).filter((training) => training.club_id === clubId)
      .reduce((sum, training) => sum + jsonBytes(training.content), 0),
    clipsWithUnknownSize: (clips ?? []).filter((clip) =>
      videoToClub.get(clip.video_id) === clubId && renderedSegmentBytes(clip.rendered_segments).unknown
    ).length
  } satisfies ClubUsage])) as Record<string, ClubUsage>;

  const rows = (clubs ?? []).map((club) => ({
    ...club,
    logo_url: "logo_url" in club ? (club.logo_url as string | null) : null,
    clip_advertising_enabled: "clip_advertising_enabled" in club ? club.clip_advertising_enabled !== false : true,
    external_recording_url_template: "external_recording_url_template" in club ? club.external_recording_url_template as string | null : null,
    external_recording_camera_count: "external_recording_camera_count" in club ? club.external_recording_camera_count as number | null : null,
    teams: (club.club_teams ?? []) as { id: string; name: string }[],
    memberships: (club.club_memberships ?? []) as { profile_id: string; role: "trainer" | "club_admin" | "club_admin_viewer" | "analyst" }[],
    modules: (club.club_module_entitlements ?? []) as { module_key: string; enabled: boolean }[],
    usage: usageByClub[club.id],
    trainers: (club.club_trainers ?? []) as unknown as {
      id: string;
      profile_id: string | null;
      display_name: string;
      phone_number: string | null;
      invitation_status: string;
      profiles: { email: string } | { email: string }[] | null;
      club_trainer_teams: { club_teams: { name: string } | { name: string }[] | null }[];
    }[]
  }));
  return <div className="mx-auto max-w-7xl p-8"><SectionHeader title="Clubs" subtitle="Beheer modules, rollen en het gebruik per club." artworkSrc="/branding/admin.webp" backHref="/dashboard/admin" /><ClubAdminManager clubs={rows} profiles={profiles ?? []} readOnly={!isFullAdmin} /></div>;
}
