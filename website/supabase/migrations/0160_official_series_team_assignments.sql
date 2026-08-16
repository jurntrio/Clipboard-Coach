create table if not exists public.club_official_series_assignments (
  id uuid primary key default gen_random_uuid(),
  club_id uuid not null references public.clubs(id) on delete cascade,
  season_id uuid not null references public.club_seasons(id) on delete cascade,
  division_code text not null,
  club_team_id uuid not null references public.club_teams(id) on delete cascade,
  approved_by uuid references public.profiles(id) on delete set null,
  approved_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (club_id, season_id, division_code)
);

create index if not exists club_official_series_assignments_team_idx
  on public.club_official_series_assignments(club_team_id);

comment on table public.club_official_series_assignments is
  'Definitive club-admin mapping from an official RBFA DIV code to a club team for one season.';

alter table public.club_official_series_assignments enable row level security;
revoke all on public.club_official_series_assignments from public, anon, authenticated;

notify pgrst, 'reload schema';
