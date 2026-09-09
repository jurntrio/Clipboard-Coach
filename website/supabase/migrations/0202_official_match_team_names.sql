alter table public.matches
  add column if not exists official_home_team_name text,
  add column if not exists official_away_team_name text;

comment on column public.matches.official_home_team_name is
  'Official home-team name from the federation/import source, used for public match display when available.';
comment on column public.matches.official_away_team_name is
  'Official away-team name from the federation/import source, used for public match display when available.';

update public.matches match
set
  official_home_team_name = case
    when match.is_home_match then coalesce(nullif(trim(club.name), ''), match.team_a_name)
    else match.team_b_name
  end,
  official_away_team_name = case
    when match.is_home_match then match.team_b_name
    else coalesce(nullif(trim(club.name), ''), match.team_a_name)
  end
from public.clubs club
where club.id = match.club_id
  and match.external_source in ('voetbal_vlaanderen', 'voetbal_vlaanderen_download')
  and (match.official_home_team_name is null or match.official_away_team_name is null);
