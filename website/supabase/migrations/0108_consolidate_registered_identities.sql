-- Make people/person_accounts/club_people canonical for registered club users.
-- Legacy membership/trainer tables remain compatibility and access projections.

create or replace function public.ensure_registered_club_identity(
  target_profile_id uuid,
  target_club_id uuid,
  actor_profile_id uuid default null
) returns uuid
language plpgsql security definer set search_path = public as $$
declare
  person_id_value uuid;
  club_person_id_value uuid;
  candidate_count integer;
  profile_row public.profiles;
  normalized_name text;
  first_name_value text;
  last_name_value text;
begin
  select * into profile_row from public.profiles where id = target_profile_id for update;
  if profile_row.id is null then raise exception 'PROFILE_NOT_FOUND'; end if;
  if not exists(select 1 from public.clubs where id = target_club_id) then raise exception 'CLUB_NOT_FOUND'; end if;

  select pa.person_id into person_id_value
  from public.person_accounts pa
  where pa.profile_id = target_profile_id and pa.status = 'active' and pa.revoked_at is null
  for update;

  if person_id_value is null then
    select (array_agg(distinct cp.person_id order by cp.person_id))[1], count(distinct cp.person_id)::integer
    into person_id_value, candidate_count
    from public.club_trainers trainer
    join public.club_people cp on cp.id = trainer.club_person_id
    where trainer.profile_id = target_profile_id;
    if candidate_count > 1 then raise exception 'REGISTERED_IDENTITY_CONFLICT'; end if;
  else
    if exists (
      select 1 from public.club_trainers trainer
      join public.club_people cp on cp.id = trainer.club_person_id
      where trainer.profile_id = target_profile_id and cp.person_id <> person_id_value
    ) then raise exception 'REGISTERED_IDENTITY_CONFLICT'; end if;
  end if;

  if person_id_value is null then
    normalized_name := trim(regexp_replace(coalesce(nullif(profile_row.full_name, ''), split_part(profile_row.email, '@', 1)), '\s+', ' ', 'g'));
    first_name_value := split_part(normalized_name, ' ', 1);
    last_name_value := nullif(trim(substr(normalized_name, length(first_name_value) + 1)), '');
    if last_name_value is null then last_name_value := '-'; end if;
    insert into public.people(first_name, last_name, created_by)
    values(first_name_value, last_name_value, coalesce(actor_profile_id, target_profile_id))
    returning id into person_id_value;
  end if;

  insert into public.person_accounts(person_id, profile_id, status, link_method, verified_at, verified_by)
  values(person_id_value, target_profile_id, 'active', 'verified_import', timezone('utc', now()), coalesce(actor_profile_id, target_profile_id))
  on conflict (person_id, profile_id) do update set
    status = 'active', link_method = 'verified_import', verified_at = coalesce(public.person_accounts.verified_at, timezone('utc', now())),
    verified_by = coalesce(public.person_accounts.verified_by, excluded.verified_by), revoked_at = null, revoked_by = null, revoke_reason = null;

  select id into club_person_id_value from public.club_people
  where club_id = target_club_id and person_id = person_id_value for update;
  if club_person_id_value is null then
    insert into public.club_people(club_id, person_id, created_by)
    values(target_club_id, person_id_value, coalesce(actor_profile_id, target_profile_id))
    returning id into club_person_id_value;
  else
    update public.club_people set status = 'active', left_at = null where id = club_person_id_value;
  end if;

  update public.club_trainers set club_person_id = club_person_id_value
  where club_id = target_club_id and profile_id = target_profile_id
    and club_person_id is distinct from club_person_id_value;
  return club_person_id_value;
end;
$$;

