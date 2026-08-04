import { createAdminClient } from "@/lib/supabase/admin";
import { getPublicUrl } from "@/lib/r2/upload";

export type ClubLogoResult =
  | { src: string; quality: "large" | "small" }
  | { src: null; quality: "missing" };

type LogoPaths = { small: string | null; large: string | null };

// Per-process cache: stamnummer -> logo paths. Belgian club logos change
// rarely (only via the platform-admin upload screen or the one-time seed),
// so a simple in-memory cache avoids a DB round trip on every render without
// needing a shared cache layer.
const cache = new Map<number, LogoPaths>();

async function getLogoPaths(stamnummer: number): Promise<LogoPaths> {
  const cached = cache.get(stamnummer);
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
  cache.set(stamnummer, paths);
  return paths;
}

// Invalidate after an admin uploads/removes a large logo so the next render
// picks up the change instead of serving the cached "missing" result.
export function invalidateClubLogoCache(stamnummer: number) {
  cache.delete(stamnummer);
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
