import { createClient } from "@supabase/supabase-js";
import { performance } from "node:perf_hooks";

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!url || !key) throw new Error("Supabase benchmark environment is incomplete.");
const db = createClient(url, key, { auth: { persistSession: false } });
const bytes = (value) => Buffer.byteLength(JSON.stringify(value));
const timed = async (work) => {
  const start = performance.now();
  const result = await work();
  return { result, ms: performance.now() - start };
};
const unwrap = ({ data, error }) => {
  if (error) throw error;
  return data ?? [];
};

const allMatches = unwrap(await db.from("matches").select("id, club_id"));
const counts = new Map();
for (const match of allMatches) if (match.club_id) counts.set(match.club_id, (counts.get(match.club_id) ?? 0) + 1);
const clubId = [...counts.entries()].sort((a, b) => b[1] - a[1])[0]?.[0];
if (!clubId) throw new Error("No club with matches was found.");

const today = new Date().toISOString().slice(0, 10);
const columns = "id, coach_id, team_a_id, team_a_name, team_b_name, team_a_belgian_club_id, team_b_belgian_club_id, match_date, start_time, status, score_a, score_b, player_ids, live_tag_names, club_team_id, external_source, is_home_match, meeting_time_enabled, meeting_time, field_option_id, locker_room_option_id, visitor_locker_room_option_id, referee_option_id, official_referee_name, official_assistant_referee_1_name, official_assistant_referee_2_name, meeting_place_option_id, meeting_place_custom, match_videos(video_id)";
const visibleSourceFilter = "external_source.is.null,external_source.not.in.(foot24,voetbal_vlaanderen)";

const oldRun = await timed(async () => unwrap(await db.from("matches").select("*, match_videos(video_id)").eq("club_id", clubId).order("match_date")));
const projectedRun = await timed(async () => unwrap(await db.from("matches").select(columns).eq("club_id", clubId).order("match_date")));
const newRun = await timed(async () => {
  const [upcoming, finished] = await Promise.all([
    db.from("matches").select(columns).eq("club_id", clubId).or(visibleSourceFilter).neq("status", "finished").or(`match_date.is.null,match_date.gte.${today}`).order("match_date").limit(21),
    db.from("matches").select(columns).eq("club_id", clubId).or(visibleSourceFilter).or(`status.eq.finished,match_date.lt.${today}`).order("match_date", { ascending: false }).limit(21)
  ]);
  return [...unwrap(upcoming), ...unwrap(finished).slice(0, 20)];
});
const indexFriendlyRun = await timed(async () => {
  const [datedUpcoming, undatedUpcoming, historical, finishedToday] = await Promise.all([
    db.from("matches").select(columns).eq("club_id", clubId).gte("match_date", today).neq("status", "finished").order("match_date").order("start_time").limit(21),
    db.from("matches").select(columns).eq("club_id", clubId).is("match_date", null).neq("status", "finished").limit(21),
    db.from("matches").select(columns).eq("club_id", clubId).lt("match_date", today).order("match_date", { ascending: false }).order("start_time", { ascending: false }).limit(21),
    db.from("matches").select(columns).eq("club_id", clubId).eq("match_date", today).eq("status", "finished").limit(21)
  ]);
  return [...unwrap(datedUpcoming), ...unwrap(undatedUpcoming), ...unwrap(historical), ...unwrap(finishedToday)].slice(0, 42);
});

const sampleClipIds = unwrap(await db.from("clips").select("id").limit(10)).map((clip) => clip.id);
const oldPoll = await timed(async () => unwrap(await db.from("clips").select("id, coach_id, video_id, name, display_number, render_status, created_at, audience_type, audience_player_ids, rendered_segments, share_links(token, short_code, view_count), videos(title, video_url), clip_segments(id, sequence_order, video_id, render_status, videos(video_url), tags(id, name, color, start_time, end_time, player_ids))").in("id", sampleClipIds)));
const newPoll = await timed(async () => unwrap(await db.from("clips").select("id, render_status, clip_segments(id, render_status)").in("id", sampleClipIds)));

const oldBytes = bytes(oldRun.result);
const newBytes = bytes(newRun.result);
const oldPollBytes = bytes(oldPoll.result);
const newPollBytes = bytes(newPoll.result);
console.log(JSON.stringify({
  dataset: { matches: oldRun.result.length, sampledClips: sampleClipIds.length },
  initialHub: {
    before: { bytes: oldBytes, queryMs: Math.round(oldRun.ms) },
    projectedSingleQuery: { bytes: bytes(projectedRun.result), queryMs: Math.round(projectedRun.ms) },
    indexFriendlyQueries: { bytes: bytes(indexFriendlyRun.result), queryMs: Math.round(indexFriendlyRun.ms) },
    after: { bytes: newBytes, queryMs: Math.round(newRun.ms) },
    byteReductionPercent: Math.round((1 - newBytes / Math.max(oldBytes, 1)) * 100)
  },
  processingPoll: {
    before: { bytes: oldPollBytes, queryMs: Math.round(oldPoll.ms), requestsPerMinute: 20 },
    after: { bytes: newPollBytes, queryMs: Math.round(newPoll.ms), steadyStateRequestsPerMinute: 6 },
    byteReductionPercent: Math.round((1 - newPollBytes / Math.max(oldPollBytes, 1)) * 100)
  }
}, null, 2));
