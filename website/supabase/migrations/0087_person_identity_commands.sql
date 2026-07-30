-- Canonical, transaction-safe commands for the 0086 identity foundation.
-- No backfill and no automatic name/email matching.

create or replace function public.create_club_person(
  target_club_id uuid,
  first_name_value text,
  last_name_value text,
  date_of_birth_value date default null
) returns uuid
language plpgsql security definer set search_path = public as $$
declare
  actor_id uuid := auth.uid();
  person_id_value uuid;
  club_person_id_value uuid;
begin
  if actor_id is null or not public.is_active_club_admin(target_club_id, actor_id) then
    raise exception 'CLUB_ADMIN_REQUIRED';
  end if;
  if trim(coalesce(first_name_value, '')) = '' or trim(coalesce(last_name_value, '')) = '' then
    raise exception 'PERSON_NAME_REQUIRED';
  end if;

  insert into public.people(first_name, last_name, date_of_birth, created_by)
  values (trim(first_name_value), trim(last_name_value), date_of_birth_value, actor_id)
  returning id into person_id_value;

  insert into public.club_people(club_id, person_id, created_by)
  values (target_club_id, person_id_value, actor_id)
  returning id into club_person_id_value;

  insert into public.identity_audit_log(actor_profile_id, club_id, action, target_table, target_id)
  values (actor_id, target_club_id, 'person_created', 'people', person_id_value),
         (actor_id, target_club_id, 'club_person_created', 'club_people', club_person_id_value);

  return club_person_id_value;
end;
$$;

create or replace function public.link_person_account(
  target_person_id uuid,
  target_profile_id uuid,
  link_method_value text,
  actor_profile_id uuid
) returns uuid
language plpgsql security definer set search_path = public as $$
declare
  link_id uuid;
begin
  if link_method_value not in ('personal_invite', 'admin_review', 'verified_import') then
    raise exception 'ACCOUNT_LINK_METHOD_INVALID';
  end if;
  if not exists (select 1 from public.profiles where id = actor_profile_id) then
    raise exception 'ACCOUNT_LINK_ACTOR_INVALID';
  end if;

  -- Locks both identities in a stable order. Partial unique indexes remain the final
  -- concurrency guard when independent transactions race.
  perform 1 from public.people where id = target_person_id for update;
  if not found then raise exception 'PERSON_NOT_FOUND'; end if;
  perform 1 from public.profiles where id = target_profile_id for update;
  if not found then raise exception 'PROFILE_NOT_FOUND'; end if;

  insert into public.person_accounts(
    person_id, profile_id, status, link_method, verified_at, verified_by
  ) values (
    target_person_id, target_profile_id, 'active', link_method_value,
    timezone('utc', now()), actor_profile_id
  ) returning id into link_id;

  insert into public.identity_audit_log(
    actor_profile_id, action, target_table, target_id,
    details
  ) values (
    actor_profile_id, 'account_linked', 'person_accounts', link_id,
    jsonb_build_object('person_id', target_person_id, 'profile_id', target_profile_id,
      'link_method', link_method_value)
  );
  return link_id;
end;
$$;

create or replace function public.revoke_person_account(
  target_link_id uuid,
  actor_profile_id uuid,
  reason_value text
) returns void
language plpgsql security definer set search_path = public as $$
declare
  target_link public.person_accounts;
begin
  select * into target_link from public.person_accounts
  where id = target_link_id for update;
  if target_link.id is null then raise exception 'ACCOUNT_LINK_NOT_FOUND'; end if;
  if target_link.status <> 'active' or target_link.revoked_at is not null then
    raise exception 'ACCOUNT_LINK_NOT_ACTIVE';
  end if;
  if not exists (select 1 from public.profiles where id = actor_profile_id) then
    raise exception 'ACCOUNT_LINK_ACTOR_INVALID';
  end if;

  update public.person_accounts set
    status = 'revoked',
    revoked_at = timezone('utc', now()),
    revoked_by = actor_profile_id,
    revoke_reason = nullif(trim(reason_value), '')
  where id = target_link_id;

  insert into public.identity_audit_log(actor_profile_id, action, target_table, target_id, details)
  values (actor_profile_id, 'account_link_revoked', 'person_accounts', target_link_id,
    jsonb_build_object('reason', nullif(trim(reason_value), '')));
