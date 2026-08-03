-- A preparation season starts empty. Club admins explicitly copy or create its teams.

create or replace function public.add_preparation_season_team(
  target_club_id uuid, target_season_id uuid, team_name text
) returns uuid language plpgsql security definer set search_path=public as $$
declare new_team_id uuid; next_order integer;
begin
  if not public.is_active_club_admin(target_club_id,auth.uid()) then raise exception 'SEASON_TEAM_FORBIDDEN'; end if;
  if trim(coalesce(team_name,''))='' then raise exception 'TEAM_NAME_REQUIRED'; end if;
  if not exists(select 1 from public.club_seasons where id=target_season_id and club_id=target_club_id and status='PREPARATION') then raise exception 'TARGET_SEASON_NOT_IN_PREPARATION'; end if;
  select coalesce(max(display_order),-1)+1 into next_order from public.club_teams where club_id=target_club_id and season_id=target_season_id;
  insert into public.club_teams(club_id,name,status,display_order,season_id,created_by,approved_by,approved_at)
  values(target_club_id,trim(team_name),'active',next_order,target_season_id,auth.uid(),auth.uid(),now()) returning id into new_team_id;
  insert into public.teams(coach_id,name,club_name,club_team_id) values(null,trim(team_name),null,new_team_id);
  return new_team_id;
end $$;

create or replace function public.copy_season_team_names(
  target_club_id uuid, source_season_id uuid, target_season_id uuid
) returns jsonb language plpgsql security definer set search_path=public as $$
declare source_team record; copied integer:=0; new_team_id uuid;
begin
  if not public.is_active_club_admin(target_club_id,auth.uid()) then raise exception 'SEASON_TEAM_FORBIDDEN'; end if;
  if source_season_id=target_season_id then raise exception 'SOURCE_AND_TARGET_SEASON_EQUAL'; end if;
  if not exists(select 1 from public.club_seasons where id=target_season_id and club_id=target_club_id and status='PREPARATION') then raise exception 'TARGET_SEASON_NOT_IN_PREPARATION'; end if;
  if not exists(select 1 from public.club_seasons where id=source_season_id and club_id=target_club_id) then raise exception 'SOURCE_SEASON_NOT_FOUND'; end if;
  for source_team in select * from public.club_teams where club_id=target_club_id and season_id=source_season_id and status<>'merged' order by display_order loop
    if not exists(select 1 from public.club_teams where club_id=target_club_id and season_id=target_season_id and lower(name)=lower(source_team.name) and status<>'merged') then
      insert into public.club_teams(club_id,name,status,display_order,trainers_can_edit_roster,trainers_can_manage_matches,season_id,copied_from_team_id,created_by,approved_by,approved_at)
      values(target_club_id,source_team.name,'active',source_team.display_order,source_team.trainers_can_edit_roster,source_team.trainers_can_manage_matches,target_season_id,source_team.id,auth.uid(),auth.uid(),now()) returning id into new_team_id;
      insert into public.teams(coach_id,name,club_name,club_team_id) values(null,source_team.name,null,new_team_id);
      copied:=copied+1;
    end if;
  end loop;
  return jsonb_build_object('copied',copied);
end $$;

create or replace function public.delete_preparation_season_team(
  target_club_id uuid, target_season_id uuid, target_team_id uuid
) returns void language plpgsql security definer set search_path=public as $$
begin
  if not public.is_active_club_admin(target_club_id,auth.uid()) then raise exception 'SEASON_TEAM_FORBIDDEN'; end if;
  if not exists(select 1 from public.club_seasons where id=target_season_id and club_id=target_club_id and status='PREPARATION') then raise exception 'TARGET_SEASON_NOT_IN_PREPARATION'; end if;
  if exists(select 1 from public.player_team_memberships membership join public.teams team on team.id=membership.team_id where team.club_team_id=target_team_id) then raise exception 'TEAM_HAS_ASSIGNED_PLAYERS'; end if;
  delete from public.club_teams where id=target_team_id and club_id=target_club_id and season_id=target_season_id;
  if not found then raise exception 'TEAM_NOT_FOUND_IN_SEASON'; end if;
end $$;

create or replace function public.delete_preparation_season(target_club_id uuid,target_season_id uuid)
returns void language plpgsql security definer set search_path=public as $$
begin
  if not public.is_active_club_admin(target_club_id,auth.uid()) then raise exception 'SEASON_DELETE_FORBIDDEN'; end if;
  if not exists(select 1 from public.club_seasons where id=target_season_id and club_id=target_club_id and status='PREPARATION') then raise exception 'TARGET_SEASON_NOT_IN_PREPARATION'; end if;
  delete from public.player_group_evaluations where season_id=target_season_id;
  delete from public.team_training_sessions where season_id=target_season_id;
  delete from public.matches where season_id=target_season_id;
  delete from public.player_groups where season_id=target_season_id;
  delete from public.club_teams where club_id=target_club_id and season_id=target_season_id;
  delete from public.club_seasons where id=target_season_id and club_id=target_club_id;
end $$;

revoke all on function public.add_preparation_season_team(uuid,uuid,text) from public,anon;
revoke all on function public.copy_season_team_names(uuid,uuid,uuid) from public,anon;
revoke all on function public.delete_preparation_season_team(uuid,uuid,uuid) from public,anon;
revoke all on function public.delete_preparation_season(uuid,uuid) from public,anon;
grant execute on function public.add_preparation_season_team(uuid,uuid,text) to authenticated;
grant execute on function public.copy_season_team_names(uuid,uuid,uuid) to authenticated;
grant execute on function public.delete_preparation_season_team(uuid,uuid,uuid) to authenticated;
grant execute on function public.delete_preparation_season(uuid,uuid) to authenticated;

notify pgrst, 'reload schema';