create or replace function public.sync_membership_identity_projection()
returns trigger language plpgsql security definer set search_path = public as $$
declare club_person_id_value uuid;
begin
  if new.status in ('active', 'pending') then
    perform public.ensure_registered_club_identity(new.profile_id, new.club_id, new.profile_id);
  else
    select cp.id into club_person_id_value
    from public.person_accounts pa join public.club_people cp on cp.person_id = pa.person_id
    where pa.profile_id = new.profile_id and pa.status = 'active' and pa.revoked_at is null
      and cp.club_id = new.club_id;
    if club_person_id_value is not null then
      update public.club_role_assignments set status = 'ended', valid_until = greatest(valid_from, current_date),
        ended_at = timezone('utc', now()), ended_by = new.profile_id, end_reason = 'membership_inactive'
      where club_person_id = club_person_id_value and status <> 'ended';
      update public.club_people set status = 'inactive', left_at = current_date where id = club_person_id_value;
    end if;
  end if;
  return new;
end;
$$;

create or replace function public.sync_trainer_identity_projection()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if new.profile_id is not null and new.club_person_id is null then
    new.club_person_id := public.ensure_registered_club_identity(new.profile_id, new.club_id, new.profile_id);
  end if;
  return new;
end;
$$;

create or replace function public.ensure_trainer_team_role_projection(
  target_trainer_id uuid, target_club_team_id uuid
) returns uuid language plpgsql security definer set search_path = public as $$
declare
  club_person_id_value uuid;
  profile_id_value uuid;
  function_role_value text;
  role_type_value text;
  assignment_id_value uuid;
  projection_row public.club_trainer_teams;
begin
  select * into projection_row from public.club_trainer_teams
  where trainer_id = target_trainer_id and club_team_id = target_club_team_id for update;
  if projection_row.trainer_id is null or projection_row.club_role_assignment_id is not null then
    return projection_row.club_role_assignment_id;
  end if;
  select trainer.club_person_id, trainer.profile_id into club_person_id_value, profile_id_value
  from public.club_trainers trainer where trainer.id = target_trainer_id;
  if club_person_id_value is null then return null; end if;
  select membership.function_role into function_role_value
  from public.club_memberships membership
  join public.club_people cp on cp.id = club_person_id_value and cp.club_id = membership.club_id
  where membership.profile_id = profile_id_value and membership.status in ('active', 'pending')
  order by case membership.status when 'active' then 0 else 1 end limit 1;
  role_type_value := case
    when function_role_value = 'goalkeeper_coach' then 'goalkeeper_coach'
    when projection_row.role = 'assistant_coach' then 'assistant_trainer'
    when projection_row.role = 'team_manager' then 'team_manager'
    else 'trainer' end;
  if projection_row.status in ('inactive', 'rejected') then return null; end if;
  select id into assignment_id_value from public.club_role_assignments
  where club_person_id = club_person_id_value and role_type = role_type_value
    and club_team_id = target_club_team_id and status in ('active', 'suspended')
  order by created_at limit 1;
  if assignment_id_value is null then
    insert into public.club_role_assignments(club_person_id, role_type, club_team_id, status, created_by)
    values(club_person_id_value, role_type_value, target_club_team_id,
      case when projection_row.status = 'pending' then 'suspended' else 'active' end, profile_id_value)
    returning id into assignment_id_value;
  end if;
  update public.club_trainer_teams set club_role_assignment_id = assignment_id_value
  where trainer_id = target_trainer_id and club_team_id = target_club_team_id;
  return assignment_id_value;
end;
$$;

create or replace function public.sync_trainer_team_role_projection()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  perform public.ensure_trainer_team_role_projection(new.trainer_id, new.club_team_id);
  return new;
end;
$$;

create or replace function public.end_trainer_team_role_projection()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if old.club_role_assignment_id is not null then
    update public.club_role_assignments set status = 'ended', valid_until = greatest(valid_from, current_date),
      ended_at = timezone('utc', now()), end_reason = 'compatibility_projection_removed'
    where id = old.club_role_assignment_id and status <> 'ended';
  end if;
  return old;
end;
$$;

drop trigger if exists sync_membership_identity_projection_trigger on public.club_memberships;
create trigger sync_membership_identity_projection_trigger
after insert or update of status on public.club_memberships
for each row execute function public.sync_membership_identity_projection();

