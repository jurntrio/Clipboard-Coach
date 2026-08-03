-- Reusable club sponsor scopes with season-specific team membership.

create table public.sponsor_scopes (
  id uuid primary key default gen_random_uuid(),
  club_id uuid not null references public.clubs(id) on delete cascade,
  name text not null check (trim(name) <> ''),
  is_clubwide boolean not null default false,
  active boolean not null default true,
  display_order integer not null default 0,
  created_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now())
);
create unique index sponsor_scopes_club_name_unique on public.sponsor_scopes(club_id, lower(trim(name)));
create unique index sponsor_scopes_one_clubwide_idx on public.sponsor_scopes(club_id) where is_clubwide and active;

create table public.sponsor_scope_teams (
  scope_id uuid not null references public.sponsor_scopes(id) on delete cascade,
  club_id uuid not null references public.clubs(id) on delete cascade,
  season_id uuid not null references public.club_seasons(id) on delete restrict,
  club_team_id uuid not null references public.club_teams(id) on delete restrict,
  show_home_matches_commercially boolean not null default false,
  created_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default timezone('utc', now()),
  primary key (scope_id, season_id, club_team_id)
);
create index sponsor_scope_teams_team_idx on public.sponsor_scope_teams(club_id, season_id, club_team_id);

create table public.sponsor_assignment_scopes (
  assignment_id uuid not null references public.sponsor_assignments(id) on delete cascade,
  scope_id uuid not null references public.sponsor_scopes(id) on delete restrict,
  created_at timestamptz not null default timezone('utc', now()),
  primary key (assignment_id, scope_id)
);

create or replace function public.enforce_sponsor_scope_team_context()
returns trigger language plpgsql set search_path = public as $$
declare scope_club uuid; season_club uuid; team_club uuid; team_season uuid; clubwide boolean;
begin
  select club_id, is_clubwide into scope_club, clubwide from public.sponsor_scopes where id = new.scope_id;
  select club_id into season_club from public.club_seasons where id = new.season_id;
  select club_id, season_id into team_club, team_season from public.club_teams where id = new.club_team_id;
  if scope_club is null or scope_club <> new.club_id or season_club <> new.club_id or team_club <> new.club_id then
    raise exception 'SPONSOR_SCOPE_CLUB_MISMATCH';
  end if;
  if team_season is distinct from new.season_id then raise exception 'SPONSOR_SCOPE_TEAM_SEASON_MISMATCH'; end if;
  if clubwide then raise exception 'CLUBWIDE_SCOPE_HAS_NO_TEAM_MEMBERS'; end if;
  return new;
end;
$$;
create trigger trg_sponsor_scope_team_context before insert or update on public.sponsor_scope_teams
for each row execute function public.enforce_sponsor_scope_team_context();

create or replace function public.enforce_sponsor_assignment_scope_context()
returns trigger language plpgsql set search_path = public as $$
declare assignment_club uuid; scope_club uuid;
begin
  select club_id into assignment_club from public.sponsor_assignments where id = new.assignment_id;
  select club_id into scope_club from public.sponsor_scopes where id = new.scope_id;
  if assignment_club is null or scope_club is null or assignment_club <> scope_club then
    raise exception 'SPONSOR_ASSIGNMENT_SCOPE_CLUB_MISMATCH';
  end if;
  return new;
end;
$$;
create trigger trg_sponsor_assignment_scope_context before insert or update on public.sponsor_assignment_scopes
for each row execute function public.enforce_sponsor_assignment_scope_context();

create trigger trg_sponsor_scopes_updated_at before update on public.sponsor_scopes
for each row execute function public.set_updated_at();

alter table public.sponsor_scopes enable row level security;
alter table public.sponsor_scope_teams enable row level security;
alter table public.sponsor_assignment_scopes enable row level security;

notify pgrst, 'reload schema';


