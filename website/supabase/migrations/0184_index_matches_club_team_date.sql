-- Speed up club-scoped match lists that filter by one or more club teams
-- and order the result chronologically (matches hub and recent videos).
create index if not exists idx_matches_club_team_date
  on public.matches (club_id, club_team_id, match_date, start_time);
