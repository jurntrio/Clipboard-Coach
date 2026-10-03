import { cache } from "react";
import { createAdminClient } from "@/lib/supabase/admin";
import type { Match } from "@/types/database";

type TagMatch = Pick<Match, "id" | "team_a_name" | "team_b_name" | "is_home_match" | "match_date" | "start_time" | "status" | "score_a" | "score_b" | "live_tag_names" | "official_home_team_name" | "official_away_team_name" | "team_a_belgian_club_id" | "team_b_belgian_club_id">;

// Reuse the link lookup between page rendering and metadata in the same request.
export const loadLiveTagPage = cache(async (token: string) => {
  const admin = createAdminClient();
  const { data } = await admin.from("match_tag_links")
    .select("matches(id, team_a_name, team_b_name, is_home_match, match_date, start_time, status, score_a, score_b, live_tag_names, official_home_team_name, official_away_team_name, team_a_belgian_club_id, team_b_belgian_club_id, player_ids)")
    .eq("token", token).eq("active", true).maybeSingle();
  const row = data?.matches as unknown as (TagMatch & { player_ids: string[] }) | null;
  const today = new Date().toISOString().slice(0, 10);
  if (!row || row.status === "finished" || (row.match_date && row.match_date < today)) return null;
  const { player_ids, ...match } = row;
  return { match, playerIds: player_ids ?? [] };
});
