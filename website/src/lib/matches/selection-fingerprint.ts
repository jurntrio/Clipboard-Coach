import { createHash } from "node:crypto";

type MatchSelectionSnapshot = {
  match: Record<string, unknown>;
  selections: Array<Record<string, unknown>>;
};

const MATCH_FIELDS = [
  "match_date", "start_time", "meeting_time_enabled", "meeting_time",
  "departure_time_enabled", "departure_time", "field_option_id", "locker_room_option_id",
  "visitor_locker_room_option_id", "referee_option_id", "meeting_place_option_id",
  "meeting_place_custom", "match_format", "match_period_count", "match_period_minutes"
] as const;

export function selectionFingerprint({ match, selections }: MatchSelectionSnapshot) {
  const matchValues = Object.fromEntries(MATCH_FIELDS.map(field => [field, match[field] ?? null]));
  const selectionValues = selections.map(selection => ({
    player_id: selection.player_id,
    selected: selection.selected === true,
    jersey_number: selection.jersey_number ?? null,
    non_selection_reason_id: selection.non_selection_reason_id ?? null,
    individual_attention_point: selection.individual_attention_point ?? null
  })).sort((a, b) => String(a.player_id).localeCompare(String(b.player_id)));
  return createHash("sha256").update(JSON.stringify({ match: matchValues, selections: selectionValues })).digest("hex");
}
