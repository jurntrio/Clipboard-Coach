-- A match's team_a is the club's own operational team, even for away games.
-- Link it through the parent club's RBFA registration number instead of
-- treating age-category team names (U7, U13 A, ...) as Belgian club names.
update public.matches as match
set team_a_belgian_club_id = belgian_club.id
from public.clubs as club
join public.belgian_clubs as belgian_club
  on belgian_club.stamnummer = nullif(regexp_replace(club.rbfa_registration_number, '[^0-9]', '', 'g'), '')::integer
where match.club_id = club.id
  and match.team_a_belgian_club_id is null;

-- Older club records may not have a registration number yet. In that case,
-- use the parent club name (never the age-category team name) as a safe exact
-- normalized fallback.
update public.matches as match
set team_a_belgian_club_id = belgian_club.id
from public.clubs as club
join public.belgian_clubs as belgian_club
  on public.normalize_club_team_name(belgian_club.naam) = public.normalize_club_team_name(club.name)
where match.club_id = club.id
  and match.team_a_belgian_club_id is null;
