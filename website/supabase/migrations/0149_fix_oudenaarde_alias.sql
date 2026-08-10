-- KSV Oudenaarde was accidentally linked to KM Torhout, causing the Torhout
-- crest to appear for Oudenaarde in match lists.
update public.club_name_aliases
set belgian_club_id = (select id from public.belgian_clubs where stamnummer = 81)
where lower(trim(alias)) = 'ksv. oudenaarde';

update public.matches
set team_a_belgian_club_id = (select id from public.belgian_clubs where stamnummer = 81)
where team_a_name ilike '%oudenaarde%';

update public.matches
set team_b_belgian_club_id = (select id from public.belgian_clubs where stamnummer = 81)
where team_b_name ilike '%oudenaarde%';
