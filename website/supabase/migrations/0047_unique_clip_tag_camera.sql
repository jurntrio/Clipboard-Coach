-- A tag may intentionally appear for several cameras, but never more than once
-- for the same camera inside one clip.
create unique index if not exists clip_segments_unique_tag_camera
  on public.clip_segments (clip_id, tag_id, video_id);
