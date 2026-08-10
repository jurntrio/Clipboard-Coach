-- SK Torhout appears in the official Voetbal Vlaanderen downloads with
-- registration number 9388, but was missing from the Belgian club directory.
insert into public.belgian_clubs (stamnummer, naam)
values (9388, 'SK Torhout')
on conflict (stamnummer) do update set naam = excluded.naam;

insert into public.club_name_aliases (alias, belgian_club_id)
select 'SK Torhout', id from public.belgian_clubs where stamnummer = 9388
on conflict (alias) do update set belgian_club_id = excluded.belgian_club_id;

update public.matches
set team_a_belgian_club_id = (select id from public.belgian_clubs where stamnummer = 9388)
where team_a_belgian_club_id is null
  and lower(regexp_replace(team_a_name, '[^a-zA-Z0-9]+', '', 'g')) in ('sktorhout', 'sktorhouta', 'sktorhoutb');

update public.matches
set team_b_belgian_club_id = (select id from public.belgian_clubs where stamnummer = 9388)
where team_b_belgian_club_id is null
  and lower(regexp_replace(team_b_name, '[^a-zA-Z0-9]+', '', 'g')) in ('sktorhout', 'sktorhouta', 'sktorhoutb');
