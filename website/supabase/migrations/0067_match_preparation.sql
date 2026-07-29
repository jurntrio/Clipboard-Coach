create table if not exists public.club_match_options (
  id uuid default gen_random_uuid() primary key,
  club_id uuid references public.clubs(id) on delete cascade not null,
  option_type text not null check (option_type in ('field', 'locker_room', 'meeting_place', 'non_selection_reason')),
  label text not null,
  active boolean not null default true,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null,
  unique (club_id, option_type, label)
);

alter table public.matches
  add column if not exists is_home_match boolean not null default true,
  add column if not exists meeting_time_enabled boolean not null default false,
  add column if not exists meeting_time time,
  add column if not exists departure_time_enabled boolean not null default false,
  add column if not exists departure_time time,
  add column if not exists field_option_id uuid references public.club_match_options(id) on delete set null,
  add column if not exists locker_room_option_id uuid references public.club_match_options(id) on delete set null,
  add column if not exists meeting_place_option_id uuid references public.club_match_options(id) on delete set null,
  add column if not exists meeting_place_custom text;

create table if not exists public.match_player_selections (
  match_id uuid references public.matches(id) on delete cascade not null,
  player_id uuid references public.players(id) on delete cascade not null,
  selected boolean not null default true,
  jersey_number integer check (jersey_number is null or jersey_number between 0 and 99),
  non_selection_reason_id uuid references public.club_match_options(id) on delete set null,
  note text,
  updated_at timestamp with time zone default timezone('utc'::text, now()) not null,
  primary key (match_id, player_id)
);

alter table public.club_match_options enable row level security;
alter table public.match_player_selections enable row level security;
revoke all on public.club_match_options from anon, authenticated;
revoke all on public.match_player_selections from anon, authenticated;

insert into public.club_match_options (club_id, option_type, label)
select id, 'meeting_place', 'Kleedkamer' from public.clubs
on conflict do nothing;

insert into public.club_match_options (club_id, option_type, label)
select club.id, 'non_selection_reason', reason
from public.clubs club
cross join unnest(array['Gekwetst', 'Niet getraind', 'Disciplinair geschorst']) reason
on conflict do nothing;

create index if not exists idx_club_match_options_club_type on public.club_match_options(club_id, option_type, active);
create index if not exists idx_match_player_selections_match on public.match_player_selections(match_id);
notify pgrst, 'reload schema';
