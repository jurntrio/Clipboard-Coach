-- Club/team onboarding and tenant-safe team administration.
create extension if not exists pg_trgm;

create or replace function public.normalize_club_team_name(value text)
returns text
language sql
immutable
strict
set search_path = public
as $$
  select trim(regexp_replace(
    lower(translate(value, 'ÀÁÂÃÄÅàáâãäåÈÉÊËèéêëÌÍÎÏìíîïÒÓÔÕÖòóôõöÙÚÛÜùúûüÇç', 'AAAAAAaaaaaaEEEEeeeeIIIIiiiiOOOOOoooooUUUUuuuuCc')),
    '[^a-z0-9]+', ' ', 'g'
  ));
$$;

alter table public.clubs
  add column if not exists normalized_name text,
  add column if not exists city text,
  add column if not exists country text not null default 'BE',
  add column if not exists status text not null default 'active',
  add column if not exists created_by uuid references public.profiles(id) on delete set null,
  add column if not exists external_provider text,
  add column if not exists external_club_id text,
  add column if not exists external_sync_status text,
  add column if not exists last_synced_at timestamp with time zone;

update public.clubs set normalized_name = public.normalize_club_team_name(name)
where normalized_name is null;
alter table public.clubs alter column normalized_name set not null;
alter table public.clubs drop constraint if exists clubs_status_check;
alter table public.clubs add constraint clubs_status_check
  check (status in ('active', 'inactive', 'pending', 'archived'));

-- Existing installations call this RBFA-specific field. Keep it as the
-- canonical registration number to avoid breaking current code.
create unique index if not exists clubs_rbfa_registration_number_unique
  on public.clubs (lower(trim(rbfa_registration_number)))
  where rbfa_registration_number is not null and trim(rbfa_registration_number) <> '';
create unique index if not exists clubs_normalized_name_unique
  on public.clubs (normalized_name);
create index if not exists clubs_name_search_idx on public.clubs using gin (normalized_name gin_trgm_ops);
create index if not exists clubs_status_idx on public.clubs(status);
create unique index if not exists clubs_external_identity_unique
  on public.clubs(external_provider, external_club_id)
  where external_provider is not null and external_club_id is not null;

alter table public.club_teams
  add column if not exists normalized_name text,
  add column if not exists age_category text,
  add column if not exists level_or_competition text,
  add column if not exists status text not null default 'active',
  add column if not exists created_by uuid references public.profiles(id) on delete set null,
  add column if not exists approved_by uuid references public.profiles(id) on delete set null,
  add column if not exists approved_at timestamp with time zone,
  add column if not exists updated_at timestamp with time zone default timezone('utc'::text, now()) not null,
  add column if not exists external_provider text,
  add column if not exists external_team_id text,
  add column if not exists external_sync_status text,
  add column if not exists last_synced_at timestamp with time zone,
  add column if not exists merged_into_id uuid references public.club_teams(id) on delete restrict;

update public.club_teams set normalized_name = public.normalize_club_team_name(name)
where normalized_name is null;
alter table public.club_teams alter column normalized_name set not null;
alter table public.club_teams drop constraint if exists club_teams_status_check;
alter table public.club_teams add constraint club_teams_status_check
  check (status in ('active', 'inactive', 'pending', 'rejected', 'archived', 'merged'));
alter table public.club_teams drop constraint if exists club_teams_club_id_name_key;
create unique index if not exists club_teams_active_name_unique
  on public.club_teams(club_id, normalized_name)
  where status not in ('rejected', 'archived', 'merged');
create index if not exists club_teams_club_status_idx on public.club_teams(club_id, status);
create unique index if not exists club_teams_external_identity_unique
  on public.club_teams(external_provider, external_team_id)
  where external_provider is not null and external_team_id is not null;

alter table public.club_memberships drop constraint if exists club_memberships_role_check;
alter table public.club_memberships add constraint club_memberships_role_check
  check (role in ('club_admin', 'coach', 'assistant_coach', 'team_manager', 'analyst', 'trainer'));