end;
$$;

create or replace function public.assign_club_role(
  target_club_person_id uuid,
  role_type_value text,
  target_club_team_id uuid default null,
  valid_from_value date default current_date,
  valid_until_value date default null
) returns uuid
language plpgsql security definer set search_path = public as $$
declare
  actor_id uuid := auth.uid();
  club_id_value uuid;
  person_row public.people;
  role_id uuid;
  trainer_id_value uuid;
  legacy_role text;
begin
  select cp.club_id into club_id_value
  from public.club_people cp
  where cp.id = target_club_person_id and cp.status = 'active'
  for update;
  if club_id_value is null then raise exception 'CLUB_PERSON_NOT_FOUND'; end if;
  select p.* into person_row
  from public.people p
  join public.club_people cp on cp.person_id = p.id
  where cp.id = target_club_person_id
  for update of p;
  if actor_id is null or not public.is_active_club_admin(club_id_value, actor_id) then
    raise exception 'CLUB_ADMIN_REQUIRED';
  end if;

  insert into public.club_role_assignments(
    club_person_id, role_type, club_team_id, valid_from, valid_until, created_by
  ) values (
    target_club_person_id, role_type_value, target_club_team_id,
    valid_from_value, valid_until_value, actor_id
  ) returning id into role_id;

  -- Legacy trainer tables are a compatibility projection, never a second independent identity.
  if role_type_value in ('trainer', 'assistant_trainer', 'goalkeeper_coach', 'team_manager') then
    select id into trainer_id_value from public.club_trainers
    where club_person_id = target_club_person_id for update;

    if trainer_id_value is null then
      insert into public.club_trainers(
        club_id, club_person_id, display_name, invitation_status
      ) values (
        club_id_value, target_club_person_id,
        trim(person_row.first_name || ' ' || person_row.last_name), 'placeholder'
      ) returning id into trainer_id_value;
    end if;

    if target_club_team_id is not null then
      legacy_role := case role_type_value
        when 'assistant_trainer' then 'assistant_coach'
        when 'team_manager' then 'team_manager'
        else 'coach'
      end;
      insert into public.club_trainer_teams(
        trainer_id, club_team_id, role, status, club_role_assignment_id
      ) values (
        trainer_id_value, target_club_team_id, legacy_role, 'active', role_id
      );
    end if;
  end if;

  insert into public.identity_audit_log(
    actor_profile_id, club_id, action, target_table, target_id, details
  ) values (
    actor_id, club_id_value, 'role_assigned', 'club_role_assignments', role_id,
    jsonb_build_object('role_type', role_type_value, 'club_team_id', target_club_team_id)
  );
  return role_id;
end;
$$;

create or replace function public.end_club_role(
  target_role_assignment_id uuid,
  end_date_value date default current_date,
  reason_value text default null
) returns void
language plpgsql security definer set search_path = public as $$
declare
  actor_id uuid := auth.uid();
  role_row public.club_role_assignments;
  club_id_value uuid;
