import type { SupabaseClient } from "@supabase/supabase-js";
import { normalizeClubName } from "./resolve-belgian-club-by-name";

export async function getUnresolvedClubNameCount(admin: SupabaseClient): Promise<number> {
  const pageSize = 1000;
  const names = new Set<string>();

  for (const side of ["a", "b"] as const) {
    const nameColumn = `team_${side}_name`;
    const clubColumn = `team_${side}_belgian_club_id`;
    for (let from = 0; ; from += pageSize) {
      const { data, error } = await admin
        .from("matches")
        .select(nameColumn)
        .is(clubColumn, null)
        .not(nameColumn, "is", null)
        .range(from, from + pageSize - 1);
      if (error) throw error;
      for (const row of data ?? []) {
        const value = (row as unknown as Record<string, unknown>)[nameColumn];
        if (typeof value !== "string") continue;
        const normalized = normalizeClubName(value.trim());
        if (normalized) names.add(normalized);
      }
      if ((data?.length ?? 0) < pageSize) break;
    }
  }

  return names.size;
}
