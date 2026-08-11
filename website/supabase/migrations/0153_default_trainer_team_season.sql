-- Trainer assignments belong to the same season as their club team.
-- Keep legacy functions and direct inserts compatible with the required season column.

create or replace function public.default_club_trainer_team_season()
returns trigger
language plpgsql
security definer
set search_path = public as $$
begin
  if new.season_id is null then
    select season_id into new.season_id
    from public.club_teams
    where id = new.club_team_id;
  end if;
  return new;
end;
$$;

drop trigger if exists club_trainer_teams_default_season on public.club_trainer_teams;
create trigger club_trainer_teams_default_season
before insert or update of club_team_id on public.club_trainer_teams
for each row execute function public.default_club_trainer_team_season();

revoke all on function public.default_club_trainer_team_season() from public, anon, authenticated;

