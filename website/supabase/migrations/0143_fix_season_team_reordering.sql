-- Reorder only the teams belonging to the season shown in Clubbeheer.
-- Explicit aliases also avoid PostgreSQL resolving an unqualified `id`
-- against both the unnested array and club_teams.
create or replace function public.reorder_club_teams(target_club_id uuid, ordered_team_ids uuid[])
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  target_season_id uuid;
begin
  if coalesce(array_length(ordered_team_ids, 1), 0) = 0 then
    raise exception 'De ploegvolgorde is ongeldig of onvolledig.';
  end if;

  select team.season_id into target_season_id
  from public.club_teams as team
  where team.id = ordered_team_ids[1]
    and team.club_id = target_club_id
    and team.status <> 'merged';

  if not found or coalesce(array_length(ordered_team_ids, 1), 0) <> (
    select count(*)
    from public.club_teams as team
    where team.club_id = target_club_id
      and team.status <> 'merged'
      and team.season_id is not distinct from target_season_id
  ) or exists (
    select 1
    from unnest(ordered_team_ids) as listed(team_id)
    left join public.club_teams as team
      on team.id = listed.team_id
      and team.club_id = target_club_id
      and team.status <> 'merged'
      and team.season_id is not distinct from target_season_id
    where team.id is null
  ) or (
    select count(distinct listed.team_id)
    from unnest(ordered_team_ids) as listed(team_id)
  ) <> coalesce(array_length(ordered_team_ids, 1), 0) then
    raise exception 'De ploegvolgorde is ongeldig of onvolledig.';
  end if;

  update public.club_teams as team
  set display_order = ordered.position - 1
  from unnest(ordered_team_ids) with ordinality as ordered(team_id, position)
  where team.id = ordered.team_id
    and team.club_id = target_club_id
    and team.season_id is not distinct from target_season_id;
end;
$$;

revoke all on function public.reorder_club_teams(uuid, uuid[]) from public, anon, authenticated;

notify pgrst, 'reload schema';
