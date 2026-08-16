-- JVV Sint-Andries appears in official match data as
-- "J.V.V.Sint-Andries/Brugge" and has RBFA registration number 9382.
-- It was missing from the directory and was accidentally linked to
-- Sint-Eloois-Winkel Sport (4408).
insert into public.belgian_clubs (stamnummer, naam)
values (9382, 'JVV Sint-Andries')
on conflict (stamnummer) do update set naam = excluded.naam;

insert into public.club_name_aliases (alias, belgian_club_id)
select 'J.V.V.Sint-Andries/Brugge', id
from public.belgian_clubs
where stamnummer = 9382
on conflict (alias) do update set belgian_club_id = excluded.belgian_club_id;

update public.matches
set team_a_belgian_club_id = (select id from public.belgian_clubs where stamnummer = 9382)
where lower(regexp_replace(team_a_name, '[^a-zA-Z0-9]+', '', 'g')) = 'jvvsintandriesbrugge';

update public.matches
set team_b_belgian_club_id = (select id from public.belgian_clubs where stamnummer = 9382)
where lower(regexp_replace(team_b_name, '[^a-zA-Z0-9]+', '', 'g')) = 'jvvsintandriesbrugge';
