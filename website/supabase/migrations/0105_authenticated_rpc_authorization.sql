-- Harden authenticated SECURITY DEFINER helpers against identity substitution and stale membership access.

create or replace function public.can_access_club_match(target_match_id uuid, target_user_id uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select (coalesce(auth.role(), '') <> 'authenticated' or target_user_id = auth.uid())
    and exists (
      select 1
      from public.matches m
      join public.club_memberships cm on cm.club_id = m.club_id
      where m.id = target_match_id
        and cm.profile_id = target_user_id
        and cm.status = 'active'
        and (
          cm.role in ('club_admin', 'club_admin_viewer', 'analyst')
          or exists (
            select 1
            from public.club_trainers ct
            join public.club_match_assignments cma on cma.trainer_id = ct.id
            where ct.club_id = m.club_id
              and ct.profile_id = target_user_id
              and cma.match_id = m.id
              and cma.visible = true
          )
        )
    );
$$;

create or replace function public.is_club_admin_for_match(target_match_id uuid, target_user_id uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select (coalesce(auth.role(), '') <> 'authenticated' or target_user_id = auth.uid())
    and exists (
      select 1 from public.matches m
      join public.club_memberships cm on cm.club_id = m.club_id
      where m.id = target_match_id
        and cm.profile_id = target_user_id
        and cm.role = 'club_admin'
        and cm.status = 'active'
    );
$$;

create or replace function public.club_member_can_access_team(
  target_club_id uuid, target_profile_id uuid, target_club_team_id uuid
) returns boolean
language sql stable security definer set search_path = public as $$
  select (coalesce(auth.role(), '') <> 'authenticated' or target_profile_id = auth.uid())
    and exists (
      select 1 from public.club_memberships membership
      where membership.club_id = target_club_id
        and membership.profile_id = target_profile_id
        and membership.status = 'active'
        and (
          membership.role in ('club_admin', 'club_admin_viewer')
          or membership.team_scope = 'all'
          or (
            membership.team_scope = 'assigned'
            and (
              exists (
                select 1 from public.club_member_team_access access
                where access.club_id = target_club_id
                  and access.profile_id = target_profile_id
                  and access.club_team_id = target_club_team_id
              )
              or exists (
                select 1 from public.club_trainers trainer
                join public.club_trainer_teams assignment on assignment.trainer_id = trainer.id
                where trainer.club_id = target_club_id
                  and trainer.profile_id = target_profile_id
                  and assignment.club_team_id = target_club_team_id
                  and assignment.status = 'active'
              )
            )
          )
        )
    );
$$;

create or replace function public.guardian_operational_player_ids(target_user_id uuid)
returns setof uuid
language sql stable security definer set search_path = public as $$
  select pg.player_id
  from public.player_guardians pg
  where (coalesce(auth.role(), '') <> 'authenticated' or target_user_id = auth.uid())
    and pg.profile_id = target_user_id and pg.player_id is not null
    and pg.revoked_at is null and (pg.valid_until is null or pg.valid_until > now())
  union
  select p.id
  from public.player_guardians pg
  join public.player_team_memberships ptm on ptm.club_player_id = pg.club_player_id
  join public.club_seasons cs on cs.id = ptm.season_id
  join public.players p on p.membership_id = ptm.id
  where (coalesce(auth.role(), '') <> 'authenticated' or target_user_id = auth.uid())
    and pg.profile_id = target_user_id and pg.club_player_id is not null
    and pg.revoked_at is null and (pg.valid_until is null or pg.valid_until > now())
    and (
      pg.access_scope = 'all_history'
      or (pg.access_scope = 'current_season' and cs.is_active)
      or (pg.access_scope = 'from_acceptance' and coalesce(cs.ends_on, 'infinity'::date) >= pg.valid_from::date)
    );
$$;

create or replace function public.guardian_club_player_ids(target_user_id uuid)
returns setof uuid
language sql stable security definer set search_path = public as $$
  select pg.club_player_id
  from public.player_guardians pg
  where (coalesce(auth.role(), '') <> 'authenticated' or target_user_id = auth.uid())
    and pg.profile_id = target_user_id and pg.club_player_id is not null
    and pg.revoked_at is null and (pg.valid_until is null or pg.valid_until > now());
$$;

create or replace function public.can_view_match_report(target_match_id uuid, target_user_id uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select (coalesce(auth.role(), '') <> 'authenticated' or target_user_id = auth.uid())
    and exists (
      select 1
      from public.matches match
      join public.club_memberships membership on membership.club_id = match.club_id
      where match.id = target_match_id
        and membership.profile_id = target_user_id
        and membership.status = 'active'
        and (
          membership.role in ('club_admin', 'club_admin_viewer')
          or exists (
            select 1 from public.club_member_permissions permission
            where permission.club_id = match.club_id
              and permission.profile_id = target_user_id
              and permission.permission_key = 'games.report.view'
              and permission.enabled = true
          )
        )
    );
$$;

create or replace function public.resolve_primary_membership(
  target_club_player_id uuid, target_team_id uuid
) returns void
language plpgsql security definer set search_path = public as $$
declare
  v_season_id uuid;
begin
  if not public.can_manage_team_membership(target_team_id, auth.uid()) then
    raise exception 'RESOLVE_PRIMARY_FORBIDDEN';
  end if;

  select season_id into v_season_id from public.player_team_memberships
  where club_player_id = target_club_player_id and team_id = target_team_id and status = 'active';
  if v_season_id is null then raise exception 'MEMBERSHIP_NOT_FOUND'; end if;

  if exists (
    select 1 from public.player_team_memberships membership
    where membership.club_player_id = target_club_player_id
      and membership.season_id = v_season_id
      and membership.team_id <> target_team_id
      and membership.status = 'active'
      and membership.membership_type = 'primary'
      and not public.can_manage_team_membership(membership.team_id, auth.uid())
  ) then
    raise exception 'RESOLVE_PRIMARY_CROSS_TEAM_FORBIDDEN';
  end if;

  update public.player_team_memberships set membership_type = 'secondary'
  where club_player_id = target_club_player_id and season_id = v_season_id
    and team_id <> target_team_id and status = 'active' and membership_type = 'primary';

  update public.player_team_memberships set membership_type = 'primary'
  where club_player_id = target_club_player_id and team_id = target_team_id
    and season_id = v_season_id and status = 'active';

  update public.club_player_migration_issues
  set status = 'resolved', resolved_at = now(), resolved_by = auth.uid()
  where issue_type = 'unassigned_primary_team' and status = 'open'
    and candidate_club_player_id = target_club_player_id
    and (details->>'season_id')::uuid = v_season_id;
end;
$$;

revoke all on function public.can_access_club_match(uuid, uuid) from public, anon;
revoke all on function public.is_club_admin_for_match(uuid, uuid) from public, anon;
revoke all on function public.club_member_can_access_team(uuid, uuid, uuid) from public, anon;
revoke all on function public.guardian_operational_player_ids(uuid) from public, anon;
revoke all on function public.guardian_club_player_ids(uuid) from public, anon;
revoke all on function public.guardian_team_ids(uuid) from public, anon;
revoke all on function public.can_guardian_view_clip(uuid, uuid) from public, anon;
revoke all on function public.can_guardian_view_match(uuid, uuid) from public, anon;
revoke all on function public.can_view_match_report(uuid, uuid) from public, anon;
revoke all on function public.resolve_primary_membership(uuid, uuid) from public, anon;

grant execute on function public.can_access_club_match(uuid, uuid) to authenticated;
grant execute on function public.is_club_admin_for_match(uuid, uuid) to authenticated;
grant execute on function public.club_member_can_access_team(uuid, uuid, uuid) to authenticated;
grant execute on function public.guardian_operational_player_ids(uuid) to authenticated;
grant execute on function public.guardian_club_player_ids(uuid) to authenticated;
grant execute on function public.guardian_team_ids(uuid) to authenticated;
grant execute on function public.can_guardian_view_clip(uuid, uuid) to authenticated;
grant execute on function public.can_guardian_view_match(uuid, uuid) to authenticated;
grant execute on function public.can_view_match_report(uuid, uuid) to authenticated;
grant execute on function public.resolve_primary_membership(uuid, uuid) to authenticated;

notify pgrst, 'reload schema';

