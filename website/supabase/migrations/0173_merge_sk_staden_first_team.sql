-- SK Staden had two active club-team rows for the same first team. Keep the
-- trainer-facing "1e ploeg" row and move the operational roster underneath it
-- before marking the duplicate as merged.
do $$
declare
  target_team constant uuid := '9395ae87-7e4d-43ae-8198-3e3e4f9d3d21';
  source_team constant uuid := 'eb5a1314-8acd-4c60-becf-9f96e9c8ca7f';
  sk_staden constant uuid := '884cc7bb-5827-42db-90e1-25cda79ce38b';
begin
  if exists (
    select 1 from public.club_teams
    where id = target_team and club_id = sk_staden and status = 'active'
  ) and exists (
    select 1 from public.club_teams
    where id = source_team and club_id = sk_staden and status = 'active'
  ) then
    update public.teams
    set club_team_id = target_team, name = '1e ploeg', club_name = 'SK Staden'
    where club_team_id = source_team;

    update public.club_teams target
    set age_category = coalesce(target.age_category, source.age_category),
        match_format = coalesce(target.match_format, source.match_format),
        match_period_count = coalesce(target.match_period_count, source.match_period_count),
        match_period_minutes = coalesce(target.match_period_minutes, source.match_period_minutes),
        match_minimum_players = coalesce(target.match_minimum_players, source.match_minimum_players),
        sponsor_source = case when target.sponsor_source = 'none' then source.sponsor_source else target.sponsor_source end,
        updated_at = now()
    from public.club_teams source
    where target.id = target_team and source.id = source_team;

    perform public.merge_club_teams(source_team, target_team, null, true);
  end if;
end;
$$;
