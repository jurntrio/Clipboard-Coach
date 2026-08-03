-- Generic, prepared season transitions. Additive compatibility layer over the
-- club_seasons/player_team_memberships identity model introduced in 0030.

alter table public.club_seasons
  add column if not exists status text,
  add column if not exists preparation_started_at timestamptz,
  add column if not exists activation_at timestamptz,
  add column if not exists archived_at timestamptz,
  add column if not exists trainers_visible_from timestamptz;
update public.club_seasons set status = case when is_active then 'ACTIVE' else 'ARCHIVED' end where status is null;
alter table public.club_seasons alter column status set default 'PREPARATION';
alter table public.club_seasons alter column status set not null;
alter table public.club_seasons drop constraint if exists club_seasons_status_check;
alter table public.club_seasons add constraint club_seasons_status_check check (status in ('PREPARATION','ACTIVE','ARCHIVED'));
create unique index if not exists club_seasons_one_active_status_idx on public.club_seasons(club_id) where status = 'ACTIVE';

alter table public.clubs add column if not exists timezone text not null default 'UTC';
alter table public.club_teams add column if not exists season_id uuid references public.club_seasons(id) on delete restrict;
alter table public.club_teams add column if not exists copied_from_team_id uuid references public.club_teams(id) on delete set null;
create index if not exists club_teams_season_idx on public.club_teams(club_id, season_id, display_order);
drop index if exists public.club_teams_active_name_unique;
create unique index if not exists club_teams_season_name_idx on public.club_teams(club_id, season_id, lower(name)) where status <> 'merged';

alter table public.club_trainer_teams add column if not exists season_id uuid references public.club_seasons(id) on delete restrict;
create index if not exists club_trainer_teams_season_idx on public.club_trainer_teams(season_id, club_team_id);
alter table public.player_groups add column if not exists season_id uuid references public.club_seasons(id) on delete restrict;
alter table public.player_groups add column if not exists copied_from_group_id uuid references public.player_groups(id) on delete set null;
alter table public.player_groups drop constraint if exists player_groups_club_id_name_key;
create unique index if not exists player_groups_season_name_idx on public.player_groups(club_id, season_id, lower(name));

alter table public.team_training_sessions add column if not exists season_id uuid references public.club_seasons(id) on delete restrict;
alter table public.matches add column if not exists season_id uuid references public.club_seasons(id) on delete restrict;
alter table public.player_group_evaluations add column if not exists season_id uuid references public.club_seasons(id) on delete restrict;
create index if not exists training_sessions_season_idx on public.team_training_sessions(season_id, training_date);
create index if not exists matches_season_idx on public.matches(season_id, match_date);
create index if not exists group_evaluations_season_idx on public.player_group_evaluations(season_id, evaluated_at);

-- The requested safe baseline: existing club data belongs to 2026-2027. Existing
-- custom seasons are retained; only clubs without this baseline get a new row.
insert into public.club_seasons (club_id, name, starts_on, ends_on, is_active, status, activation_at)
select club.id, '2026-2027', date '2026-07-01', date '2027-06-30', false, 'PREPARATION', null
from public.clubs club
where not exists (select 1 from public.club_seasons season where season.club_id = club.id and season.name = '2026-2027');

-- Prefer an already-active season, otherwise activate the baseline without deleting history.
update public.club_seasons season set is_active = true, status = 'ACTIVE', activation_at = coalesce(activation_at, now())
where season.name = '2026-2027'
  and not exists (select 1 from public.club_seasons other where other.club_id = season.club_id and other.is_active);
update public.club_seasons set status = 'ACTIVE' where is_active and status <> 'ACTIVE';

update public.club_teams team set season_id = season.id
from public.club_seasons season where season.club_id = team.club_id and season.is_active and team.season_id is null;
update public.club_trainer_teams assignment set season_id = team.season_id
from public.club_teams team where team.id = assignment.club_team_id and assignment.season_id is null;
update public.player_groups group_row set season_id = season.id
from public.club_seasons season where season.club_id = group_row.club_id and season.is_active and group_row.season_id is null;
update public.matches match_row set season_id = season.id
from public.club_seasons season where season.club_id = match_row.club_id and season.is_active and match_row.season_id is null;
update public.team_training_sessions session set season_id = team.season_id
from public.club_teams team where team.id = session.club_team_id and session.season_id is null;
update public.team_training_sessions session set season_id = group_row.season_id
from public.player_groups group_row where group_row.id = session.player_group_id and session.season_id is null;
update public.player_group_evaluations evaluation set season_id = group_row.season_id
from public.player_groups group_row where group_row.id = evaluation.group_id and evaluation.season_id is null;

alter table public.club_teams alter column season_id set not null;
alter table public.club_trainer_teams alter column season_id set not null;
alter table public.player_groups alter column season_id set not null;

