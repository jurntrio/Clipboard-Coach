-- Run after migrations with: supabase test db
-- Covers 0033_club_roster_sync_and_assignment.sql (Fase 2b: synchroniseren/vervangen-verwijdering,
-- reactivatie-fix, en "voeg speler toe aan ander team").
begin;
create extension if not exists pgtap;
select plan(20);

-- ---------------------------------------------------------------------------
-- Schema-aanwezigheid
-- ---------------------------------------------------------------------------
select has_function('public', 'remove_roster_players', array['uuid','uuid[]'], 'remove_roster_players bestaat');
select has_function('public', 'add_club_player_to_team', array['uuid','uuid'], 'add_club_player_to_team bestaat');

-- ---------------------------------------------------------------------------
-- Fixtures
-- ---------------------------------------------------------------------------
insert into public.clubs (name, rbfa_registration_number) values ('Test Roster Sync Club', 'TRS-001');
insert into public.clubs (name, rbfa_registration_number) values ('Other Roster Sync Club', 'TRS-002');

insert into public.club_teams (club_id, name, trainers_can_edit_roster)
select id, 'Sync A', true from public.clubs where name = 'Test Roster Sync Club';
insert into public.club_teams (club_id, name, trainers_can_edit_roster)
select id, 'Sync B', true from public.clubs where name = 'Test Roster Sync Club';

insert into public.teams (coach_id, name, club_name, club_team_id)
select null, ct.name, c.name, ct.id
from public.club_teams ct join public.clubs c on c.id = ct.club_id
where c.name = 'Test Roster Sync Club';

insert into auth.users (id, email, raw_user_meta_data) values
  ('40000000-0000-0000-0000-000000000001', 'admin@trs.test', '{"full_name":"Admin Trs"}'),
  ('40000000-0000-0000-0000-000000000002', 'trainera@trs.test', '{"full_name":"Trainer A"}'),
  ('40000000-0000-0000-0000-000000000003', 'trainerb@trs.test', '{"full_name":"Trainer B"}'),
  ('40000000-0000-0000-0000-000000000004', 'outsider@trs.test', '{"full_name":"Outsider"}');

insert into public.club_memberships (club_id, profile_id, role, status)
select c.id, '40000000-0000-0000-0000-000000000001', 'club_admin', 'active'
from public.clubs c where c.name = 'Test Roster Sync Club';
insert into public.club_memberships (club_id, profile_id, role, status)
select c.id, '40000000-0000-0000-0000-000000000002', 'coach', 'active'
from public.clubs c where c.name = 'Test Roster Sync Club';
insert into public.club_memberships (club_id, profile_id, role, status)
select c.id, '40000000-0000-0000-0000-000000000003', 'coach', 'active'
from public.clubs c where c.name = 'Test Roster Sync Club';

insert into public.club_trainers (club_id, profile_id, display_name, invitation_status)
select c.id, '40000000-0000-0000-0000-000000000002', 'Trainer A', 'linked'
from public.clubs c where c.name = 'Test Roster Sync Club';
insert into public.club_trainers (club_id, profile_id, display_name, invitation_status)
select c.id, '40000000-0000-0000-0000-000000000003', 'Trainer B', 'linked'
from public.clubs c where c.name = 'Test Roster Sync Club';

insert into public.club_trainer_teams (trainer_id, club_team_id, status)
select ctr.id, ct.id, 'active'
from public.club_trainers ctr
join public.club_teams ct on ct.club_id = ctr.club_id and ct.name = 'Sync A'
where ctr.profile_id = '40000000-0000-0000-0000-000000000002';
insert into public.club_trainer_teams (trainer_id, club_team_id, status)
select ctr.id, ct.id, 'active'
from public.club_trainers ctr
join public.club_teams ct on ct.club_id = ctr.club_id and ct.name = 'Sync B'
where ctr.profile_id = '40000000-0000-0000-0000-000000000003';

-- Team-id's vooraf bufferen als postgres (zelfde reden als in club_player_roster_import.test.sql:
-- teams heeft een eigen, niet-verheven RLS-policy die een live subquery onder de authenticated-
-- rol altijd NULL zou laten opleveren).
select set_config('test.sync_a_team_id',
  (select t.id::text from public.teams t join public.club_teams ct on ct.id = t.club_team_id where ct.name = 'Sync A'), true);
select set_config('test.sync_b_team_id',
  (select t.id::text from public.teams t join public.club_teams ct on ct.id = t.club_team_id where ct.name = 'Sync B'), true);

