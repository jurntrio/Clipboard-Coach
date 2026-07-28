alter table public.clip_segments
  add column if not exists render_status text not null default 'pending',
  add column if not exists rendered_segment jsonb,
  add column if not exists render_error text,
  add column if not exists render_attempts integer not null default 0,
  add column if not exists render_started_at timestamp with time zone,
  add column if not exists render_completed_at timestamp with time zone;

alter table public.clip_segments
  drop constraint if exists clip_segments_render_status_check;

alter table public.clip_segments
  add constraint clip_segments_render_status_check
  check (render_status in ('pending', 'rendering', 'ready', 'failed'));

update public.clip_segments cs
set
  render_status = 'ready',
  rendered_segment = rendered.segment,
  render_completed_at = coalesce(render_completed_at, now())
from (
  select
    c.id as clip_id,
    value as segment,
    (value->>'sequence_order')::integer as sequence_order
  from public.clips c
  cross join lateral jsonb_array_elements(c.rendered_segments) value
  where c.render_status = 'ready'
    and value ? 'sequence_order'
) rendered
where cs.clip_id = rendered.clip_id
  and cs.sequence_order = rendered.sequence_order;

notify pgrst, 'reload schema';
