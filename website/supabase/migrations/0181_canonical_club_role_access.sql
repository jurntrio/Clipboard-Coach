-- Finish the people/roles migration started in 0086-0108.
-- club_role_assignments is now the authorization source for registered club users.
-- Legacy membership/trainer tables remain temporary operational projections.

alter table public.club_role_assignments
  drop constraint if exists club_role_assignments_role_type_check;

alter table public.club_role_assignments
  add constraint club_role_assignments_role_type_check check (role_type in (
    'club_admin', 'club_admin_viewer', 'president', 'board_member', 'secretary',
    'treasurer', 'youth_coordinator', 'head_youth_development', 'technical_director',
    'trainer', 'assistant_trainer', 'team_manager', 'goalkeeper_coach', 'video_analyst',
    'physiotherapist', 'doctor', 'performance_coach', 'physical_coach',
    'hospitality_worker', 'operator', 'equipment_manager', 'scout', 'communications',
    'match_secretary', 'commercial_manager', 'sponsor_viewer', 'safety_officer',
    'head_referees', 'volunteer', 'club_employee', 'custom'
  ));

alter table public.club_role_assignments
  add column if not exists team_scope text not null default 'assigned'
    check (team_scope in ('none', 'assigned', 'all')),
  add column if not exists custom_role_name text;

create table if not exists public.club_role_permission_overrides (
  club_role_assignment_id uuid not null references public.club_role_assignments(id) on delete cascade,
  permission_key text not null,
  enabled boolean not null,
  updated_by uuid references public.profiles(id) on delete set null,
  updated_at timestamptz not null default timezone('utc', now()),
  primary key (club_role_assignment_id, permission_key)
);

alter table public.club_role_permission_overrides enable row level security;
revoke all on public.club_role_permission_overrides from public, anon, authenticated;
grant select on public.club_role_permission_overrides to authenticated;

create or replace function public.canonical_club_role_type(
  membership_role text, function_role text
) returns text language sql immutable set search_path = public as $$
  select case
    when membership_role in ('club_admin', 'club_admin_viewer') then membership_role
    when coalesce(function_role, membership_role) = 'coach' then 'trainer'
    when coalesce(function_role, membership_role) = 'assistant_coach' then 'assistant_trainer'
    when coalesce(function_role, membership_role) in (
      'club_admin', 'club_admin_viewer', 'president', 'board_member', 'secretary',
      'treasurer', 'youth_coordinator', 'head_youth_development', 'technical_director',
      'trainer', 'assistant_trainer', 'team_manager', 'goalkeeper_coach', 'video_analyst',
      'physiotherapist', 'doctor', 'performance_coach', 'physical_coach',
      'hospitality_worker', 'operator', 'equipment_manager', 'scout', 'communications',
      'match_secretary', 'commercial_manager', 'sponsor_viewer', 'safety_officer',
      'head_referees', 'volunteer', 'club_employee', 'custom'
    ) then coalesce(function_role, membership_role)
    else 'club_employee'
  end
$$;

drop policy if exists club_role_permission_overrides_self_read on public.club_role_permission_overrides;
create policy club_role_permission_overrides_self_read
on public.club_role_permission_overrides for select to authenticated using (
  exists (
    select 1
    from public.club_role_assignments role
    join public.club_people cp on cp.id = role.club_person_id
    join public.person_accounts pa on pa.person_id = cp.person_id
    where role.id = club_role_permission_overrides.club_role_assignment_id
      and pa.profile_id = auth.uid() and pa.status = 'active' and pa.revoked_at is null
  )
);

-- Preserve the explicitly named owner as a platform administrator. Database role remains
-- authoritative; ADMIN_EMAILS can still be used as an emergency deployment allow-list.
update public.profiles
set account_role = 'platform_admin'
where lower(email) = 'jurn@clipboardcoachstudio.com'
  and account_role is distinct from 'platform_admin';

-- Existing RLS policies and SECURITY DEFINER commands already call this function.
-- Repointing it closes the database-level half of the stalled migration as well.
create or replace function public.is_active_club_admin(target_club_id uuid, target_user_id uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from public.profiles profile
    where profile.id = target_user_id and profile.account_role = 'platform_admin'
  ) or exists (
    select 1
    from public.person_accounts account
    join public.club_people club_person on club_person.person_id = account.person_id
    join public.club_role_assignments role on role.club_person_id = club_person.id
    where account.profile_id = target_user_id
      and account.status = 'active' and account.revoked_at is null
      and club_person.club_id = target_club_id and club_person.status = 'active'
      and role.role_type = 'club_admin' and role.status = 'active'
      and role.valid_from <= current_date
      and (role.valid_until is null or role.valid_until >= current_date)
  )
$$;

-- Every active legacy member must have a canonical identity before roles are copied.
do $$
declare member_row record;
begin
  for member_row in
    select club_id, profile_id from public.club_memberships
    where status = 'active' order by club_id, profile_id
  loop
    perform public.ensure_registered_club_identity(
      member_row.profile_id, member_row.club_id, member_row.profile_id
    );
  end loop;
