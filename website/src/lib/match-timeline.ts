import type { LiveMatchTag, Match } from "@/types/database";

// The video timeline's x-axis is real wall-clock seconds since match start:
// each recorded block sits at its true recording offset, with gaps preserved
// where no camera was rolling. Live tags are timestamped in that same
// wall-clock time, so both must anchor to the same start instant. Prefer
// recording_start_time (set when the coach recorded the match start moment)
// but fall back to the scheduled start_time - most matches never get
// recording_start_time filled in manually.
export function matchTimelineStartMs(match: Pick<Match, "match_date" | "recording_start_time" | "start_time"> | null) {
  if (!match?.match_date) return null;
  const time = match.recording_start_time || match.start_time;
  if (!time) return null;
  const date = new Date(`${match.match_date}T${time}`);
  return Number.isNaN(date.getTime()) ? null : date.getTime();
}

export function liveTagVideoSeconds(liveTag: LiveMatchTag, match: Match) {
  const recordingStartedAtMs = matchTimelineStartMs(match);
  if (recordingStartedAtMs === null) return null;
  const seconds = (new Date(liveTag.occurred_at).getTime() - recordingStartedAtMs) / 1000;
  return Math.max(0, seconds + (match.live_tag_offset_seconds ?? 0));
}
