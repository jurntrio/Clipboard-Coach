-- Store the real-world start time for each video source attached to a match.
-- This lets the match viewer preserve gaps between separately recorded clips.
alter table public.match_videos
  add column if not exists recording_started_at timestamp with time zone;

create index if not exists idx_match_videos_recording_started_at
  on public.match_videos(match_id, recording_started_at)
  where recording_started_at is not null;

notify pgrst, 'reload schema';