alter table public.club_memberships
  add column if not exists status text not null default 'active';
alter table public.club_memberships drop constraint if exists club_memberships_status_check;
alter table public.club_memberships add constraint club_memberships_status_check
  check (status in ('active', 'inactive', 'pending', 'rejected'));

alter table public.club_trainer_teams
  add column if not exists role text not null default 'coach',
  add column if not exists status text not null default 'active',
  add column if not exists created_at timestamp with time zone default timezone('utc'::text, now()) not null;
alter table public.club_trainer_teams drop constraint if exists club_trainer_teams_role_check;
alter table public.club_trainer_teams add constraint club_trainer_teams_role_check
  check (role in ('coach', 'assistant_coach', 'team_manager'));
alter table public.club_trainer_teams drop constraint if exists club_trainer_teams_status_check;
alter table public.club_trainer_teams add constraint club_trainer_teams_status_check
  check (status in ('active', 'inactive', 'pending', 'rejected'));

alter table public.profiles drop constraint if exists profiles_account_role_check;
alter table public.profiles add constraint profiles_account_role_check
  check (account_role in ('coach', 'club_admin', 'assistant_coach', 'team_manager', 'analyst', 'platform_admin'));

create or replace function public.touch_club_record()
returns trigger language plpgsql set search_path = public as $$
begin
  new.updated_at := timezone('utc'::text, now());
  if tg_table_name in ('clubs', 'club_teams') then
    new.normalized_name := public.normalize_club_team_name(new.name);
  end if;
  return new;
end;
$$;
drop trigger if exists touch_clubs on public.clubs;
create trigger touch_clubs before insert or update of name on public.clubs
for each row execute function public.touch_club_record();
drop trigger if exists touch_club_teams on public.club_teams;
create trigger touch_club_teams before insert or update of name on public.club_teams
for each row execute function public.touch_club_record();

-- Safe unauthenticated directory used during signup. It exposes no members.
create or replace function public.search_club_directory(search_term text default '')
returns table(id uuid, name text, registration_number text, similarity_score real)
language sql stable security definer set search_path = public as $$
  select c.id, c.name, c.rbfa_registration_number,
    similarity(c.normalized_name, public.normalize_club_team_name(coalesce(search_term, '')))::real
  from public.clubs c
  where c.status = 'active'
    and (
      trim(coalesce(search_term, '')) = ''
      or c.normalized_name like '%' || public.normalize_club_team_name(search_term) || '%'
      or similarity(c.normalized_name, public.normalize_club_team_name(search_term)) >= 0.35
    )
  order by
    case when c.normalized_name like public.normalize_club_team_name(coalesce(search_term, '')) || '%' then 0 else 1 end,
    similarity(c.normalized_name, public.normalize_club_team_name(coalesce(search_term, ''))) desc,
    c.name
  limit 30;
$$;
grant execute on function public.search_club_directory(text) to anon, authenticated;

create or replace function public.list_public_club_teams(target_club_id uuid)
returns table(id uuid, name text, age_category text, level_or_competition text)
language sql stable security definer set search_path = public as $$
  select t.id, t.name, t.age_category, t.level_or_competition
  from public.club_teams t
  join public.clubs c on c.id = t.club_id
  where t.club_id = target_club_id and t.status = 'active' and c.status = 'active'
  order by t.name;
$$;
grant execute on function public.list_public_club_teams(uuid) to anon, authenticated;

-- Signup is completed in the auth.users transaction. IDs and roles sent by
-- the browser are validated here and never trusted as authorization.
create or replace function public.complete_club_team_onboarding(
  target_user_id uuid,
  user_email text,
  user_full_name text,
  onboarding jsonb
) returns void
language plpgsql security definer set search_path = public as $$
declare
  selected_club_id uuid;
  selected_team_id uuid;
  trainer_id uuid;
  mode text := onboarding->>'club_mode';
  team_mode text := onboarding->>'team_mode';
  requested_role text := coalesce(onboarding->>'team_role', 'coach');
  club_name_value text := trim(coalesce(onboarding->>'club_name', ''));
  registration_value text := nullif(trim(coalesce(onboarding->>'registration_number', '')), '');
  team_name_value text := trim(coalesce(onboarding->>'team_name', ''));
  similar_club record;
