-- Remove advancement decisions before their memberships. Otherwise the
-- membership ON DELETE SET NULL action temporarily violates the TEAM check.

create or replace function public.delete_preparation_season(target_club_id uuid,target_season_id uuid)
returns void language plpgsql security definer set search_path=public as $$
begin
  if not public.is_active_club_admin(target_club_id,auth.uid()) then raise exception 'SEASON_DELETE_FORBIDDEN'; end if;
  if not exists(select 1 from public.club_seasons where id=target_season_id and club_id=target_club_id and status='PREPARATION') then raise exception 'TARGET_SEASON_NOT_IN_PREPARATION'; end if;

  delete from public.season_player_decisions where club_id=target_club_id and season_id=target_season_id;
  delete from public.player_team_memberships membership
  using public.teams team, public.club_teams club_team
  where membership.team_id=team.id
    and team.club_team_id=club_team.id
    and club_team.club_id=target_club_id
    and club_team.season_id=target_season_id;
  delete from public.player_group_evaluations where season_id=target_season_id;
  delete from public.team_training_sessions where season_id=target_season_id;
  delete from public.matches where season_id=target_season_id;
  delete from public.player_groups where season_id=target_season_id;
  delete from public.club_teams where club_id=target_club_id and season_id=target_season_id;
  delete from public.club_seasons where id=target_season_id and club_id=target_club_id;
end $$;

revoke all on function public.delete_preparation_season(uuid,uuid) from public,anon;
grant execute on function public.delete_preparation_season(uuid,uuid) to authenticated;

notify pgrst, 'reload schema';
