-- Player advancement: one persistent club_player, one primary assignment per season.

create or replace function public.seed_season_player_decisions(target_club_id uuid, source_season_id uuid, target_season_id uuid)
returns integer language plpgsql security definer set search_path=public as $$
declare inserted_count integer;
begin
  if not public.is_active_club_admin(target_club_id, auth.uid()) then raise exception 'SEASON_ADVANCE_FORBIDDEN'; end if;
  if not exists(select 1 from public.club_seasons where id=target_season_id and club_id=target_club_id and status='PREPARATION') then raise exception 'TARGET_SEASON_NOT_IN_PREPARATION'; end if;
  insert into public.season_player_decisions(club_id,season_id,club_player_id,decision,updated_by)
  select target_club_id,target_season_id,membership.club_player_id,'UNDECIDED',auth.uid()
  from public.player_team_memberships membership join public.club_players player on player.id=membership.club_player_id
  where player.club_id=target_club_id and membership.season_id=source_season_id and membership.status='active' and membership.membership_type='primary'
  on conflict(season_id,club_player_id) do nothing;
  get diagnostics inserted_count = row_count;
  return inserted_count;
end $$;

create or replace function public.advance_season_players(
  target_club_id uuid, target_season_id uuid, club_player_ids uuid[], new_decision text, target_club_team_id uuid default null
) returns jsonb language plpgsql security definer set search_path=public as $$
declare player_id uuid; operational_team_id uuid; membership_id_value uuid; existing_decision record; player_row record; changed integer:=0;
begin
  if not public.is_active_club_admin(target_club_id,auth.uid()) then raise exception 'SEASON_ADVANCE_FORBIDDEN'; end if;
  if new_decision not in ('TEAM','UNDECIDED','LEAVING') then raise exception 'INVALID_DECISION'; end if;
  if not exists(select 1 from public.club_seasons where id=target_season_id and club_id=target_club_id and status='PREPARATION') then raise exception 'TARGET_SEASON_NOT_IN_PREPARATION'; end if;
  if new_decision='TEAM' then
    select team.id into operational_team_id from public.teams team join public.club_teams club_team on club_team.id=team.club_team_id
    where club_team.id=target_club_team_id and club_team.club_id=target_club_id and club_team.season_id=target_season_id;
    if operational_team_id is null then raise exception 'TARGET_TEAM_NOT_IN_SEASON'; end if;
  end if;
  foreach player_id in array club_player_ids loop
    perform pg_advisory_xact_lock(hashtextextended(player_id::text||target_season_id::text,0));
    select * into player_row from public.club_players where id=player_id and club_id=target_club_id;
    if not found then raise exception 'PLAYER_NOT_IN_CLUB'; end if;
    select * into existing_decision from public.season_player_decisions where season_id=target_season_id and club_player_id=player_id for update;
    if new_decision='TEAM' then
      if existing_decision.decision='TEAM' and exists(select 1 from public.player_team_memberships where id=existing_decision.membership_id and team_id=operational_team_id and status='active') then
        continue;
      end if;
      if existing_decision.membership_id is not null then
        if exists(select 1 from public.player_team_memberships where club_player_id=player_id and season_id=target_season_id and team_id=operational_team_id and id<>existing_decision.membership_id) then raise exception 'PLAYER_ALREADY_HAS_TARGET_MEMBERSHIP'; end if;
        update public.player_team_memberships set team_id=operational_team_id,status='active',membership_type='primary',left_at=null,valid_until=null where id=existing_decision.membership_id returning id into membership_id_value;
        update public.players set team_id=operational_team_id where membership_id=membership_id_value;
      else
        insert into public.player_team_memberships(club_player_id,team_id,season_id,membership_type,status,joined_at,valid_from)
        select player_id,operational_team_id,target_season_id,'primary','active',starts_on,starts_on from public.club_seasons where id=target_season_id
        returning id into membership_id_value;
        insert into public.players(team_id,first_name,last_name,date_of_birth,email,phone_numbers,role,membership_id)
        values(operational_team_id,player_row.first_name,player_row.last_name,player_row.date_of_birth,player_row.email,
          case when coalesce(player_row.phone,'')='' then '{}'::text[] else array[player_row.phone] end,'player',membership_id_value);
      end if;
      insert into public.season_player_decisions(club_id,season_id,club_player_id,decision,membership_id,updated_by,updated_at)
      values(target_club_id,target_season_id,player_id,'TEAM',membership_id_value,auth.uid(),now())
      on conflict(season_id,club_player_id) do update set decision='TEAM',membership_id=excluded.membership_id,updated_by=auth.uid(),updated_at=now();
    else
      if existing_decision.membership_id is not null then
        update public.player_team_memberships set status='ended',left_at=greatest(joined_at,(select starts_on from public.club_seasons where id=target_season_id)),valid_until=(select starts_on from public.club_seasons where id=target_season_id) where id=existing_decision.membership_id;
      end if;
      insert into public.season_player_decisions(club_id,season_id,club_player_id,decision,membership_id,updated_by,updated_at)
      values(target_club_id,target_season_id,player_id,new_decision,null,auth.uid(),now())
      on conflict(season_id,club_player_id) do update set decision=excluded.decision,membership_id=null,updated_by=auth.uid(),updated_at=now();
    end if;
    changed:=changed+1;
  end loop;
  return jsonb_build_object('changed',changed);
end $$;

revoke all on function public.seed_season_player_decisions(uuid,uuid,uuid) from public,anon;
revoke all on function public.advance_season_players(uuid,uuid,uuid[],text,uuid) from public,anon;
grant execute on function public.seed_season_player_decisions(uuid,uuid,uuid) to authenticated;
grant execute on function public.advance_season_players(uuid,uuid,uuid[],text,uuid) to authenticated;
notify pgrst, 'reload schema';