begin
  if requested_role not in ('coach', 'assistant_coach', 'team_manager') then
    requested_role := 'coach';
  end if;

  if mode = 'existing' then
    select id into selected_club_id from public.clubs
    where id = nullif(onboarding->>'club_id', '')::uuid and status = 'active';
    if selected_club_id is null then raise exception 'ONBOARDING_CLUB_NOT_FOUND'; end if;
  elsif mode = 'new' then
    if club_name_value = '' or team_name_value = '' then raise exception 'ONBOARDING_FIELDS_REQUIRED'; end if;
    if registration_value is not null then
      select id into selected_club_id from public.clubs
      where lower(trim(rbfa_registration_number)) = lower(registration_value);
      if selected_club_id is not null then
        raise exception 'DUPLICATE_REGISTRATION_USE_EXISTING';
      end if;
    end if;
    if selected_club_id is null then
      if exists(select 1 from public.clubs where normalized_name = public.normalize_club_team_name(club_name_value)) then
        raise exception 'DUPLICATE_CLUB_NAME_USE_EXISTING';
      end if;
      select * into similar_club from public.clubs
      where normalized_name = public.normalize_club_team_name(club_name_value)
         or similarity(normalized_name, public.normalize_club_team_name(club_name_value)) >= 0.72
      order by similarity(normalized_name, public.normalize_club_team_name(club_name_value)) desc limit 1;
      if found and not coalesce((onboarding->>'similar_club_acknowledged')::boolean, false) then
        raise exception 'SIMILAR_CLUB_REQUIRES_CONFIRMATION';
      end if;
      begin
        insert into public.clubs(name, normalized_name, rbfa_registration_number, status, created_by)
        values (club_name_value, public.normalize_club_team_name(club_name_value), registration_value, 'active', target_user_id)
        returning id into selected_club_id;
      exception when unique_violation then
        raise exception 'DUPLICATE_CLUB_USE_EXISTING';
      end;
    end if;
  else
    raise exception 'ONBOARDING_MODE_INVALID';
  end if;

  if mode = 'new' then
    insert into public.club_memberships(club_id, profile_id, role, status)
    values(selected_club_id, target_user_id, 'club_admin', 'active')
    on conflict(club_id, profile_id) do update set role = 'club_admin', status = 'active';
    update public.profiles set account_role = 'club_admin' where id = target_user_id;
  else
    insert into public.club_memberships(club_id, profile_id, role, status)
    values(selected_club_id, target_user_id, requested_role, 'active')
    on conflict(club_id, profile_id) do update set status = 'active';
  end if;

  if team_mode = 'existing' then
    select id into selected_team_id from public.club_teams
    where id = nullif(onboarding->>'team_id', '')::uuid
      and club_id = selected_club_id and status = 'active';
    if selected_team_id is null then raise exception 'ONBOARDING_TEAM_NOT_FOUND'; end if;
  elsif team_mode = 'new' or mode = 'new' then
    if team_name_value = '' then raise exception 'ONBOARDING_TEAM_REQUIRED'; end if;
    insert into public.club_teams(
      club_id, name, normalized_name, age_category, level_or_competition,
      status, created_by, approved_by, approved_at
    ) values (
      selected_club_id, team_name_value, public.normalize_club_team_name(team_name_value),
      nullif(trim(coalesce(onboarding->>'age_category', '')), ''),
      nullif(trim(coalesce(onboarding->>'level_or_competition', '')), ''),
      case when mode = 'new' then 'active' else 'pending' end, target_user_id,
      case when mode = 'new' then target_user_id else null end,
      case when mode = 'new' then timezone('utc'::text, now()) else null end
    )
    on conflict (club_id, normalized_name) where status not in ('rejected', 'archived', 'merged')
    do update set name = public.club_teams.name
    returning id into selected_team_id;
  else
    raise exception 'ONBOARDING_TEAM_MODE_INVALID';
  end if;

  insert into public.club_trainers(club_id, profile_id, display_name, invitation_status)
  values(selected_club_id, target_user_id, coalesce(nullif(trim(user_full_name), ''), user_email), 'linked')
  on conflict (club_id, profile_id) where profile_id is not null
  do update set invitation_status = 'linked'
  returning id into trainer_id;

  insert into public.club_trainer_teams(trainer_id, club_team_id, role, status)
  values(trainer_id, selected_team_id, requested_role,
    case when (select status from public.club_teams where id = selected_team_id) = 'pending' then 'pending' else 'active' end)
  on conflict(trainer_id, club_team_id) do update set role = excluded.role, status = excluded.status;
