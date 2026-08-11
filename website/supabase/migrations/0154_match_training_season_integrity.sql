-- club_teams/club_trainer_teams/player_groups already default their season_id from
-- the linked club (0152, 0153). matches and team_training_sessions were left out:
-- season_id there is nullable and no insert path (app code or otherwise, including
-- a client-side insert in MatchLauncher.tsx that never passes through an API route)
-- ever sets it, so season-scoped queries (e.g. the season archive) silently skip
-- those rows. Derive it from the row's own club_team_id -- not "the club's active
-- season" -- because a team already advanced into next season's PREPARATION still
-- has matches/trainings recorded against the season it actually belongs to.

create or replace function public.sync_match_training_season_from_club_team()
returns trigger
language plpgsql
security definer
set search_path = public as $$
begin
  if new.club_team_id is not null then
    select season_id into new.season_id from public.club_teams where id = new.club_team_id;
  end if;
  return new;
end;
$$;

revoke all on function public.sync_match_training_season_from_club_team() from public, anon, authenticated;

-- Backfill existing rows that were inserted before this trigger existed.
update public.matches m set season_id = ct.season_id
from public.club_teams ct where m.club_team_id = ct.id and m.season_id is null;

update public.team_training_sessions t set season_id = ct.season_id
from public.club_teams ct where t.club_team_id = ct.id and t.season_id is null;

drop trigger if exists sync_match_season_trigger on public.matches;
create trigger sync_match_season_trigger
before insert or update of club_team_id on public.matches
for each row execute function public.sync_match_training_season_from_club_team();

drop trigger if exists sync_training_season_trigger on public.team_training_sessions;
create trigger sync_training_season_trigger
before insert or update of club_team_id on public.team_training_sessions
for each row execute function public.sync_match_training_season_from_club_team();

alter table public.matches drop constraint if exists matches_club_team_requires_season;
alter table public.matches add constraint matches_club_team_requires_season
  check (club_team_id is null or season_id is not null);

alter table public.team_training_sessions drop constraint if exists training_sessions_club_team_requires_season;
alter table public.team_training_sessions add constraint training_sessions_club_team_requires_season
  check (club_team_id is null or season_id is not null);

notify pgrst, 'reload schema';
