create or replace function public.rename_preparation_season_team(
  target_club_id uuid, target_season_id uuid, target_team_id uuid, team_name text
) returns void language plpgsql security definer set search_path=public as $$
begin
  if not public.is_active_club_admin(target_club_id,auth.uid()) then raise exception 'SEASON_TEAM_FORBIDDEN'; end if;
  if trim(coalesce(team_name,''))='' then raise exception 'TEAM_NAME_REQUIRED'; end if;
  if not exists(select 1 from public.club_seasons where id=target_season_id and club_id=target_club_id and status='PREPARATION') then raise exception 'TARGET_SEASON_NOT_IN_PREPARATION'; end if;
  update public.club_teams set name=trim(team_name), normalized_name=lower(trim(team_name))
  where id=target_team_id and club_id=target_club_id and season_id=target_season_id;
  if not found then raise exception 'TEAM_NOT_FOUND_IN_SEASON'; end if;
  update public.teams set name=trim(team_name) where club_team_id=target_team_id;
end $$;

revoke all on function public.rename_preparation_season_team(uuid,uuid,uuid,text) from public,anon;
grant execute on function public.rename_preparation_season_team(uuid,uuid,uuid,text) to authenticated;
notify pgrst, 'reload schema';
