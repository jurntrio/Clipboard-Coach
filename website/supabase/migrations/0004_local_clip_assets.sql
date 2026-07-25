-- Rendered clip files created from local match videos. The full match never
-- leaves the coach's device; only these small, shareable MP4 segments do.
alter table public.clips
  add column if not exists rendered_segments jsonb not null default '[]'::jsonb,
  add column if not exists render_status text not null default 'metadata_only',
  add column if not exists render_error text;

alter table public.clips
  drop constraint if exists clips_render_status_check;

alter table public.clips
  add constraint clips_render_status_check
  check (render_status in ('metadata_only', 'rendering', 'ready', 'failed'));