end;
$$;

-- One club-wide assignment carries the function and policy. Team-specific assignments
-- carry the effective team set. This makes none/assigned/all unambiguous.
insert into public.club_role_assignments (
  club_person_id, role_type, club_team_id, team_scope, custom_role_name,
  valid_from, status, created_by
)
select
  cp.id,
  case
    when membership.role in ('club_admin', 'club_admin_viewer') then membership.role
    when coalesce(membership.function_role, membership.role) = 'coach' then 'trainer'
    when coalesce(membership.function_role, membership.role) = 'assistant_coach' then 'assistant_trainer'
    when coalesce(membership.function_role, membership.role) = 'hospitality_worker' then 'hospitality_worker'
    when coalesce(membership.function_role, membership.role) in (
      'club_admin', 'club_admin_viewer', 'president', 'board_member', 'secretary',
      'treasurer', 'youth_coordinator', 'head_youth_development', 'technical_director',
      'trainer', 'assistant_trainer', 'team_manager', 'goalkeeper_coach', 'video_analyst',
      'physiotherapist', 'doctor', 'performance_coach', 'physical_coach', 'operator',
      'equipment_manager', 'scout', 'communications', 'match_secretary',
      'commercial_manager', 'sponsor_viewer', 'safety_officer', 'head_referees',
      'volunteer', 'custom'
    ) then coalesce(membership.function_role, membership.role)
    else 'club_employee'
  end,
  null,
  case when membership.role in ('club_admin', 'club_admin_viewer') then 'all'
       else coalesce(membership.team_scope, 'none') end,
  membership.custom_role_name,
  current_date,
  'active',
  membership.profile_id
from public.club_memberships membership
join public.person_accounts pa on pa.profile_id = membership.profile_id
  and pa.status = 'active' and pa.revoked_at is null
join public.club_people cp on cp.person_id = pa.person_id
  and cp.club_id = membership.club_id and cp.status = 'active'
where membership.status = 'active'
  and not exists (
    select 1 from public.club_role_assignments existing
    where existing.club_person_id = cp.id and existing.club_team_id is null
      and existing.status = 'active'
      and existing.valid_from <= current_date
      and (existing.valid_until is null or existing.valid_until >= current_date)
  );

-- Copy selected legacy team access to canonical team-scoped assignments.
insert into public.club_role_assignments (
  club_person_id, role_type, club_team_id, team_scope, custom_role_name,
  valid_from, status, created_by
)
select base.club_person_id, base.role_type, access.club_team_id, 'assigned',
  base.custom_role_name, current_date, 'active', membership.profile_id
from public.club_member_team_access access
join public.club_memberships membership on membership.club_id = access.club_id
  and membership.profile_id = access.profile_id and membership.status = 'active'
join public.person_accounts pa on pa.profile_id = membership.profile_id
  and pa.status = 'active' and pa.revoked_at is null
join public.club_people cp on cp.person_id = pa.person_id and cp.club_id = membership.club_id
join public.club_role_assignments base on base.club_person_id = cp.id
  and base.club_team_id is null and base.status = 'active'
where not exists (
  select 1 from public.club_role_assignments existing
  where existing.club_person_id = base.club_person_id
    and existing.club_team_id = access.club_team_id
    and existing.status = 'active'
);

-- Preserve legacy explicit allow/deny choices on the canonical base assignment.
insert into public.club_role_permission_overrides (
  club_role_assignment_id, permission_key, enabled, updated_by, updated_at
)
select base.id, permission.permission_key, permission.enabled,
  permission.updated_by, permission.updated_at
from public.club_member_permissions permission
join public.person_accounts pa on pa.profile_id = permission.profile_id
  and pa.status = 'active' and pa.revoked_at is null
join public.club_people cp on cp.person_id = pa.person_id and cp.club_id = permission.club_id
join lateral (
  select id from public.club_role_assignments role
  where role.club_person_id = cp.id and role.club_team_id is null and role.status = 'active'
  order by role.created_at limit 1
) base on true
on conflict (club_role_assignment_id, permission_key) do update set
  enabled = excluded.enabled, updated_by = excluded.updated_by, updated_at = excluded.updated_at;

-- Human-review report. Run before and after deployment; any row other than `unchanged`
-- needs an explicit decision. This intentionally contains names/emails only for admins.
create or replace view public.club_role_migration_audit as
select
  membership.club_id,
  membership.profile_id,
  profile.email,
  profile.full_name,
  membership.role as legacy_role,
  membership.function_role as legacy_function_role,
  membership.team_scope as legacy_team_scope,
  cp.id as club_person_id,
  base.role_type as canonical_role,
  base.team_scope as canonical_team_scope,
  case
    when pa.id is null then 'missing_person_account'
    when cp.id is null then 'missing_club_person'
    when base.id is null then 'missing_canonical_role'
    when base.role_type is distinct from case
      when membership.role in ('club_admin', 'club_admin_viewer') then membership.role
      when coalesce(membership.function_role, membership.role) = 'coach' then 'trainer'
      when coalesce(membership.function_role, membership.role) = 'assistant_coach' then 'assistant_trainer'
      else coalesce(membership.function_role, membership.role)
    end then 'role_differs'
    when base.team_scope is distinct from case
      when membership.role in ('club_admin', 'club_admin_viewer') then 'all'
      else coalesce(membership.team_scope, 'none') end then 'team_scope_differs'
    else 'unchanged'
  end as action_required