end;
$$;
revoke all on function public.complete_club_team_onboarding(uuid, text, text, jsonb) from public, anon, authenticated;

create or replace function public.merge_club_teams(source_team_id uuid, target_team_id uuid, actor_id uuid, platform_override boolean default false)
returns void language plpgsql security definer set search_path = public as $$
declare source_club_id uuid; target_club_id uuid;
begin
  if source_team_id = target_team_id then raise exception 'MERGE_TARGET_EQUALS_SOURCE'; end if;
  select club_id into source_club_id from public.club_teams where id = source_team_id for update;
  select club_id into target_club_id from public.club_teams where id = target_team_id for update;
  if source_club_id is null or target_club_id is null or source_club_id <> target_club_id then
    raise exception 'MERGE_CLUB_MISMATCH';
  end if;
  if not platform_override and not exists (
    select 1 from public.club_memberships
    where club_id = source_club_id and profile_id = actor_id and role = 'club_admin' and status = 'active'
  ) then raise exception 'MERGE_FORBIDDEN'; end if;

  insert into public.club_trainer_teams(trainer_id, club_team_id, role, status)
  select trainer_id, target_team_id, role, status
  from public.club_trainer_teams where club_team_id = source_team_id
  on conflict(trainer_id, club_team_id) do update
    set status = case when excluded.status = 'active' then 'active' else public.club_trainer_teams.status end;
  update public.matches set club_team_id = target_team_id where club_team_id = source_team_id;
  delete from public.club_trainer_teams where club_team_id = source_team_id;
  update public.club_teams set status = 'merged', merged_into_id = target_team_id where id = source_team_id;
end;
$$;
revoke all on function public.merge_club_teams(uuid, uuid, uuid, boolean) from public, anon, authenticated;

create or replace function public.handle_new_user()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  insert into public.profiles (id, email, full_name)
  values (new.id, new.email, new.raw_user_meta_data->>'full_name');
  insert into public.standard_tags (coach_id, name, is_protected)
  values (new.id, 'Start', true), (new.id, 'Goal', true);
  if new.raw_user_meta_data ? 'club_onboarding' then
    perform public.complete_club_team_onboarding(
      new.id, new.email, new.raw_user_meta_data->>'full_name',
      new.raw_user_meta_data->'club_onboarding'
    );
  end if;
  return new;
end;
$$;

-- Direct table access remains tightly scoped; privileged mutations use API
-- routes plus the service role after checking club membership.
drop policy if exists "Members can view their clubs" on public.clubs;
create policy "Members can view their clubs" on public.clubs for select
using (exists(select 1 from public.club_memberships cm where cm.club_id = clubs.id and cm.profile_id = auth.uid() and cm.status = 'active'));
drop policy if exists "Members can view club teams" on public.club_teams;
create policy "Members can view club teams" on public.club_teams for select
using (exists(select 1 from public.club_memberships cm where cm.club_id = club_teams.club_id and cm.profile_id = auth.uid() and cm.status = 'active'));

notify pgrst, 'reload schema';
