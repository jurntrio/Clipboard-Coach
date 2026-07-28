-- Support matches recorded by multiple synchronized cameras (e.g. KM Torhout's 7-camera
-- external recording system) and clip segments sourced from a specific camera angle.

-- Which physical camera (1-7) this video row represents. Null for ordinary uploads/local files.
alter table public.videos
  add column if not exists camera_number int;

-- Multiple match_videos rows can now share a sequence_order (same synchronized time block,
-- different camera angles). Exactly one row per block stays "primary" and drives the match
-- timeline/offset math; the rest are alternate camera angles of the same moment.
alter table public.match_videos
  add column if not exists is_primary boolean not null default true;

alter table public.match_videos
  drop constraint if exists match_videos_match_id_sequence_order_key;

create unique index if not exists match_videos_primary_per_block
  on public.match_videos (match_id, sequence_order)
  where is_primary;

-- Which camera's video a clip segment should play/render from. Null keeps the existing
-- behavior of falling back to the segment's tag's own video.
alter table public.clip_segments
  add column if not exists video_id uuid references public.videos(id) on delete cascade;

create index if not exists idx_clip_segments_video_id on public.clip_segments(video_id);
create index if not exists idx_match_videos_sequence_order on public.match_videos(match_id, sequence_order);

notify pgrst, 'reload schema';