begin
  select role.* into role_row
  from public.club_role_assignments role
  where role.id = target_role_assignment_id
  for update;
  if role_row.id is null then raise exception 'CLUB_ROLE_NOT_FOUND'; end if;

  select club_id into club_id_value from public.club_people
  where id = role_row.club_person_id;
  if actor_id is null or not public.is_active_club_admin(club_id_value, actor_id) then
    raise exception 'CLUB_ADMIN_REQUIRED';
  end if;
  if role_row.status = 'ended' then raise exception 'CLUB_ROLE_ALREADY_ENDED'; end if;
  if end_date_value < role_row.valid_from then raise exception 'CLUB_ROLE_END_BEFORE_START'; end if;

  update public.club_role_assignments set
    status = 'ended',
    valid_until = end_date_value,
    ended_at = timezone('utc', now()),
    ended_by = actor_id,
    end_reason = nullif(trim(reason_value), '')
  where id = target_role_assignment_id;

  update public.club_trainer_teams set status = 'inactive'
  where club_role_assignment_id = target_role_assignment_id;

  insert into public.identity_audit_log(
    actor_profile_id, club_id, action, target_table, target_id, details
  ) values (
    actor_id, club_id_value, 'role_ended', 'club_role_assignments',
    target_role_assignment_id, jsonb_build_object('reason', nullif(trim(reason_value), ''))
  );
end;
$$;

create or replace function public.merge_people(
  source_person_id uuid,
  target_person_id uuid,
  actor_profile_id uuid,
  reason_value text
) returns void
language plpgsql security definer set search_path = public as $$
begin
  if source_person_id = target_person_id then raise exception 'PERSON_MERGE_SAME_ID'; end if;
  if trim(coalesce(reason_value, '')) = '' then raise exception 'PERSON_MERGE_REASON_REQUIRED'; end if;
  if not exists (select 1 from public.profiles where id = actor_profile_id) then
    raise exception 'PERSON_MERGE_ACTOR_INVALID';
  end if;

  perform 1 from public.people
  where id in (source_person_id, target_person_id)
  order by id for update;
  if (select count(*) from public.people where id in (source_person_id, target_person_id)) <> 2 then
    raise exception 'PERSON_MERGE_NOT_FOUND';
  end if;
  if exists (
    select 1 from public.club_people source_cp
    join public.club_people target_cp on target_cp.club_id = source_cp.club_id
    where source_cp.person_id = source_person_id and target_cp.person_id = target_person_id
  ) then raise exception 'PERSON_MERGE_CLUB_OVERLAP_REQUIRES_REVIEW'; end if;
  if (
    select count(*) from public.person_accounts
    where person_id in (source_person_id, target_person_id)
      and status = 'active' and revoked_at is null
  ) > 1 then raise exception 'PERSON_MERGE_ACCOUNT_CONFLICT'; end if;

  update public.club_people set person_id = target_person_id where person_id = source_person_id;
  update public.person_accounts set person_id = target_person_id where person_id = source_person_id;
  update public.people set
    status = 'merged', merged_into_person_id = target_person_id, merge_reason = reason_value
  where id = source_person_id;

  insert into public.identity_audit_log(
    actor_profile_id, action, target_table, target_id, details
  ) values (
    actor_profile_id, 'person_merged', 'people', source_person_id,
    jsonb_build_object('merged_into_person_id', target_person_id, 'reason', reason_value)
  );
end;
$$;

revoke all on function public.create_club_person(uuid, text, text, date) from public, anon;
revoke all on function public.assign_club_role(uuid, text, uuid, date, date) from public, anon;
revoke all on function public.end_club_role(uuid, date, text) from public, anon;
grant execute on function public.create_club_person(uuid, text, text, date) to authenticated;
grant execute on function public.assign_club_role(uuid, text, uuid, date, date) to authenticated;
grant execute on function public.end_club_role(uuid, date, text) to authenticated;

revoke all on function public.link_person_account(uuid, uuid, text, uuid)
  from public, anon, authenticated;
revoke all on function public.revoke_person_account(uuid, uuid, text)
  from public, anon, authenticated;
revoke all on function public.merge_people(uuid, uuid, uuid, text)
  from public, anon, authenticated;
grant execute on function public.link_person_account(uuid, uuid, text, uuid) to service_role;
grant execute on function public.revoke_person_account(uuid, uuid, text) to service_role;
grant execute on function public.merge_people(uuid, uuid, uuid, text) to service_role;

notify pgrst, 'reload schema';
