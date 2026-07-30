-- Recalculate the home flag from the normalized operational team name.
-- Foot24 rows always store the actual home team in team_a_name after 0081.
update public.matches as match
set
  is_home_match = (
    regexp_replace(lower(match.team_a_name), '[^a-z0-9]', '', 'g')
      = regexp_replace(lower(club_team.name), '[^a-z0-9]', '', 'g')
  ),
  updated_at = timezone('utc'::text, now())
from public.club_teams as club_team
where match.external_source = 'foot24'
  and match.club_team_id = club_team.id;
