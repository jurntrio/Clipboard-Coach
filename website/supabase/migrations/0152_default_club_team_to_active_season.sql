-- Keep direct and legacy club-team creation aligned with the required season model.
-- In August 2026, current_football_season_bounds() resolves to 2026-2027.

create or replace function public.default_club_team_season()
returns trigger
language plpgsql
security definer
set search_path = public as $$
begin
  if new.season_id is null then
    new.season_id := public.ensure_active_club_season(new.club_id);
  end if;
  return new;
end;
$$;

drop trigger if exists club_teams_default_season on public.club_teams;
create trigger club_teams_default_season
before insert on public.club_teams
for each row execute function public.default_club_team_season();

revoke all on function public.default_club_team_season() from public, anon, authenticated;

