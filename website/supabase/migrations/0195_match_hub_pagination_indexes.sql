-- Support the match hub's club-scoped chronological pagination. The existing
-- index also includes club_team_id and cannot efficiently serve an all-teams
-- query where that column is intentionally unconstrained.
create index if not exists idx_matches_club_date_start
  on public.matches (club_id, match_date desc, start_time desc);
