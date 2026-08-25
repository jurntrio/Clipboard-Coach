create table if not exists public.club_live_tag_templates (
  id uuid primary key default gen_random_uuid(),
  club_id uuid not null references public.clubs(id) on delete cascade,
  name text not null check (char_length(trim(name)) between 1 and 60),
  live_start_offset_seconds numeric not null default -5,
  live_end_offset_seconds numeric not null default 5,
  display_order integer not null default 0,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now()),
  unique (club_id, name),
  check (live_start_offset_seconds between -180 and 180),
  check (live_end_offset_seconds between -180 and 180),
  check (live_end_offset_seconds >= live_start_offset_seconds)
);

alter table public.club_live_tag_templates enable row level security;
revoke all on public.club_live_tag_templates from public, anon, authenticated;

insert into public.club_live_tag_templates (club_id, name, display_order)
select club.id, tag.name, tag.display_order
from public.clubs club
cross join (values
  ('Goal Thuis', 0),
  ('Goal Uit', 1),
  ('Hoekschop Voor', 2),
  ('Hoekschop Tegen', 3),
  ('Vrije Trap Voor', 4),
  ('Vrije Trap Tegen', 5)
) as tag(name, display_order)
on conflict (club_id, name) do nothing;

update public.matches match
set live_tag_names = array(
  select template.name
  from public.club_live_tag_templates template
  where template.club_id = match.club_id
  order by template.display_order, template.created_at
)
where match.club_id is not null
  and coalesce(array_length(match.live_tag_names, 1), 0) = 0;

notify pgrst, 'reload schema';
