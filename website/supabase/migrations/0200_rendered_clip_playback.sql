alter table public.clips
  add column if not exists rendered_clip jsonb;