-- Complete the existing idempotent player identity backfill now that every club has a baseline.
select public.backfill_club_players_from_players();

-- Keep legacy callers consistent with the richer status model.
create or replace function public.set_active_club_season(target_club_id uuid, target_season_id uuid)
returns void language plpgsql as $$
begin
  update public.club_seasons set is_active=false,status='ARCHIVED',archived_at=coalesce(archived_at,now())
    where club_id=target_club_id and id<>target_season_id and (is_active or status='ACTIVE');
  update public.club_seasons set is_active=true,status='ACTIVE',activation_at=coalesce(activation_at,now()),archived_at=null
    where id=target_season_id and club_id=target_club_id;
  if not found then raise exception 'SEASON_NOT_FOUND_FOR_CLUB'; end if;
end $$;

create table if not exists public.season_team_pathways (
  source_team_id uuid not null references public.club_teams(id) on delete cascade,
  target_team_id uuid not null references public.club_teams(id) on delete cascade,
  priority smallint not null default 0,
  primary key (source_team_id, target_team_id),
  check (source_team_id <> target_team_id)
);

create table if not exists public.season_player_decisions (
  id uuid primary key default gen_random_uuid(), club_id uuid not null references public.clubs(id) on delete cascade,
  season_id uuid not null references public.club_seasons(id) on delete cascade,
  club_player_id uuid not null references public.club_players(id) on delete cascade,
  decision text not null check (decision in ('TEAM','UNDECIDED','LEAVING')),
  membership_id uuid references public.player_team_memberships(id) on delete set null,
  updated_by uuid references public.profiles(id) on delete set null, updated_at timestamptz not null default now(),
  unique (season_id, club_player_id),
  check ((decision = 'TEAM') = (membership_id is not null))
);

create table if not exists public.season_activation_slots (
  id uuid primary key default gen_random_uuid(), starts_at timestamptz not null unique,
  capacity integer not null default 5 check (capacity > 0), closes_at timestamptz not null,
  created_at timestamptz not null default now()
);
create table if not exists public.season_transition_reservations (
  id uuid primary key default gen_random_uuid(), club_id uuid not null references public.clubs(id) on delete cascade,
  season_id uuid not null references public.club_seasons(id) on delete cascade,
  slot_id uuid not null references public.season_activation_slots(id) on delete restrict,
  status text not null default 'SCHEDULED' check (status in ('SCHEDULED','RUNNING','COMPLETED','CANCELLED','FAILED')),
  created_by uuid references public.profiles(id) on delete set null, created_at timestamptz not null default now(), updated_at timestamptz not null default now()
);
create unique index if not exists season_reservation_one_live_idx on public.season_transition_reservations(club_id, season_id) where status in ('SCHEDULED','RUNNING');

create table if not exists public.season_transition_runs (
  id uuid primary key default gen_random_uuid(), club_id uuid not null references public.clubs(id) on delete cascade,
  season_id uuid not null references public.club_seasons(id) on delete restrict,
  status text not null check (status in ('RUNNING','COMPLETED','FAILED')),
  trigger_source text not null check (trigger_source in ('MANUAL','SCHEDULED')),
  checks jsonb not null default '[]', error_message text, started_at timestamptz not null default now(), completed_at timestamptz,
  check (completed_at is null or completed_at >= started_at)
);

create or replace function public.prepare_club_season(
  target_club_id uuid, season_name text, starts_on date, ends_on date,
  source_season_id uuid default null, copy_groups boolean default true
) returns uuid language plpgsql security definer set search_path = public as $$
declare new_season_id uuid; source_team record; new_club_team_id uuid;
begin
  if not public.is_active_club_admin(target_club_id, auth.uid()) then raise exception 'SEASON_PREPARE_FORBIDDEN'; end if;
  if trim(season_name) = '' or starts_on > ends_on then raise exception 'INVALID_SEASON'; end if;
  insert into public.club_seasons(club_id,name,starts_on,ends_on,is_active,status,preparation_started_at)
  values(target_club_id,trim(season_name),starts_on,ends_on,false,'PREPARATION',now()) returning id into new_season_id;
  for source_team in select * from public.club_teams where club_id=target_club_id and season_id=source_season_id and status <> 'merged' loop
    insert into public.club_teams(club_id,name,status,display_order,trainers_can_edit_roster,trainers_can_manage_matches,season_id,copied_from_team_id)
    values(target_club_id,source_team.name,'active',source_team.display_order,source_team.trainers_can_edit_roster,source_team.trainers_can_manage_matches,new_season_id,source_team.id)
    returning id into new_club_team_id;
    insert into public.teams(coach_id,name,club_name,club_team_id)
    select null, source_team.name, club.name, new_club_team_id from public.clubs club where club.id=target_club_id;
  end loop;
  if copy_groups then
    insert into public.player_groups(club_id,name,group_type,description,icon,active,created_by,season_id,copied_from_group_id)
    select club_id,name,group_type,description,icon,true,auth.uid(),new_season_id,id from public.player_groups
    where club_id=target_club_id and season_id=source_season_id;
  end if;
  return new_season_id;
