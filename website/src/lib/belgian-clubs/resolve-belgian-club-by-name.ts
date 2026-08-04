import { createAdminClient } from "@/lib/supabase/admin";

// Same normalization strategy already used for de-duplicating imported
// fixtures (see normalizeTeamName in foot24-calendar.ts / normalized in
// voetbal-vlaanderen-calendar.ts): lowercase, strip diacritics, alphanumeric
// only. Keeping it separate here (rather than importing those) avoids
// coupling this generic matcher to either import module.
export function normalizeClubName(value: string) {
  return value
    // Team/division codes like "(1 A)" or "(U13 A)" are never part of the
    // club's identity - drop them before comparing.
    .replace(/\([^)]*\)/g, "")
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLocaleLowerCase("nl")
    .replace(/[^a-z0-9]/g, "");
}

// normalized name -> belgian_clubs.id. Rebuilt once per process from
// belgian_clubs.naam and club_name_aliases.alias; 1485 clubs is small enough
// to hold in memory rather than hitting the DB on every lookup.
let nameIndexCache: Map<string, string> | null = null;

async function getNameIndex(): Promise<Map<string, string>> {
  if (nameIndexCache) return nameIndexCache;

  const admin = createAdminClient();
  const [{ data: clubs }, { data: aliases }] = await Promise.all([
    admin.from("belgian_clubs").select("id, naam"),
    admin.from("club_name_aliases").select("alias, belgian_club_id")
  ]);

  const index = new Map<string, string>();
  for (const club of clubs ?? []) index.set(normalizeClubName(club.naam as string), club.id as string);
  // Aliases are inserted after club names so a confirmed alias always wins.
  for (const alias of aliases ?? []) index.set(normalizeClubName(alias.alias as string), alias.belgian_club_id as string);

  nameIndexCache = index;
  return index;
}

// Call after writing to belgian_clubs or club_name_aliases so the next
// lookup picks up the change instead of serving a stale cached index.
export function invalidateBelgianClubNameIndex() {
  nameIndexCache = null;
}

/**
 * Resolves a literal team/club name (as it appears on a match, e.g.
 * team_a_name or team_b_name) to a belgian_clubs.id, by exact match after
 * normalization against belgian_clubs.naam or a known club_name_aliases
 * entry. No fuzzy/similarity matching - a wrong club link is worse than no
 * logo, so anything that doesn't match exactly returns null and is left for
 * manual review instead of guessing.
 */
export async function resolveBelgianClubByName(name: string | null | undefined): Promise<string | null> {
  const trimmed = name?.trim();
  if (!trimmed) return null;
  const index = await getNameIndex();
  return index.get(normalizeClubName(trimmed)) ?? null;
}
