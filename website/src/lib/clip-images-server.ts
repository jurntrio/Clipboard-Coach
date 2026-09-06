import sharp from "sharp";
import type { User } from "@supabase/supabase-js";
import { GetObjectCommand, PutObjectCommand, S3Client } from "@aws-sdk/client-s3";
import { createAdminClient } from "@/lib/supabase/admin";
import { canAccessTeam, getClubAccess, hasClubPermission } from "@/lib/auth/club-access";
import { resolveClubLogoById } from "@/lib/belgian-clubs/resolve-club-logo";
import { getPublicUrl } from "@/lib/r2/upload";
import { readIntro } from "./clip-intro-storage";
import type { ClipIntro, IntroMatch } from "./clip-intro";

const client = () => new S3Client({ region: "auto", endpoint: `https://${process.env.R2_ACCOUNT_ID}.r2.cloudflarestorage.com`, credentials: { accessKeyId: process.env.R2_ACCESS_KEY_ID!, secretAccessKey: process.env.R2_SECRET_ACCESS_KEY! } });
export async function readImageObject(key: string): Promise<Buffer | null> {
  try {
    const response = await client().send(new GetObjectCommand({ Bucket: process.env.R2_BUCKET_NAME, Key: key }));
    return Buffer.from(await response.Body!.transformToByteArray());
  } catch (error) { if ((error as { name?: string }).name === "NoSuchKey") return null; throw error; }
}
export async function writeImageObject(key: string, body: Buffer | string, contentType: string) {
  await client().send(new PutObjectCommand({ Bucket: process.env.R2_BUCKET_NAME, Key: key, Body: body, ContentType: contentType, CacheControl: "no-store" }));
}
export async function clipImagesAllowed(teamId: string | null): Promise<boolean> {
  if (!teamId) return false;
  const policy = await readImageObject(`clip-intros/permissions/${teamId}.json`);
  if (policy) return JSON.parse(policy.toString()).allowed === true;
  // Initial rollout: preserve only the explicitly configured KMT A/B defaults.
  return (await readIntro("team", teamId))?.enabled === true;
}

export async function clipImageSource(videoId: string, user: User) {
  const db = createAdminClient();
  const { data: video, error } = await db.from("videos").select("id,coach_id,team_id,home_team,away_team").eq("id", videoId).single();
  if (error || !video) return null;
  const { data: link, error: linkError } = await db.from("match_videos").select("match_id").eq("video_id", videoId).limit(1).maybeSingle();
  if (linkError) throw linkError;
  const matchResult = link ? await db.from("matches").select("club_id,club_team_id,team_a_name,team_b_name,score_a,score_b,team_a_belgian_club_id,team_b_belgian_club_id").eq("id", link.match_id).single() : { data: null, error: null };
  if (matchResult.error) throw matchResult.error;
  const match = matchResult.data;
  const { data: team, error: teamError } = video.team_id ? await db.from("teams").select("club_team_id").eq("id", video.team_id).maybeSingle() : { data: null, error: null };
  if (teamError) throw teamError;
  const teamId = match?.club_team_id ?? team?.club_team_id ?? null;
  const { data: clubTeam, error: clubTeamError } = teamId ? await db.from("club_teams").select("club_id,name").eq("id", teamId).single() : { data: null, error: null };
  if (clubTeamError) throw clubTeamError;
  const clubId = match?.club_id ?? clubTeam?.club_id;
  if (video.coach_id !== user.id) {
    if (!clubId) return null;
    const access = await getClubAccess(clubId, user);
    if (access.readOnly || !canAccessTeam(access, teamId) || !hasClubPermission(access, "video.view")) return null;
  }
  const [allowed, logoA, logoB] = await Promise.all([clipImagesAllowed(teamId), resolveClubLogoById(match?.team_a_belgian_club_id, "display"), resolveClubLogoById(match?.team_b_belgian_club_id, "display")]);
  const matchCard: IntroMatch = { teamA: match?.team_a_name ?? video.home_team ?? clubTeam?.name ?? "Ploeg A", teamB: match?.team_b_name ?? video.away_team ?? "Ploeg B", logoA: logoA.src, logoB: logoB.src,
    score: match?.score_a != null && match?.score_b != null ? `${match.score_a} – ${match.score_b}` : "" };
  return { allowed, teamId, teamName: clubTeam?.name ?? null, matchCard };
}

