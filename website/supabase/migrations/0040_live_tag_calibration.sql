-- The recording's real start time (wall clock) is the true anchor for turning a live-tagged
-- moment's timestamp into a position in the video - the scheduled kickoff time is only an
-- estimate and the camera is almost never started at exactly that instant.
alter table public.matches
  add column if not exists recording_start_time time;

-- Small per-match fine-tune on top of that (e.g. average delay between an event happening and
-- someone reaching their phone to tag it), settable by anchoring one known live tag to its true
-- position in the video.
alter table public.matches
  add column if not exists live_tag_offset_seconds numeric not null default 0;

notify pgrst, 'reload schema';