drop trigger if exists sync_trainer_identity_projection_trigger on public.club_trainers;
create trigger sync_trainer_identity_projection_trigger
before insert or update of profile_id, club_id on public.club_trainers
for each row execute function public.sync_trainer_identity_projection();

drop trigger if exists sync_trainer_team_role_projection_trigger on public.club_trainer_teams;
create trigger sync_trainer_team_role_projection_trigger
after insert on public.club_trainer_teams
for each row when (new.club_role_assignment_id is null)
execute function public.sync_trainer_team_role_projection();

drop trigger if exists end_trainer_team_role_projection_trigger on public.club_trainer_teams;
create trigger end_trainer_team_role_projection_trigger
before delete on public.club_trainer_teams
for each row execute function public.end_trainer_team_role_projection();

-- Consolidate the small existing registered population deterministically.
do $$
declare row_value record;
begin
  for row_value in
    select distinct profile_id, club_id from public.club_memberships
    where status in ('active', 'pending') order by profile_id, club_id
  loop
    perform public.ensure_registered_club_identity(row_value.profile_id, row_value.club_id, row_value.profile_id);
  end loop;
  for row_value in
    select distinct profile_id, club_id from public.club_trainers
    where profile_id is not null order by profile_id, club_id
  loop
    perform public.ensure_registered_club_identity(row_value.profile_id, row_value.club_id, row_value.profile_id);
  end loop;
  for row_value in
    select trainer_id, club_team_id from public.club_trainer_teams
    where club_role_assignment_id is null order by trainer_id, club_team_id
  loop
    perform public.ensure_trainer_team_role_projection(row_value.trainer_id, row_value.club_team_id);
  end loop;
end;
$$;

create or replace function public.remove_registered_club_identity(
  target_club_id uuid, target_profile_id uuid, actor_profile_id uuid
) returns text
language plpgsql security definer set search_path = public as $$
declare person_id_value uuid; club_person_id_value uuid; removed_name text;
begin
  select pa.person_id, trim(p.first_name || ' ' || p.last_name)
  into person_id_value, removed_name
  from public.person_accounts pa join public.people p on p.id = pa.person_id
  where pa.profile_id = target_profile_id and pa.status = 'active' and pa.revoked_at is null for update of pa, p;
  select id into club_person_id_value from public.club_people
  where club_id = target_club_id and person_id = person_id_value for update;
  if club_person_id_value is not null then
    update public.club_role_assignments set status = 'ended', valid_until = greatest(valid_from, current_date),
      ended_at = timezone('utc', now()), ended_by = actor_profile_id, end_reason = 'removed_from_club'
    where club_person_id = club_person_id_value and status <> 'ended';
  end if;
  delete from public.team_staff_members where user_id = target_profile_id and team_id in (
    select team.id from public.teams team join public.club_teams ct on ct.id = team.club_team_id where ct.club_id = target_club_id
  );
  delete from public.club_member_permissions where club_id = target_club_id and profile_id = target_profile_id;
  delete from public.club_member_team_access where club_id = target_club_id and profile_id = target_profile_id;
  delete from public.club_memberships where club_id = target_club_id and profile_id = target_profile_id;
  delete from public.club_trainers where club_id = target_club_id and profile_id = target_profile_id;
  if club_person_id_value is not null then
    update public.club_people set status = 'inactive', left_at = current_date where id = club_person_id_value;
  end if;
  return coalesce(removed_name, 'Clublid');
end;
$$;

revoke all on function public.ensure_registered_club_identity(uuid,uuid,uuid) from public, anon, authenticated;
revoke all on function public.ensure_trainer_team_role_projection(uuid,uuid) from public, anon, authenticated;
revoke all on function public.remove_registered_club_identity(uuid,uuid,uuid) from public, anon, authenticated;
grant execute on function public.ensure_registered_club_identity(uuid,uuid,uuid) to service_role;
grant execute on function public.ensure_trainer_team_role_projection(uuid,uuid) to service_role;
grant execute on function public.remove_registered_club_identity(uuid,uuid,uuid) to service_role;

notify pgrst, 'reload schema';
