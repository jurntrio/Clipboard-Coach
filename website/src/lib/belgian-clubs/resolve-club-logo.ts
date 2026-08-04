import { createAdminClient } from "@/lib/supabase/admin";
import { getPublicUrl } from "@/lib/r2/upload";

export type ClubLogoResult =
  | { src: string; quality: "large" | "small" }
  | { src: null; quality: "missing" };

type LogoPaths = { small: string | null; large: string | null };

// Per-process caches, keyed by whichever identifier the caller has:
// stamnummer (the admin screen) or belgian_clubs.id (matches, which store
// that uuid directly via team_a/b_belgian_club_id - see resolveClubLogoById).
// Belgian club logos change rarely (only via the platform-admin upload
// screen or the one-time seed), so a simple in-memory cache avoids a DB
// round trip on every render without needing a shared cache layer.
const cacheByStamnummer = new Map<number, LogoPaths>();
const cacheById = new Map<string, LogoPaths>();

async function getLogoPaths(stamnummer: number): Promise<LogoPaths> {
  const cached = cacheByStamnummer.get(stamnummer);
  if (cached) return cached;

  const admin = createAdminClient();
  const { data } = await admin
    .from("belgian_clubs")
    .select("small_logo_path, large_logo_path")
    .eq("stamnummer", stamnummer)
    .maybeSingle();

  const paths: LogoPaths = {
    small: data?.small_logo_path ?? null,
    large: data?.large_logo_path ?? null
  };
  cacheByStamnummer.set(stamnummer, paths);
  return paths;
}

async function getLogoPathsById(belgianClubId: string): Promise<LogoPaths> {
  const cached = cacheById.get(belgianClubId);
  if (cached) return cached;

  const admin = createAdminClient();
  const { data } = await admin
    .from("belgian_clubs")
    .select("small_logo_path, large_logo_path")
    .eq("id", belgianClubId)
    .maybeSingle();

  const paths: LogoPaths = {
    small: data?.small_logo_path ?? null,
    large: data?.large_logo_path ?? null
  };
  cacheById.set(belgianClubId, paths);
  return paths;
}

// Invalidate after an admin uploads/removes a large logo so the next render
// picks up the change instead of serving a stale cached result. Clears both
// caches unconditionally - cheap to rebuild, and this only runs on a rare
// admin action, so there's no need to track which entry belongs to which.
export function invalidateClubLogoCache() {
  cacheByStamnummer.clear();
  cacheById.clear();
}

/**
 * Resolves the logo to show for a Belgian club, by stamnummer.
 *
 * purpose "ui": always the small logo (match lists, team lists, calendar,
 * thumbnails, mobile, admin) - large logos are never needed there.
 *
 * purpose "display": large visual contexts (ClubTV, matchposter, line-up
 * screen). Tries the large logo first, falls back to small, then missing.
 * The caller decides how big to render each quality - this only resolves
 * which file exists.
 */
export async function resolveClubLogo(
  stamnummer: number | null | undefined,
  purpose: "ui" | "display"
): Promise<ClubLogoResult> {
  if (!stamnummer) return { src: null, quality: "missing" };

  const { small, large } = await getLogoPaths(stamnummer);

  if (purpose === "display" && large) return { src: getPublicUrl(large), quality: "large" };
  if (small) return { src: getPublicUrl(small), quality: "small" };
  return { src: null, quality: "missing" };
}

/** Same resolution logic as resolveClubLogo, but keyed by belgian_clubs.id
 * (a uuid) instead of stamnummer - for callers that already hold that id,
 * like matches.team_a_belgian_club_id / team_b_belgian_club_id, so they
 * don't need an extra join just to look up the stamnummer first. */
export async function resolveClubLogoById(
  belgianClubId: string | null | undefined,
  purpose: "ui" | "display"
): Promise<ClubLogoResult> {
  if (!belgianClubId) return { src: null, quality: "missing" };

  const { small, large } = await getLogoPathsById(belgianClubId);

  if (purpose === "display" && large) return { src: getPublicUrl(large), quality: "large" };
  if (small) return { src: getPublicUrl(small), quality: "small" };
  return { src: null, quality: "missing" };
}
