-- Persist drawing freeze-frames with the tag they belong to. The PNG itself
-- lives in R2; this JSON only stores playback and asset metadata.
alter table public.tags
  add column if not exists drawings jsonb not null default '[]'::jsonb;

alter table public.tags
  add constraint tags_drawings_is_array
  check (jsonb_typeof(drawings) = 'array');
