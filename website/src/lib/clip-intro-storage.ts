import { GetObjectCommand, PutObjectCommand, S3Client } from "@aws-sdk/client-s3";
import { createAdminClient } from "@/lib/supabase/admin";
import { resolveClubLogoById } from "@/lib/belgian-clubs/resolve-club-logo";
import { defaultClipIntro, parseClipIntro, type ClipIntro, type IntroMatch } from "./clip-intro";

const client = () => new S3Client({ region: "auto", endpoint: `https://${process.env.R2_ACCOUNT_ID}.r2.cloudflarestorage.com`,
  credentials: { accessKeyId: process.env.R2_ACCESS_KEY_ID!, secretAccessKey: process.env.R2_SECRET_ACCESS_KEY! } });
const key = (scope: "clip" | "match" | "team", id: string) => `clip-intros/${scope}/${id}.json`;

export async function readIntro(scope: "clip" | "match" | "team", id: string): Promise<ClipIntro | null> {
  try {
    const response = await client().send(new GetObjectCommand({ Bucket: process.env.R2_BUCKET_NAME, Key: key(scope, id) }));
    return parseClipIntro(JSON.parse(await response.Body!.transformToString()));
  } catch (error) {
    if ((error as { name?: string }).name === "NoSuchKey") return null;
    throw error;
  }
}

export async function writeIntro(scope: "clip" | "match" | "team", id: string, settings: ClipIntro) {
  await client().send(new PutObjectCommand({ Bucket: process.env.R2_BUCKET_NAME, Key: key(scope, id),
    Body: JSON.stringify(settings), ContentType: "application/json", CacheControl: "no-store" }));
}

export async function getIntroContext(clip: { id: string; video_id: string; team_id: string | null }) {
  const db = createAdminClient();
  const { data: link, error } = await db.from("match_videos").select("match_id").eq("video_id", clip.video_id).limit(1).maybeSingle();
  if (error) throw error;
  const { data: match } = link ? await db.from("matches").select("id,club_id,club_team_id,team_a_name,team_b_name,score_a,score_b,team_a_belgian_club_id,team_b_belgian_club_id").eq("id", link.match_id).single() : { data: null };
  const { data: team } = clip.team_id ? await db.from("teams").select("club_team_id").eq("id", clip.team_id).maybeSingle() : { data: null };
  const teamId = match?.club_team_id ?? team?.club_team_id ?? null;
  const { data: clubTeam } = teamId ? await db.from("club_teams").select("club_id,name").eq("id", teamId).maybeSingle() : { data: null };
  const [saved, matchDefault, teamDefault, logoA, logoB] = await Promise.all([
    readIntro("clip", clip.id), match ? readIntro("match", match.id) : null, teamId ? readIntro("team", teamId) : null,
    resolveClubLogoById(match?.team_a_belgian_club_id, "display"), resolveClubLogoById(match?.team_b_belgian_club_id, "display")
  ]);
  const settings = saved ?? matchDefault ?? teamDefault ?? { ...defaultClipIntro };
  const matchCard: IntroMatch = { teamA: match?.team_a_name ?? clubTeam?.name ?? "Ploeg A", teamB: match?.team_b_name ?? "Ploeg B",
    logoA: logoA.src, logoB: logoB.src, score: match?.score_a != null && match?.score_b != null ? `${match.score_a} – ${match.score_b}` : "" };
  return { settings, matchCard, matchId: match?.id ?? null, teamId, teamName: clubTeam?.name ?? null, clubId: match?.club_id ?? clubTeam?.club_id ?? null };
}
