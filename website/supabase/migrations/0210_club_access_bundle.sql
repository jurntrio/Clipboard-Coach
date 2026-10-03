-- Read-only bundle; deployment is intentionally separate from the application.
create or replace function public.club_access_bundle(p_club_id uuid, p_user_id uuid)
returns jsonb
language sql stable security definer
set search_path = pg_catalog
as $$
with account as (
  select person_id from public.person_accounts
  where profile_id = p_user_id and status = 'active' and revoked_at is null
), person as (
  select cp.id from public.club_people cp join account a on a.person_id = cp.person_id
  where cp.club_id = p_club_id and cp.status = 'active'
), roles as (
  select r.id, r.role_type, r.club_team_id, r.team_scope, r.valid_from, r.valid_until,
    coalesce((select jsonb_agg(jsonb_build_object('permission_key', o.permission_key, 'enabled', o.enabled))
      from public.club_role_permission_overrides o where o.club_role_assignment_id = r.id), '[]'::jsonb)
      as club_role_permission_overrides
  from public.club_role_assignments r join person p on p.id = r.club_person_id
  where r.status = 'active' and r.valid_from <= (now() at time zone 'UTC')::date
    and (r.valid_until is null or r.valid_until >= (now() at time zone 'UTC')::date)
), trainer as (
  select t.id from public.club_trainers t join person p on p.id = t.club_person_id
  where t.club_id = p_club_id
)
select jsonb_build_object(
  'profile', (select jsonb_build_object('account_role', account_role) from public.profiles where id = p_user_id),
  'clubPerson', (select jsonb_build_object('id', id) from person),
  'roles', coalesce((select jsonb_agg(to_jsonb(r)) from roles r), '[]'::jsonb),
  'trainer', (select jsonb_build_object('id', id) from trainer),
  'configuredDefaults', coalesce((select jsonb_agg(jsonb_build_object('function_role', function_role,
    'permission_key', permission_key, 'enabled', enabled)) from public.club_role_permission_defaults
    where club_id = p_club_id), '[]'::jsonb),
  'playerAssignments', coalesce((select jsonb_agg(jsonb_build_object('player_groups', jsonb_build_object(
    'player_group_players', coalesce((select jsonb_agg(jsonb_build_object('player_id', gp.player_id,
      'valid_until', gp.valid_until)) from public.player_group_players gp where gp.group_id = g.id), '[]'::jsonb))))
    from public.player_group_staff s join trainer t on t.id = s.trainer_id
    join public.player_groups g on g.id = s.group_id where g.active = true
      and exists (select 1 from roles where role_type = 'goalkeeper_coach')), '[]'::jsonb)
);
$$;

revoke all on function public.club_access_bundle(uuid, uuid) from public, anon, authenticated;
grant execute on function public.club_access_bundle(uuid, uuid) to service_role;