export function creationImageKey(url: string, userId: string, videoId: string): string {
  const prefix = `clip-intros/creation/${userId}/${videoId}/`;
  const publicPrefix = getPublicUrl(prefix);
  if (!url.startsWith(publicPrefix)) throw new Error("Upload deze afbeelding opnieuw bij de clip.");
  const name = url.slice(publicPrefix.length);
  if (!/^[0-9a-f-]{36}\.png$/i.test(name)) throw new Error("Ongeldige afbeelding.");
  return `${prefix}${name}`;
}

export async function uploadCreationImage(file: File, userId: string, videoId: string) {
  if (!["image/png", "image/jpeg", "image/webp"].includes(file.type) || file.size <= 0 || file.size > 5 * 1024 * 1024) throw new Error("Kies PNG, JPEG of WebP, maximaal 5 MB.");
  const image = await sharp(Buffer.from(await file.arrayBuffer()), { limitInputPixels: 40_000_000 }).rotate().resize({ width: 1920, height: 1080, fit: "inside", withoutEnlargement: true }).png().toBuffer();
  const key = `clip-intros/creation/${userId}/${videoId}/${crypto.randomUUID()}.png`;
  await writeImageObject(key, image, "image/png");
  return { key, url: getPublicUrl(key) };
}

const escapeXml = (value: string) => value.replace(/[&<>"']/g, character => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&apos;" }[character]!));
async function trustedLogo(url: string | null): Promise<string | null> {
  if (!url) return null;
  const base = `${process.env.R2_PUBLIC_URL?.replace(/\/$/, "")}/`;
  if (!url.startsWith(base)) return null;
  const content = await readImageObject(decodeURIComponent(url.slice(base.length)));
  if (!content) throw new Error("Een gekozen logo ontbreekt. Probeer opnieuw.");
  const png = await sharp(content, { limitInputPixels: 40_000_000 }).resize({ width: 400, height: 200, fit: "inside" }).png().toBuffer();
  return `data:image/png;base64,${png.toString("base64")}`;
}
export async function renderOpeningCard(settings: ClipIntro, match: IntroMatch, userId: string, videoId: string, clipId: string) {
  if (settings.mode === "upload") {
    const key = creationImageKey(settings.imageUrl, userId, videoId);
    if (!await readImageObject(key)) throw new Error("Het introbeeld ontbreekt.");
    return key;
  }
  if (settings.sponsorLogoUrl) creationImageKey(settings.sponsorLogoUrl, userId, videoId);
  const [logoA, logoB, sponsor] = await Promise.all([trustedLogo(match.logoA), trustedLogo(match.logoB), settings.mode === "sponsor" ? trustedLogo(settings.sponsorLogoUrl || null) : null]);
  const logo = (image: string | null, x: number, y: number, width: number, height: number) => image ? `<image href="${image}" x="${x}" y="${y}" width="${width}" height="${height}" preserveAspectRatio="xMidYMid meet"/>` : "";
  const text = (value: string, x: number, y: number, size: number, color = "white") => `<text x="${x}" y="${y}" text-anchor="middle" font-family="DejaVu Sans,sans-serif" font-size="${size}" fill="${color}">${escapeXml(value)}</text>`;
  const teamText = (value: string, x: number) => text(value, x, 375, Math.max(15, Math.min(32, 640 / Math.max(value.length, 1))));
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="1280" height="720"><rect width="1280" height="720" fill="#081d15"/>
    ${logo(logoA, 245, 130, 180, 180)}${logo(logoB, 855, 130, 180, 180)}
    ${teamText(match.teamA, 335)}${teamText(match.teamB, 945)}${text(settings.showScore ? settings.score || match.score || "–" : "–", 640, 280, 48)}
    ${settings.mode === "sponsor" ? `<path d="M180 430H1100" stroke="#5a7067"/>${text(settings.sponsorLabel, 640, 477, 24, "#c6d2cd")}${logo(sponsor, 470, 500, 340, 95)}${text(settings.sponsorName, 640, 650, Math.max(14, Math.min(34, 1400 / Math.max(settings.sponsorName.length, 1))))}` : ""}
    </svg>`;
  const key = `clip-intros/render-assets/${clipId}/opening.png`;
  await writeImageObject(key, await sharp(Buffer.from(svg)).png().toBuffer(), "image/png");
  return key;
}
