-- Transactional preparation of season-bound team staff and Extra-group composition.

create or replace function public.set_season_team_staff(
  target_club_id uuid,target_season_id uuid,target_club_team_id uuid,target_trainer_ids uuid[],staff_role text default 'coach'
) returns integer language plpgsql security definer set search_path=public as $$
declare operational_team_id uuid; trainer_row record; assigned_count integer:=0;
begin
  if not public.is_active_club_admin(target_club_id,auth.uid()) then raise exception 'SEASON_STAFF_FORBIDDEN'; end if;
  if staff_role not in ('coach','assistant_coach','team_manager') then raise exception 'INVALID_STAFF_ROLE'; end if;
  if not exists(select 1 from public.club_seasons where id=target_season_id and club_id=target_club_id and status='PREPARATION') then raise exception 'TARGET_SEASON_NOT_IN_PREPARATION'; end if;
  select team.id into operational_team_id from public.club_teams club_team join public.teams team on team.club_team_id=club_team.id
    where club_team.id=target_club_team_id and club_team.club_id=target_club_id and club_team.season_id=target_season_id;
  if operational_team_id is null then raise exception 'TARGET_TEAM_NOT_IN_SEASON'; end if;
  if exists(select 1 from unnest(target_trainer_ids) id left join public.club_trainers trainer on trainer.id=id and trainer.club_id=target_club_id where trainer.id is null) then raise exception 'TRAINER_NOT_IN_CLUB'; end if;
  delete from public.team_staff_members member using public.club_trainers trainer
    where member.team_id=operational_team_id and member.user_id=trainer.profile_id and trainer.club_id=target_club_id
      and not (trainer.id=any(target_trainer_ids));
  delete from public.club_trainer_teams assignment where assignment.club_team_id=target_club_team_id and assignment.season_id=target_season_id
    and not (assignment.trainer_id=any(target_trainer_ids));
  for trainer_row in select * from public.club_trainers where club_id=target_club_id and id=any(target_trainer_ids) loop
    insert into public.club_trainer_teams(trainer_id,club_team_id,season_id,role,status)
    values(trainer_row.id,target_club_team_id,target_season_id,staff_role,'active')
    on conflict(trainer_id,club_team_id) do update set season_id=excluded.season_id,role=excluded.role,status='active';
    if trainer_row.profile_id is not null then
      insert into public.team_staff_members(team_id,user_id,added_by) values(operational_team_id,trainer_row.profile_id,auth.uid())
      on conflict(team_id,user_id) do nothing;
    end if;
    assigned_count:=assigned_count+1;
  end loop;
  return assigned_count;
end $$;

create or replace function public.set_season_group_composition(
  target_club_id uuid,target_season_id uuid,target_group_id uuid,target_player_ids uuid[],target_trainer_ids uuid[]
) returns jsonb language plpgsql security definer set search_path=public as $$
declare season_start date; today_marker date; player_id uuid; trainer_id uuid;
begin
  if not public.is_active_club_admin(target_club_id,auth.uid()) then raise exception 'SEASON_GROUP_FORBIDDEN'; end if;
  select starts_on into season_start from public.club_seasons where id=target_season_id and club_id=target_club_id and status='PREPARATION';
  if season_start is null then raise exception 'TARGET_SEASON_NOT_IN_PREPARATION'; end if;
  if not exists(select 1 from public.player_groups where id=target_group_id and club_id=target_club_id and season_id=target_season_id) then raise exception 'GROUP_NOT_IN_SEASON'; end if;
  if exists(select 1 from unnest(target_player_ids) id left join public.players player on player.id=id
    left join public.player_team_memberships membership on membership.id=player.membership_id
    where player.id is null or membership.season_id<>target_season_id or membership.status<>'active') then raise exception 'PLAYER_NOT_IN_TARGET_SEASON'; end if;
  if exists(select 1 from unnest(target_trainer_ids) id left join public.club_trainers trainer on trainer.id=id and trainer.club_id=target_club_id where trainer.id is null) then raise exception 'TRAINER_NOT_IN_CLUB'; end if;
  today_marker:=season_start;
  update public.player_group_players set valid_until=today_marker where group_id=target_group_id and valid_until is null and not(player_id=any(target_player_ids));
  foreach player_id in array target_player_ids loop
    insert into public.player_group_players(group_id,player_id,valid_from,valid_until,added_by)
    values(target_group_id,player_id,today_marker,null,auth.uid())
    on conflict(group_id,player_id) do update set valid_from=excluded.valid_from,valid_until=null,added_by=auth.uid(),added_at=now();
  end loop;
  delete from public.player_group_staff where group_id=target_group_id and not(trainer_id=any(target_trainer_ids));
  foreach trainer_id in array target_trainer_ids loop
    insert into public.player_group_staff(group_id,trainer_id,added_by) values(target_group_id,trainer_id,auth.uid())
    on conflict(group_id,trainer_id) do nothing;
  end loop;
  return jsonb_build_object('players',cardinality(target_player_ids),'staff',cardinality(target_trainer_ids));
end $$;

revoke all on function public.set_season_team_staff(uuid,uuid,uuid,uuid[],text) from public,anon;
revoke all on function public.set_season_group_composition(uuid,uuid,uuid,uuid[],uuid[]) from public,anon;
grant execute on function public.set_season_team_staff(uuid,uuid,uuid,uuid[],text) to authenticated;
grant execute on function public.set_season_group_composition(uuid,uuid,uuid,uuid[],uuid[]) to authenticated;
notify pgrst, 'reload schema';