end $$;

create or replace function public.season_preflight(target_club_id uuid, target_season_id uuid)
returns jsonb language plpgsql stable security definer set search_path=public as $$
declare result jsonb := '[]'; team_count int; undecided int; unstaffed int;
begin
  if not public.is_active_club_admin(target_club_id, auth.uid()) then raise exception 'SEASON_VIEW_FORBIDDEN'; end if;
  if not exists(select 1 from public.club_seasons where id=target_season_id and club_id=target_club_id and status='PREPARATION') then
    result := result || jsonb_build_object('level','ERROR','code','INVALID_TARGET','message','Doelseizoen bestaat niet of is niet in voorbereiding.');
  end if;
  select count(*) into team_count from public.club_teams where club_id=target_club_id and season_id=target_season_id and status <> 'merged';
  if team_count=0 then result := result || jsonb_build_object('level','ERROR','code','NO_TEAMS','message','Geen teams voorbereid.'); end if;
  select count(*) into undecided from public.season_player_decisions where club_id=target_club_id and season_id=target_season_id and decision='UNDECIDED';
  if undecided>0 then result := result || jsonb_build_object('level','WARNING','code','UNDECIDED_PLAYERS','message',undecided||' spelers zijn nog te verdelen.'); end if;
  select count(*) into unstaffed from public.club_teams team where team.club_id=target_club_id and team.season_id=target_season_id and team.status<>'merged'
    and not exists(select 1 from public.club_trainer_teams staff where staff.club_team_id=team.id and staff.season_id=target_season_id and staff.status='active');
  if unstaffed>0 then result := result || jsonb_build_object('level','WARNING','code','UNSTAFFED_TEAMS','message',unstaffed||' teams hebben geen trainer.'); end if;
  return result;
end $$;

create or replace function public.activate_club_season(target_club_id uuid,target_season_id uuid,source text default 'MANUAL')
returns jsonb language plpgsql security definer set search_path=public as $$
declare checks jsonb; run_id uuid;
begin
  if not public.is_active_club_admin(target_club_id,auth.uid()) then raise exception 'SEASON_ACTIVATE_FORBIDDEN'; end if;
  perform pg_advisory_xact_lock(hashtextextended(target_club_id::text,0));
  if exists(select 1 from public.club_seasons where id=target_season_id and club_id=target_club_id and status='ACTIVE') then return jsonb_build_object('status','COMPLETED','idempotent',true); end if;
  checks := public.season_preflight(target_club_id,target_season_id);
  if exists(select 1 from jsonb_array_elements(checks) item where item->>'level'='ERROR') then return jsonb_build_object('status','BLOCKED','checks',checks); end if;
  insert into public.season_transition_runs(club_id,season_id,status,trigger_source,checks) values(target_club_id,target_season_id,'RUNNING',source,checks) returning id into run_id;
  update public.club_seasons set is_active=false,status='ARCHIVED',archived_at=coalesce(archived_at,now()) where club_id=target_club_id and status='ACTIVE' and id<>target_season_id;
  update public.club_seasons set is_active=true,status='ACTIVE',activation_at=coalesce(activation_at,now()),archived_at=null where id=target_season_id and club_id=target_club_id;
  update public.season_transition_runs set status='COMPLETED',completed_at=now() where id=run_id;
  return jsonb_build_object('status','COMPLETED','idempotent',false,'checks',checks,'runId',run_id);
exception when others then
  if run_id is not null then update public.season_transition_runs set status='FAILED',error_message=sqlerrm,completed_at=now() where id=run_id; end if;
  raise;
end $$;

alter table public.season_team_pathways enable row level security;
alter table public.season_player_decisions enable row level security;
alter table public.season_activation_slots enable row level security;
alter table public.season_transition_reservations enable row level security;
alter table public.season_transition_runs enable row level security;
revoke all on public.season_team_pathways, public.season_player_decisions, public.season_activation_slots, public.season_transition_reservations, public.season_transition_runs from anon, authenticated;
revoke all on function public.prepare_club_season(uuid,text,date,date,uuid,boolean) from public,anon;
revoke all on function public.season_preflight(uuid,uuid) from public,anon;
revoke all on function public.activate_club_season(uuid,uuid,text) from public,anon;
grant execute on function public.prepare_club_season(uuid,text,date,date,uuid,boolean) to authenticated;
grant execute on function public.season_preflight(uuid,uuid) to authenticated;
grant execute on function public.activate_club_season(uuid,uuid,text) to authenticated;

notify pgrst, 'reload schema';


