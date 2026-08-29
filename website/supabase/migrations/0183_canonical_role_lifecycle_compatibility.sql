-- Make canonical role synchronization compatible with onboarding and profile deletion.

alter table public.person_accounts
  drop constraint if exists person_accounts_profile_id_fkey;
alter table public.person_accounts
  add constraint person_accounts_profile_id_fkey
  foreign key (profile_id) references public.profiles(id) on delete cascade;

create or replace function public.sync_canonical_membership_role(
  target_club_id uuid, target_profile_id uuid
) returns void language plpgsql security definer set search_path = public as $$
declare
  membership_row public.club_memberships;
  club_person_id_value uuid;
  base_role_id uuid;
  canonical_role_value text;
  canonical_scope_value text;
begin
  select * into membership_row from public.club_memberships
  where club_id = target_club_id and profile_id = target_profile_id;
  if membership_row.profile_id is null or membership_row.status <> 'active' then return; end if;

  select cp.id into club_person_id_value
  from public.person_accounts pa
  join public.club_people cp on cp.person_id = pa.person_id
  where pa.profile_id = target_profile_id and pa.status = 'active' and pa.revoked_at is null
    and cp.club_id = target_club_id and cp.status = 'active';
  -- Account/person creation can happen later in the same onboarding transaction.
  if club_person_id_value is null then return; end if;

  canonical_role_value := public.canonical_club_role_type(membership_row.role, membership_row.function_role);
  canonical_scope_value := case when membership_row.role in ('club_admin', 'club_admin_viewer')
    then 'all' else coalesce(membership_row.team_scope, 'none') end;
  select id into base_role_id from public.club_role_assignments
  where club_person_id = club_person_id_value and club_team_id is null and status = 'active'
    and valid_from <= current_date and (valid_until is null or valid_until >= current_date)
  order by created_at limit 1 for update;
  if base_role_id is null then
    insert into public.club_role_assignments(
      club_person_id, role_type, club_team_id, team_scope, custom_role_name,
      valid_from, status, created_by
    ) values (
      club_person_id_value, canonical_role_value, null, canonical_scope_value,
      membership_row.custom_role_name, current_date, 'active', target_profile_id
    );
  else
    update public.club_role_assignments set
      role_type = canonical_role_value, team_scope = canonical_scope_value,
      custom_role_name = membership_row.custom_role_name
    where id = base_role_id;
  end if;
  update public.club_role_assignments set role_type = canonical_role_value
  where club_person_id = club_person_id_value and club_team_id is not null and status = 'active';
end;
$$;

create or replace function public.sync_membership_identity_projection()
returns trigger language plpgsql security definer set search_path = public as $$
declare club_person_id_value uuid;
begin
  if new.status = 'active' then
    perform public.sync_canonical_membership_role(new.club_id, new.profile_id);
  elsif new.status not in ('active', 'pending') then
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

create or replace function public.sync_account_membership_roles()
returns trigger language plpgsql security definer set search_path = public as $$
declare membership_row record;
begin
  if new.status = 'active' and new.revoked_at is null then
    for membership_row in
      select club_id from public.club_memberships
      where profile_id = new.profile_id and status = 'active'
    loop
      perform public.sync_canonical_membership_role(membership_row.club_id, new.profile_id);
    end loop;
  end if;
  return new;
end;
$$;

drop trigger if exists sync_account_membership_roles_trigger on public.person_accounts;
create trigger sync_account_membership_roles_trigger
after insert or update of status, revoked_at on public.person_accounts
for each row execute function public.sync_account_membership_roles();

revoke all on function public.sync_canonical_membership_role(uuid, uuid) from public, anon, authenticated;
revoke all on function public.sync_account_membership_roles() from public, anon, authenticated;