-- ---------------------------------------------------------------------------
-- remove_roster_players + reactivatie-regressie (import_roster_player_merge-fix)
-- ---------------------------------------------------------------------------
select public.import_roster_rows_merge(
  current_setting('test.sync_a_team_id')::uuid,
  jsonb_build_array(jsonb_build_object('first_name', 'Remove', 'last_name', 'Me', 'date_of_birth', '2012-06-06', 'email', null, 'phone', null))
);
select set_config('test.remove_me_player_id',
  (select p.id::text from public.players p where p.last_name = 'Me'), true);
select set_config('test.remove_me_membership_id',
  (select p.membership_id::text from public.players p where p.id = current_setting('test.remove_me_player_id')::uuid), true);

select is(
  (select (public.remove_roster_players(
    current_setting('test.sync_a_team_id')::uuid,
    array[current_setting('test.remove_me_player_id')::uuid]
  ))->>'removed')::int,
  1, 'remove_roster_players meldt 1 verwijderde speler'
);
select ok(
  not exists(select 1 from public.players where id = current_setting('test.remove_me_player_id')::uuid),
  'de operationele players-rij is weg na verwijdering'
);
select is(
  (select status from public.player_team_memberships where id = current_setting('test.remove_me_membership_id')::uuid),
  'ended', 'de membership is afgesloten (ended) i.p.v. verwijderd -- canonieke geschiedenis blijft'
);
select ok(
  (select left_at from public.player_team_memberships where id = current_setting('test.remove_me_membership_id')::uuid) is not null,
  'left_at is gezet bij het afsluiten'
);

-- Regressie: herimport van dezelfde speler (naam+geboortedatum -> zelfde match_key) reactiveert
-- de membership i.p.v. hem stil "ended" te laten.
select public.import_roster_rows_merge(
  current_setting('test.sync_a_team_id')::uuid,
  jsonb_build_array(jsonb_build_object('first_name', 'Remove', 'last_name', 'Me', 'date_of_birth', '2012-06-06', 'email', null, 'phone', null))
);
select is(
  (select status from public.player_team_memberships where id = current_setting('test.remove_me_membership_id')::uuid),
  'active', 'herimport reactiveert de eerder afgesloten membership (dezelfde membership-rij, want (club_player_id,team_id,season_id) is uniek)'
);
select ok(
  (select left_at from public.player_team_memberships where id = current_setting('test.remove_me_membership_id')::uuid) is null,
  'left_at is opnieuw leeg na reactivatie'
);
select ok(
  exists(select 1 from public.players where membership_id = current_setting('test.remove_me_membership_id')::uuid),
  'er is opnieuw een operationele players-rij gekoppeld aan dezelfde membership'
);

set local role authenticated;
select set_config('request.jwt.claims', json_build_object('sub', '40000000-0000-0000-0000-000000000001')::text, true);
select throws_ok(
  $$select public.remove_roster_players(
    current_setting('test.sync_a_team_id')::uuid, array[current_setting('test.remove_me_player_id')::uuid]
  )$$,
  '42501', null, 'remove_roster_players is niet aanroepbaar vanaf een ingelogde sessie (enkel via de admin-client)'
);
reset role;

-- ---------------------------------------------------------------------------
-- add_club_player_to_team
-- ---------------------------------------------------------------------------
select public.import_roster_rows_merge(
  current_setting('test.sync_a_team_id')::uuid,
  jsonb_build_array(jsonb_build_object('first_name', 'Multi', 'last_name', 'Squad', 'date_of_birth', '2011-09-09', 'email', 'multisquad@example.test', 'phone', null))
);
select set_config('test.multi_squad_club_player_id',
  (select id::text from public.club_players where first_name = 'Multi' and last_name = 'Squad'), true);

insert into public.club_players (club_id, first_name, last_name, date_of_birth)
select id, 'Foreign', 'Player', '2010-01-01' from public.clubs where name = 'Other Roster Sync Club';
select set_config('test.foreign_club_player_id',
  (select id::text from public.club_players where first_name = 'Foreign' and last_name = 'Player'), true);

set local role authenticated;
select set_config('request.jwt.claims', json_build_object('sub', '40000000-0000-0000-0000-000000000004')::text, true);
select throws_ok(
  $$select public.add_club_player_to_team(
    current_setting('test.multi_squad_club_player_id')::uuid, current_setting('test.sync_b_team_id')::uuid
  )$$,
  'P0001', 'ADD_CLUB_PLAYER_FORBIDDEN', 'een niet-toegewezen gebruiker mag geen speler aan een team toevoegen'
);