from public.club_memberships membership
join public.profiles profile on profile.id = membership.profile_id
left join public.person_accounts pa on pa.profile_id = membership.profile_id
  and pa.status = 'active' and pa.revoked_at is null
left join public.club_people cp on cp.person_id = pa.person_id
  and cp.club_id = membership.club_id and cp.status = 'active'
left join lateral (
  select role.id, role.role_type, role.team_scope
  from public.club_role_assignments role
  where role.club_person_id = cp.id and role.club_team_id is null
    and role.status = 'active' and role.valid_from <= current_date
    and (role.valid_until is null or role.valid_until >= current_date)
  order by role.created_at limit 1
) base on true
where membership.status = 'active';

revoke all on public.club_role_migration_audit from public, anon, authenticated;
grant select on public.club_role_migration_audit to service_role;

-- Keep onboarding and the remaining legacy admin screens from creating new drift.
create or replace function public.sync_membership_identity_projection()
returns trigger language plpgsql security definer set search_path = public as $$
declare
  club_person_id_value uuid;
  base_role_id uuid;
  canonical_role_value text;
  canonical_scope_value text;
begin
  if new.status = 'active' then
    club_person_id_value := public.ensure_registered_club_identity(new.profile_id, new.club_id, new.profile_id);
    canonical_role_value := public.canonical_club_role_type(new.role, new.function_role);
    canonical_scope_value := case when new.role in ('club_admin', 'club_admin_viewer')
      then 'all' else coalesce(new.team_scope, 'none') end;

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
        new.custom_role_name, current_date, 'active', new.profile_id
      );
    else
      update public.club_role_assignments set
        role_type = canonical_role_value,
        team_scope = canonical_scope_value,
        custom_role_name = new.custom_role_name
      where id = base_role_id;
    end if;
    update public.club_role_assignments set role_type = canonical_role_value
    where club_person_id = club_person_id_value and club_team_id is not null
      and status = 'active';
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

drop trigger if exists sync_membership_identity_projection_trigger on public.club_memberships;
create trigger sync_membership_identity_projection_trigger
after insert or update of status, role, function_role, team_scope, custom_role_name
on public.club_memberships
for each row execute function public.sync_membership_identity_projection();

create or replace function public.sync_member_team_access_projection()
returns trigger language plpgsql security definer set search_path = public as $$
declare
  source_row public.club_member_team_access;
  club_person_id_value uuid;
  base_role public.club_role_assignments;
begin
  source_row := case when tg_op = 'DELETE' then old else new end;
  select cp.id into club_person_id_value
  from public.person_accounts pa join public.club_people cp on cp.person_id = pa.person_id
  where pa.profile_id = source_row.profile_id and pa.status = 'active' and pa.revoked_at is null
    and cp.club_id = source_row.club_id and cp.status = 'active';
  if club_person_id_value is null then return source_row; end if;

  if tg_op = 'DELETE' then
    update public.club_role_assignments set status = 'ended', valid_until = greatest(valid_from, current_date),
      ended_at = timezone('utc', now()), end_reason = 'team_access_removed'
    where club_person_id = club_person_id_value and club_team_id = source_row.club_team_id
      and status = 'active';
    return old;
  end if;

  select * into base_role from public.club_role_assignments
  where club_person_id = club_person_id_value and club_team_id is null and status = 'active'
  order by created_at limit 1;
  if base_role.id is not null and not exists (
    select 1 from public.club_role_assignments role
    where role.club_person_id = club_person_id_value
      and role.club_team_id = source_row.club_team_id and role.status = 'active'
  ) then
    insert into public.club_role_assignments(
      club_person_id, role_type, club_team_id, team_scope, custom_role_name,
      valid_from, status, created_by
    ) values (
      club_person_id_value, base_role.role_type, source_row.club_team_id, 'assigned',
      base_role.custom_role_name, current_date, 'active', source_row.profile_id
    );
  end if;
  return new;
end;
$$;

drop trigger if exists sync_member_team_access_projection_trigger on public.club_member_team_access;
create trigger sync_member_team_access_projection_trigger
after insert or delete on public.club_member_team_access
for each row execute function public.sync_member_team_access_projection();

revoke all on function public.canonical_club_role_type(text, text) from public, anon, authenticated;
grant execute on function public.canonical_club_role_type(text, text) to service_role;
