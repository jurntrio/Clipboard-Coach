-- Mailboxdoelgroepen afschermen en strikt aan de gekozen club koppelen.
revoke all on function public.club_team_staff_profile_ids(uuid, uuid) from public, anon, authenticated;
grant execute on function public.club_team_staff_profile_ids(uuid, uuid) to service_role;

create or replace function public.club_team_staff_profile_ids(
  target_club_id uuid, target_club_team_id uuid
) returns setof uuid
language sql stable security definer set search_path = public as $$
  select membership.profile_id
  from public.club_memberships membership
  join public.club_teams team
    on team.id = target_club_team_id and team.club_id = membership.club_id
  where membership.club_id = target_club_id
    and membership.status = 'active'
    and public.club_member_can_access_team(target_club_id, membership.profile_id, target_club_team_id);
$$;

drop function if exists public.club_team_contact_profile_ids(uuid);

create or replace function public.club_team_contact_profile_ids(
  target_club_id uuid, target_club_team_id uuid
) returns setof uuid
language sql stable security definer set search_path = public as $$
  select distinct pg.profile_id
  from public.player_guardians pg
  join public.players p on p.id = pg.player_id
  join public.teams t on t.id = p.team_id
  join public.club_teams ct on ct.id = t.club_team_id and ct.club_id = target_club_id
  where t.club_team_id = target_club_team_id
    and pg.player_id is not null
    and pg.revoked_at is null and (pg.valid_until is null or pg.valid_until > now())
  union
  select distinct pg.profile_id
  from public.player_guardians pg
  join public.player_team_memberships ptm on ptm.club_player_id = pg.club_player_id
  join public.club_seasons cs on cs.id = ptm.season_id
  join public.players p on p.membership_id = ptm.id
  join public.teams t on t.id = p.team_id
  join public.club_teams ct on ct.id = t.club_team_id and ct.club_id = target_club_id
  where t.club_team_id = target_club_team_id
    and pg.club_player_id is not null
    and pg.revoked_at is null and (pg.valid_until is null or pg.valid_until > now())
    and (
      pg.access_scope = 'all_history'
      or (pg.access_scope = 'current_season' and cs.is_active)
      or (pg.access_scope = 'from_acceptance' and coalesce(cs.ends_on, 'infinity'::date) >= pg.valid_from::date)
    );
$$;

revoke all on function public.club_team_contact_profile_ids(uuid, uuid) from public, anon, authenticated;
grant execute on function public.club_team_contact_profile_ids(uuid, uuid) to service_role;

notify pgrst, 'reload schema';
