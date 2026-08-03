create table if not exists public.player_groups (
  id uuid primary key default gen_random_uuid(),
  club_id uuid not null references public.clubs(id) on delete cascade,
  name text not null,
  group_type text not null check (group_type in (
    'goalkeeper_training', 'technique_training', 'talent_development', 'position_training',
    'physical_training', 'rehabilitation', 'selection_group', 'other'
  )),
  description text,
  age_category text,
  icon text,
  active boolean not null default true,
  created_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (club_id, name)
);

create trigger trg_player_groups_updated_at before update on public.player_groups
for each row execute function public.set_updated_at();
create index if not exists player_groups_club_active_idx on public.player_groups(club_id, active, name);

create table if not exists public.player_group_players (
  group_id uuid not null references public.player_groups(id) on delete cascade,
  player_id uuid not null references public.players(id) on delete cascade,
  added_at timestamptz not null default now(),
  added_by uuid references public.profiles(id) on delete set null,
  primary key (group_id, player_id)
);
create index if not exists player_group_players_player_idx on public.player_group_players(player_id);

create table if not exists public.player_group_staff (
  group_id uuid not null references public.player_groups(id) on delete cascade,
  trainer_id uuid not null references public.club_trainers(id) on delete cascade,
  role_label text,
  added_at timestamptz not null default now(),
  added_by uuid references public.profiles(id) on delete set null,
  primary key (group_id, trainer_id)
);
create index if not exists player_group_staff_trainer_idx on public.player_group_staff(trainer_id);

create or replace function public.enforce_player_group_club_match()
returns trigger language plpgsql set search_path = public as $$
declare group_club uuid; member_club uuid;
begin
  select club_id into group_club from public.player_groups where id = new.group_id;
  if tg_table_name = 'player_group_players' then
    select club_team.club_id into member_club
    from public.players player join public.teams team on team.id = player.team_id
    join public.club_teams club_team on club_team.id = team.club_team_id
    where player.id = new.player_id;
  else
    select club_id into member_club from public.club_trainers where id = new.trainer_id;
  end if;
  if group_club is null or member_club is null or group_club <> member_club then
    raise exception 'PLAYER_GROUP_CLUB_MISMATCH';
  end if;
  return new;
end;
$$;
create trigger trg_player_group_player_club before insert or update on public.player_group_players
for each row execute function public.enforce_player_group_club_match();
create trigger trg_player_group_staff_club before insert or update on public.player_group_staff
for each row execute function public.enforce_player_group_club_match();

alter table public.team_training_sessions alter column club_team_id drop not null;
alter table public.team_training_sessions add column if not exists player_group_id uuid references public.player_groups(id) on delete cascade;
alter table public.team_training_sessions drop constraint if exists team_training_sessions_club_team_id_training_date_start_time_key;
alter table public.team_training_sessions drop constraint if exists team_training_sessions_single_target_check;
alter table public.team_training_sessions add constraint team_training_sessions_single_target_check
  check (num_nonnulls(club_team_id, player_group_id) = 1);
create unique index if not exists team_training_sessions_team_time_unique
  on public.team_training_sessions(club_team_id, training_date, start_time) where club_team_id is not null;
create unique index if not exists team_training_sessions_group_time_unique
  on public.team_training_sessions(player_group_id, training_date, start_time) where player_group_id is not null;
create index if not exists team_training_sessions_group_date_idx
  on public.team_training_sessions(player_group_id, training_date) where player_group_id is not null;

create table if not exists public.player_group_evaluation_criteria (
  id uuid primary key default gen_random_uuid(),
  group_id uuid not null references public.player_groups(id) on delete cascade,
  name text not null,
  description text,
  sort_order integer not null default 0,
  active boolean not null default true,
  created_at timestamptz not null default now(),
  unique (group_id, name)
);

create table if not exists public.player_group_evaluations (
  id uuid primary key default gen_random_uuid(),
  group_id uuid not null references public.player_groups(id) on delete cascade,
  criterion_id uuid not null references public.player_group_evaluation_criteria(id) on delete cascade,
  player_id uuid not null references public.players(id) on delete cascade,
  training_session_id uuid references public.team_training_sessions(id) on delete set null,
  evaluator_id uuid not null references public.profiles(id) on delete restrict,
  score smallint not null check (score between 1 and 5),
  note text,
  evaluated_at timestamptz not null default now(),
  unique (group_id, criterion_id, player_id, training_session_id)
);
create index if not exists player_group_evaluations_player_idx on public.player_group_evaluations(player_id, evaluated_at desc);
create index if not exists player_group_evaluations_group_idx on public.player_group_evaluations(group_id, evaluated_at desc);

alter table public.player_groups enable row level security;
alter table public.player_group_players enable row level security;
alter table public.player_group_staff enable row level security;
alter table public.player_group_evaluation_criteria enable row level security;
alter table public.player_group_evaluations enable row level security;
revoke all on public.player_groups, public.player_group_players, public.player_group_staff,
  public.player_group_evaluation_criteria, public.player_group_evaluations from anon, authenticated;

notify pgrst, 'reload schema';
