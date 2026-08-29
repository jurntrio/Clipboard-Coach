-- Preserve the effective legacy semantics for mixed analyst/trainer rows.
-- The old getClubAccess() treated membership.role = analyst as analyst access when the
-- function role was only the generic trainer label.

create or replace function public.canonical_club_role_type(
  membership_role text, function_role text
) returns text language sql immutable set search_path = public as $$
  select case
    when membership_role in ('club_admin', 'club_admin_viewer') then membership_role
    when membership_role = 'analyst'
      and coalesce(function_role, 'trainer') in ('trainer', 'video_analyst') then 'video_analyst'
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

update public.club_role_assignments role
set role_type = 'video_analyst', updated_at = timezone('utc', now())
from public.club_memberships membership
join public.person_accounts account on account.profile_id = membership.profile_id
  and account.status = 'active' and account.revoked_at is null
join public.club_people club_person on club_person.person_id = account.person_id
  and club_person.club_id = membership.club_id and club_person.status = 'active'
where role.club_person_id = club_person.id
  and role.status = 'active'
  and membership.status = 'active'
  and membership.role = 'analyst'
  and coalesce(membership.function_role, 'trainer') in ('trainer', 'video_analyst')
  and role.role_type = 'trainer';

-- Confirmed manual reconciliation for Tommy Lingier:
-- video analyst for the three named teams in the active season, and contact for Arven.
do $$
declare
  tommy_profile_id uuid;
  tommy_club_person_id uuid;
  target_club_id uuid;
  arven_club_player_id uuid;
  active_season_id uuid;
  target_team_ids uuid[];
begin
  select id into strict tommy_profile_id
  from public.profiles
  where lower(email) = 'tommy.lingier@telenet.be';

  select cp.id, cp.club_id into strict tommy_club_person_id, target_club_id
  from public.person_accounts pa
  join public.club_people cp on cp.person_id = pa.person_id and cp.status = 'active'
  where pa.profile_id = tommy_profile_id
    and pa.status = 'active' and pa.revoked_at is null;

  select id into strict active_season_id
  from public.club_seasons
  where club_id = target_club_id and status = 'ACTIVE' and is_active = true;

  select array_agg(id order by name) into target_team_ids
  from public.club_teams
  where club_id = target_club_id and season_id = active_season_id and status = 'active'
    and name in ('IP U13 Groen', 'IP U13 Zwart', 'IP U15');
  if coalesce(array_length(target_team_ids, 1), 0) <> 3 then
    raise exception 'TOMMY_TARGET_TEAMS_NOT_UNIQUE';
  end if;

  update public.club_memberships set
    role = 'analyst', function_role = 'video_analyst', team_scope = 'assigned'
  where club_id = target_club_id and profile_id = tommy_profile_id and status = 'active';
  if not found then raise exception 'TOMMY_ACTIVE_MEMBERSHIP_NOT_FOUND'; end if;

  delete from public.club_member_team_access
  where club_id = target_club_id and profile_id = tommy_profile_id;
  insert into public.club_member_team_access(club_id, profile_id, club_team_id)
  select target_club_id, tommy_profile_id, unnest(target_team_ids);

  -- Remove any team roles originating from an older projection and recreate the exact set.
  update public.club_role_assignments set
    status = 'ended', valid_until = greatest(valid_from, current_date),
    ended_at = timezone('utc', now()), ended_by = tommy_profile_id,
    end_reason = 'manual_role_reconciliation_0182'
  where club_person_id = tommy_club_person_id and club_team_id is not null and status = 'active';
  insert into public.club_role_assignments(
    club_person_id, role_type, club_team_id, team_scope, valid_from, status, created_by
  )
  select tommy_club_person_id, 'video_analyst', team_id, 'assigned',
    current_date, 'active', tommy_profile_id
  from unnest(target_team_ids) team_id;

  select id into strict arven_club_player_id
  from public.club_players
  where club_id = target_club_id
    and lower(first_name) = 'arven' and lower(last_name) = 'lingier';

  insert into public.player_guardians(
    club_player_id, player_id, profile_id, access_scope, valid_from,
    valid_until, revoked_at
  ) values (
    arven_club_player_id, null, tommy_profile_id, 'from_acceptance',
    timezone('utc', now()), null, null
  )
  on conflict (club_player_id, profile_id) do update set
    revoked_at = null, valid_until = null, valid_from = excluded.valid_from;
end;
$$;