select set_config('request.jwt.claims', json_build_object('sub', '40000000-0000-0000-0000-000000000003')::text, true);
select throws_ok(
  $$select public.add_club_player_to_team(
    current_setting('test.foreign_club_player_id')::uuid, current_setting('test.sync_b_team_id')::uuid
  )$$,
  'P0001', 'CLUB_PLAYER_NOT_IN_CLUB', 'een club_player van een andere club kan niet toegevoegd worden'
);

select lives_ok(
  $$select public.add_club_player_to_team(
    current_setting('test.multi_squad_club_player_id')::uuid, current_setting('test.sync_b_team_id')::uuid
  )$$,
  'de Sync B-trainer mag de gedeelde speler aan zijn eigen team toevoegen'
);
reset role;

select is(
  (select membership_type from public.player_team_memberships ptm
    where ptm.club_player_id = current_setting('test.multi_squad_club_player_id')::uuid
      and ptm.team_id = current_setting('test.sync_b_team_id')::uuid),
  'secondary', 'nieuwe membership wordt secondary (Sync A is al primary voor dit seizoen)'
);
select ok(
  exists(select 1 from public.players p
    join public.player_team_memberships ptm on ptm.id = p.membership_id
    where ptm.club_player_id = current_setting('test.multi_squad_club_player_id')::uuid
      and ptm.team_id = current_setting('test.sync_b_team_id')::uuid),
  'een operationele players-rij is aangemaakt voor Sync B'
);

set local role authenticated;
select set_config('request.jwt.claims', json_build_object('sub', '40000000-0000-0000-0000-000000000003')::text, true);
select throws_ok(
  $$select public.add_club_player_to_team(
    current_setting('test.multi_squad_club_player_id')::uuid, current_setting('test.sync_b_team_id')::uuid
  )$$,
  'P0001', 'ALREADY_ON_TEAM', 'nogmaals toevoegen aan hetzelfde team wordt geweigerd'
);
reset role;

-- Reactivatieregressie voor add_club_player_to_team: verwijderen en opnieuw toevoegen mag geen
-- unique-violation geven, en de eerder gezette 'secondary' blijft ongemoeid (nooit stilzwijgend
-- teruggeforceerd naar 'primary').
select set_config('test.multi_squad_sync_b_player_id',
  (select p.id::text from public.players p
    join public.player_team_memberships ptm on ptm.id = p.membership_id
    where ptm.club_player_id = current_setting('test.multi_squad_club_player_id')::uuid
      and ptm.team_id = current_setting('test.sync_b_team_id')::uuid), true);
select public.remove_roster_players(
  current_setting('test.sync_b_team_id')::uuid, array[current_setting('test.multi_squad_sync_b_player_id')::uuid]
);

set local role authenticated;
select set_config('request.jwt.claims', json_build_object('sub', '40000000-0000-0000-0000-000000000003')::text, true);
select lives_ok(
  $$select public.add_club_player_to_team(
    current_setting('test.multi_squad_club_player_id')::uuid, current_setting('test.sync_b_team_id')::uuid
  )$$,
  'na verwijdering opnieuw toevoegen reactiveert zonder unique-violation'
);
reset role;
select is(
  (select membership_type from public.player_team_memberships ptm
    where ptm.club_player_id = current_setting('test.multi_squad_club_player_id')::uuid
      and ptm.team_id = current_setting('test.sync_b_team_id')::uuid),
  'secondary', 'membership_type blijft secondary na reactivatie (nooit stilzwijgend naar primary)'
);
select is(
  (select status from public.player_team_memberships ptm
    where ptm.club_player_id = current_setting('test.multi_squad_club_player_id')::uuid
      and ptm.team_id = current_setting('test.sync_b_team_id')::uuid),
  'active', 'membership is opnieuw actief'
);

-- ---------------------------------------------------------------------------
-- Vertrouwensgrens: add_club_player_to_team mag niet als anon aanroepbaar zijn.
-- ---------------------------------------------------------------------------
set local role anon;
select throws_ok(
  $$select public.add_club_player_to_team(
    current_setting('test.multi_squad_club_player_id')::uuid, current_setting('test.sync_b_team_id')::uuid
  )$$,
  '42501', null, 'add_club_player_to_team is niet aanroepbaar als anon'
);
reset role;

select * from finish();
rollback;
