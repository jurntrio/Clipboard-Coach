-- Foot24 calendars list the home team first. Older imports deliberately stored
-- the club team first, so away fixtures need one corrective swap.
update public.matches
set
  team_a_name = team_b_name,
  team_b_name = team_a_name,
  score_a = score_b,
  score_b = score_a,
  updated_at = timezone('utc'::text, now())
where external_source = 'foot24'
  and is_home_match = false;
