-- Foot24 marks the actual home team with a football/circle icon. Correct
-- previously imported rows where that marker ended up in the opponent name.
-- chr() keeps the migration independent of the SQL file's text encoding.
update public.matches
set
  team_a_name = case
    when position(chr(9917) in team_b_name) > 0 or position(chr(128309) in team_b_name) > 0
      then trim(replace(replace(team_b_name, chr(9917), ''), chr(128309), ''))
    else trim(replace(replace(team_a_name, chr(9917), ''), chr(128309), ''))
  end,
  team_b_name = case
    when position(chr(9917) in team_b_name) > 0 or position(chr(128309) in team_b_name) > 0
      then trim(replace(replace(team_a_name, chr(9917), ''), chr(128309), ''))
    else trim(replace(replace(team_b_name, chr(9917), ''), chr(128309), ''))
  end,
  score_a = case
    when position(chr(9917) in team_b_name) > 0 or position(chr(128309) in team_b_name) > 0 then score_b
    else score_a
  end,
  score_b = case
    when position(chr(9917) in team_b_name) > 0 or position(chr(128309) in team_b_name) > 0 then score_a
    else score_b
  end,
  is_home_match = case
    when position(chr(9917) in team_b_name) > 0 or position(chr(128309) in team_b_name) > 0 then false
    when position(chr(9917) in team_a_name) > 0 or position(chr(128309) in team_a_name) > 0 then true
    else is_home_match
  end,
  updated_at = timezone('utc'::text, now())
where external_source = 'foot24'
  and (
    position(chr(9917) in team_a_name) > 0 or position(chr(128309) in team_a_name) > 0
    or position(chr(9917) in team_b_name) > 0 or position(chr(128309) in team_b_name) > 0
  );
