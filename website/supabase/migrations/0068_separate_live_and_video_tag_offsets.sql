alter table public.standard_tags
  add column if not exists live_start_offset_seconds numeric,
  add column if not exists live_end_offset_seconds numeric,
  add column if not exists video_start_offset_seconds numeric,
  add column if not exists video_end_offset_seconds numeric;

update public.standard_tags
set
  live_start_offset_seconds = coalesce(live_start_offset_seconds, start_offset_seconds),
  live_end_offset_seconds = coalesce(live_end_offset_seconds, end_offset_seconds),
  video_start_offset_seconds = coalesce(video_start_offset_seconds, start_offset_seconds),
  video_end_offset_seconds = coalesce(video_end_offset_seconds, end_offset_seconds)
where live_start_offset_seconds is null
   or live_end_offset_seconds is null
   or video_start_offset_seconds is null
   or video_end_offset_seconds is null;

alter table public.standard_tags
  alter column live_start_offset_seconds set default -5,
  alter column live_start_offset_seconds set not null,
  alter column live_end_offset_seconds set default 5,
  alter column live_end_offset_seconds set not null,
  alter column video_start_offset_seconds set default 0,
  alter column video_start_offset_seconds set not null,
  alter column video_end_offset_seconds set default 5,
  alter column video_end_offset_seconds set not null;

notify pgrst, 'reload schema';
