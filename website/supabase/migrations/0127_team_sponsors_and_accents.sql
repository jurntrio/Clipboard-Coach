-- Unified team relevance: a sponsor is either specific to a team or receives
-- extra visibility there. These meanings must not be conflated.

create table public.sponsor_team_relations (
  id uuid primary key default gen_random_uuid(),
  club_id uuid not null references public.clubs(id) on delete cascade,
  season_id uuid not null references public.club_seasons(id) on delete restrict,
  sponsor_id uuid not null references public.sponsors(id) on delete restrict,
  assignment_id uuid references public.sponsor_assignments(id) on delete cascade,
  club_team_id uuid not null references public.club_teams(id) on delete restrict,
  relation_type text not null check (relation_type in ('specific_sponsor', 'team_accent')),
  accent_level text check (accent_level in ('extra', 'prominent')),
  priority_weight smallint not null default 1 check (priority_weight between 1 and 100),
  active boolean not null default true,
  created_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now()),
  check (
    (relation_type = 'specific_sponsor' and accent_level is null and priority_weight = 1)
    or (relation_type = 'team_accent' and accent_level is not null and priority_weight in (2, 3))
  )
);
create unique index sponsor_team_relations_unique_active
  on public.sponsor_team_relations(season_id, sponsor_id, club_team_id, relation_type)
  where active;
create index sponsor_team_relations_context_idx
  on public.sponsor_team_relations(club_id, season_id, club_team_id, active);

create or replace function public.enforce_sponsor_team_relation_context()
returns trigger language plpgsql set search_path = public as $$
declare sponsor_club uuid; team_club uuid; team_season uuid; assignment_club uuid; assignment_season uuid; assignment_sponsor uuid;
begin
  select club_id into sponsor_club from public.sponsors where id = new.sponsor_id;
  select club_id, season_id into team_club, team_season from public.club_teams where id = new.club_team_id;
  if sponsor_club is null or sponsor_club <> new.club_id or team_club <> new.club_id then raise exception 'SPONSOR_TEAM_CLUB_MISMATCH'; end if;
  if team_season is distinct from new.season_id then raise exception 'SPONSOR_TEAM_SEASON_MISMATCH'; end if;
  if new.assignment_id is not null then
    select club_id, season_id, sponsor_id into assignment_club, assignment_season, assignment_sponsor
    from public.sponsor_assignments where id = new.assignment_id;
    if assignment_club <> new.club_id or assignment_sponsor <> new.sponsor_id or assignment_season is distinct from new.season_id then
      raise exception 'SPONSOR_TEAM_ASSIGNMENT_MISMATCH';
    end if;
  end if;
  if new.relation_type = 'specific_sponsor' then new.accent_level := null; new.priority_weight := 1;
  elsif new.accent_level = 'prominent' then new.priority_weight := 3;
  else new.accent_level := 'extra'; new.priority_weight := 2;
  end if;
  return new;
end;
$$;
create trigger trg_sponsor_team_relation_context before insert or update on public.sponsor_team_relations
for each row execute function public.enforce_sponsor_team_relation_context();
create trigger trg_sponsor_team_relations_updated_at before update on public.sponsor_team_relations
for each row execute function public.set_updated_at();

alter table public.sponsor_team_relations enable row level security;

-- Once a legacy team image has been mapped to a central sponsor, create the
-- equivalent specific relation without removing the compatibility columns.
create or replace function public.map_legacy_team_sponsor(target_legacy_source_id uuid, target_sponsor_id uuid, actor_id uuid)
returns uuid language plpgsql security definer set search_path = public as $$
declare legacy_row public.sponsor_legacy_sources; team_row public.club_teams; relation_id uuid;
begin
  select * into legacy_row from public.sponsor_legacy_sources where id = target_legacy_source_id and source_type = 'team' for update;
  if legacy_row.id is null then raise exception 'LEGACY_TEAM_SPONSOR_NOT_FOUND'; end if;
  if not exists(select 1 from public.sponsors where id=target_sponsor_id and club_id=legacy_row.club_id) then raise exception 'SPONSOR_CLUB_MISMATCH'; end if;
  select * into team_row from public.club_teams where id=legacy_row.source_id;
  if team_row.season_id is null then raise exception 'LEGACY_TEAM_HAS_NO_SEASON'; end if;
  insert into public.sponsor_team_relations(club_id,season_id,sponsor_id,club_team_id,relation_type,created_by)
  values(legacy_row.club_id,team_row.season_id,target_sponsor_id,team_row.id,'specific_sponsor',actor_id)
  on conflict (season_id,sponsor_id,club_team_id,relation_type) where active do update set active=true
  returning id into relation_id;
  update public.sponsor_legacy_sources set mapped_sponsor_id=target_sponsor_id,status='mapped' where id=legacy_row.id;
  return relation_id;
end;
$$;
revoke all on function public.map_legacy_team_sponsor(uuid,uuid,uuid) from public, anon, authenticated;
grant execute on function public.map_legacy_team_sponsor(uuid,uuid,uuid) to service_role;

notify pgrst, 'reload schema';
