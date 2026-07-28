-- Run after migrations with: supabase test db
-- Covers 0032_club_player_roster_import.sql (Fase 2a: toevoegen/bijwerken-modus).
begin;
create extension if not exists pgtap;
select plan(40);

-- ---------------------------------------------------------------------------
-- Schema-aanwezigheid
-- ---------------------------------------------------------------------------
select has_function('public', 'ensure_active_club_season', array['uuid'], 'ensure_active_club_season bestaat');
select has_function('public', 'upsert_club_player_contact_merge', array['uuid','text','text','date','text','text'], 'upsert_club_player_contact_merge bestaat');
select has_function('public', 'import_roster_player_merge', array['uuid','uuid','text','text','date','text','text'], 'import_roster_player_merge bestaat');
select has_function('public', 'import_roster_rows_merge', array['uuid','jsonb'], 'import_roster_rows_merge bestaat');
select has_function('public', 'search_club_players_for_assignment', array['uuid','text'], 'search_club_players_for_assignment bestaat');
select has_function('public', 'resolve_primary_membership', array['uuid','uuid'], 'resolve_primary_membership bestaat');

-- ---------------------------------------------------------------------------
-- Fixtures
-- ---------------------------------------------------------------------------
insert into public.clubs (name, rbfa_registration_number) values ('Test Roster Import Club', 'TRI-001');

insert into public.club_teams (club_id, name, trainers_can_edit_roster)
select id, 'U13A Import', true from public.clubs where name = 'Test Roster Import Club';
insert into public.club_teams (club_id, name, trainers_can_edit_roster)
select id, 'U13B Import', true from public.clubs where name = 'Test Roster Import Club';
insert into public.club_teams (club_id, name, trainers_can_edit_roster)
select id, 'U17 Import', true from public.clubs where name = 'Test Roster Import Club';

insert into public.teams (coach_id, name, club_name, club_team_id)
select null, ct.name, c.name, ct.id
from public.club_teams ct join public.clubs c on c.id = ct.club_id
where c.name = 'Test Roster Import Club';

insert into public.teams (coach_id, name) values (null, 'Personal Import Team');

insert into auth.users (id, email, raw_user_meta_data) values
  ('30000000-0000-0000-0000-000000000001', 'admin@tri.test', '{"full_name":"Admin Tri"}'),
  ('30000000-0000-0000-0000-000000000002', 'trainer13a@tri.test', '{"full_name":"Trainer U13A"}'),
  ('30000000-0000-0000-0000-000000000003', 'trainer17@tri.test', '{"full_name":"Trainer U17"}'),
  ('30000000-0000-0000-0000-000000000004', 'outsider@tri.test', '{"full_name":"Outsider"}');

insert into public.club_memberships (club_id, profile_id, role, status)
select c.id, '30000000-0000-0000-0000-000000000001', 'club_admin', 'active'
from public.clubs c where c.name = 'Test Roster Import Club';
insert into public.club_memberships (club_id, profile_id, role, status)
select c.id, '30000000-0000-0000-0000-000000000002', 'coach', 'active'
from public.clubs c where c.name = 'Test Roster Import Club';
insert into public.club_memberships (club_id, profile_id, role, status)
select c.id, '30000000-0000-0000-0000-000000000003', 'coach', 'active'
from public.clubs c where c.name = 'Test Roster Import Club';

insert into public.club_trainers (club_id, profile_id, display_name, invitation_status)
select c.id, '30000000-0000-0000-0000-000000000002', 'Trainer U13A', 'linked'
from public.clubs c where c.name = 'Test Roster Import Club';
insert into public.club_trainers (club_id, profile_id, display_name, invitation_status)
select c.id, '30000000-0000-0000-0000-000000000003', 'Trainer U17', 'linked'
from public.clubs c where c.name = 'Test Roster Import Club';

insert into public.club_trainer_teams (trainer_id, club_team_id, status)
select ctr.id, ct.id, 'active'
from public.club_trainers ctr
join public.club_teams ct on ct.club_id = ctr.club_id and ct.name = 'U13A Import'
where ctr.profile_id = '30000000-0000-0000-0000-000000000002';
insert into public.club_trainer_teams (trainer_id, club_team_id, status)
select ctr.id, ct.id, 'active'
from public.club_trainers ctr
join public.club_teams ct on ct.club_id = ctr.club_id and ct.name = 'U17 Import'
where ctr.profile_id = '30000000-0000-0000-0000-000000000003';

-- ---------------------------------------------------------------------------
-- ensure_active_club_season
-- ---------------------------------------------------------------------------
select ok(
  (select public.ensure_active_club_season((select id from public.clubs where name = 'Test Roster Import Club'))) is not null,
  'ensure_active_club_season maakt lazy een seizoen aan voor een club zonder club_seasons-rij'
);
select is(
  (select count(*)::int from public.club_seasons where club_id = (select id from public.clubs where name = 'Test Roster Import Club') and is_active),
  1, 'exact 1 actief seizoen na de eerste aanroep'
);
select is(
  (select public.ensure_active_club_season((select id from public.clubs where name = 'Test Roster Import Club'))),
  (select id from public.club_seasons where club_id = (select id from public.clubs where name = 'Test Roster Import Club') and is_active),
  'herhaald aanroepen is idempotent: zelfde seizoen-id, geen nieuwe rij'
);
insert into public.clubs (name) values ('Other Roster Import Club');
select isnt(
  (select public.ensure_active_club_season((select id from public.clubs where name = 'Other Roster Import Club'))),
  (select id from public.club_seasons where club_id = (select id from public.clubs where name = 'Test Roster Import Club') and is_active),
  'twee clubs krijgen elk hun eigen seizoen, geen kruisbesmetting'
);

-- ---------------------------------------------------------------------------
-- search_club_players_for_assignment
-- ---------------------------------------------------------------------------
-- create_club_player_with_membership is auth.uid()-gated; zet de identiteit expliciet
-- (nog nooit gezet in deze sessie) vóór deze fixture-aanroep.
select set_config('request.jwt.claims', json_build_object('sub', '30000000-0000-0000-0000-000000000001')::text, true);
select public.create_club_player_with_membership(
  (select t.id from public.teams t join public.club_teams ct on ct.id = t.club_team_id where ct.name = 'U13A Import'),
  (select id from public.club_seasons where club_id = (select id from public.clubs where name = 'Test Roster Import Club') and is_active),
  'Zoek', 'Baar', '2013-04-04', 'zoekbaar@example.test', '+32470000000'
);

set local role authenticated;
select set_config('request.jwt.claims', json_build_object('sub', '30000000-0000-0000-0000-000000000001')::text, true);
select is(
  (select count(*)::int from public.search_club_players_for_assignment(
    (select id from public.clubs where name = 'Test Roster Import Club'), '')),
  1, 'club_admin ziet de aangemaakte speler via de zoek-RPC'
);
select is(
  (select array_agg(email) from (
    select cp.email from public.club_players cp where cp.last_name = 'Baar'
  ) x),
  array['zoekbaar@example.test'],
  'sanity check: het e-mailadres bestaat wel degelijk op club_players zelf'
);

select set_config('request.jwt.claims', json_build_object('sub', '30000000-0000-0000-0000-000000000003')::text, true);
select is(
  (select count(*)::int from public.search_club_players_for_assignment(
    (select id from public.clubs where name = 'Test Roster Import Club'), 'Baar')),
  1, 'een trainer van U17 (een ANDER team) ziet de U13A-speler toch via de clubbrede zoek-RPC'
);

select set_config('request.jwt.claims', json_build_object('sub', '30000000-0000-0000-0000-000000000004')::text, true);
select throws_ok(
  $$select * from public.search_club_players_for_assignment(
    (select id from public.clubs where name = 'Test Roster Import Club'), '')$$,
  'P0001', 'SEARCH_CLUB_PLAYERS_FORBIDDEN', 'een niet-clublid krijgt geen toegang tot de zoek-RPC'
);
reset role;

-- ---------------------------------------------------------------------------
-- resolve_primary_membership
-- ---------------------------------------------------------------------------
-- Fixture: club_player met 2 actieve 'secondary'-memberships in hetzelfde seizoen +
-- bijhorende unassigned_primary_team-issue (spiegelt de multi-team-situatie uit Fase 1).
insert into public.club_players (club_id, first_name, last_name, date_of_birth)
values ((select id from public.clubs where name = 'Test Roster Import Club'), 'Multi', 'Team', '2013-05-05');
insert into public.player_team_memberships (club_player_id, team_id, season_id, membership_type)
select (select id from public.club_players where first_name = 'Multi' and last_name = 'Team'),
  (select t.id from public.teams t join public.club_teams ct on ct.id = t.club_team_id where ct.name = 'U13A Import'),
  (select id from public.club_seasons where club_id = (select id from public.clubs where name = 'Test Roster Import Club') and is_active),
  'secondary';
insert into public.player_team_memberships (club_player_id, team_id, season_id, membership_type)
select (select id from public.club_players where first_name = 'Multi' and last_name = 'Team'),
  (select t.id from public.teams t join public.club_teams ct on ct.id = t.club_team_id where ct.name = 'U17 Import'),
  (select id from public.club_seasons where club_id = (select id from public.clubs where name = 'Test Roster Import Club') and is_active),
  'secondary';
insert into public.club_player_migration_issues (club_id, candidate_club_player_id, issue_type, issue_key, details)
values (
  (select id from public.clubs where name = 'Test Roster Import Club'),
  (select id from public.club_players where first_name = 'Multi' and last_name = 'Team'),
  'unassigned_primary_team',
  'unassigned_primary_team:test-fixture:multi-team',
  jsonb_build_object('season_id', (select id from public.club_seasons where club_id = (select id from public.clubs where name = 'Test Roster Import Club') and is_active))
);

-- Team-id's (en de club_player-id) VOORAF opzoeken, als postgres, en bufferen in een GUC.
-- teams heeft een eigen, niet-verheven RLS-policy (0023) die voor een loutere trainer afhangt
-- van club_trainer_teams/club_trainers -- tabellen zonder ENKELE policy (bewust enkel
-- zichtbaar via een SECURITY DEFINER-functie). Een live subquery tegen teams als argument,
-- geëvalueerd ONDER de authenticated-rol vóór de functieaanroep, zou daardoor altijd NULL
-- opleveren -- dat is precies de valkuil, onafhankelijk van of resolve_primary_membership
-- zelf correct is.
select set_config('test.u13a_team_id',
  (select t.id::text from public.teams t join public.club_teams ct on ct.id = t.club_team_id where ct.name = 'U13A Import'), true);
select set_config('test.u17_team_id',
  (select t.id::text from public.teams t join public.club_teams ct on ct.id = t.club_team_id where ct.name = 'U17 Import'), true);
select set_config('test.multi_team_club_player_id',
  (select id::text from public.club_players where first_name = 'Multi' and last_name = 'Team'), true);

set local role authenticated;
select set_config('request.jwt.claims', json_build_object('sub', '30000000-0000-0000-0000-000000000004')::text, true);
select throws_ok(
  $$select public.resolve_primary_membership(
    current_setting('test.multi_team_club_player_id')::uuid,
    current_setting('test.u13a_team_id')::uuid
  )$$,
  'P0001', 'RESOLVE_PRIMARY_FORBIDDEN', 'een niet-bevoegde gebruiker mag geen primary-team kiezen'
);

select set_config('request.jwt.claims', json_build_object('sub', '30000000-0000-0000-0000-000000000002')::text, true);
select lives_ok(
  $$select public.resolve_primary_membership(
    current_setting('test.multi_team_club_player_id')::uuid,
    current_setting('test.u13a_team_id')::uuid
  )$$,
  'de U13A-trainer mag U13A als primary team kiezen voor de gedeelde speler'
);
reset role;

select is(
  (select membership_type from public.player_team_memberships ptm
    join public.club_players cp on cp.id = ptm.club_player_id
    join public.teams t on t.id = ptm.team_id join public.club_teams ct on ct.id = t.club_team_id
    where cp.first_name = 'Multi' and ct.name = 'U13A Import'),
  'primary', 'U13A-membership is nu primary'
);
select is(
  (select membership_type from public.player_team_memberships ptm
    join public.club_players cp on cp.id = ptm.club_player_id
    join public.teams t on t.id = ptm.team_id join public.club_teams ct on ct.id = t.club_team_id
    where cp.first_name = 'Multi' and ct.name = 'U17 Import'),
  'secondary', 'U17-membership blijft secondary (gedemote indien nodig, hier ongewijzigd)'
);
select is(
  (select status from public.club_player_migration_issues where issue_key = 'unassigned_primary_team:test-fixture:multi-team'),
  'resolved', 'de bijhorende reviewissue is gemarkeerd als resolved'
);

set local role authenticated;
select set_config('request.jwt.claims', json_build_object('sub', '30000000-0000-0000-0000-000000000003')::text, true);
select lives_ok(
  $$select public.resolve_primary_membership(
    current_setting('test.multi_team_club_player_id')::uuid,
    current_setting('test.u17_team_id')::uuid
  )$$,
  'opnieuw kiezen (U17 als primary) werkt zonder unique-index-violatie'
);
reset role;
select is(
  (select membership_type from public.player_team_memberships ptm
    join public.club_players cp on cp.id = ptm.club_player_id
    join public.teams t on t.id = ptm.team_id join public.club_teams ct on ct.id = t.club_team_id
    where cp.first_name = 'Multi' and ct.name = 'U13A Import'),
  'secondary', 'U13A is correct gedemote na de omschakeling naar U17'
);

select throws_ok(
  $$select public.resolve_primary_membership(
    (select id from public.club_players where first_name = 'Multi' and last_name = 'Team'),
    (select t.id from public.teams t where t.name = 'Personal Import Team')
  )$$,
  'P0001', 'RESOLVE_PRIMARY_FORBIDDEN', 'een team zonder toewijzing/rechten wordt geweigerd vóór MEMBERSHIP_NOT_FOUND'
);

-- ---------------------------------------------------------------------------
-- import_roster_rows_merge: verse import, herimport, contactconflict, multi-team-primary
-- ---------------------------------------------------------------------------
select is(
  (select (public.import_roster_rows_merge(
    (select t.id from public.teams t join public.club_teams ct on ct.id = t.club_team_id where ct.name = 'U13B Import'),
    jsonb_build_array(
      jsonb_build_object('first_name', 'Fresh', 'last_name', 'One', 'date_of_birth', '2013-01-01', 'email', 'one@example.test', 'phone', '+32470000001'),
      jsonb_build_object('first_name', 'Fresh', 'last_name', 'Two', 'date_of_birth', '2013-02-02', 'email', null, 'phone', null)
    )
  ))->>'saved')::int,
  2, 'verse import van 2 spelers: beide slagen'
);
select is(
  (select count(*)::int from public.club_players cp
    join public.player_team_memberships ptm on ptm.club_player_id = cp.id
    join public.teams t on t.id = ptm.team_id join public.club_teams ct on ct.id = t.club_team_id
    where ct.name = 'U13B Import' and cp.last_name in ('One', 'Two') and ptm.membership_type = 'primary'),
  2, 'elk van de 2 nieuwe spelers krijgt primary (hun enige team)'
);
select is(
  (select count(*)::int from public.players p
    join public.player_team_memberships ptm on ptm.id = p.membership_id
    join public.club_players cp on cp.id = ptm.club_player_id
    where cp.last_name in ('One', 'Two')),
  2, 'elk krijgt een operationele players-rij gekoppeld via membership_id'
);

-- Herimport, ongewijzigd: geen extra rijen.
select is(
  (select (public.import_roster_rows_merge(
    (select t.id from public.teams t join public.club_teams ct on ct.id = t.club_team_id where ct.name = 'U13B Import'),
    jsonb_build_array(
      jsonb_build_object('first_name', 'Fresh', 'last_name', 'One', 'date_of_birth', '2013-01-01', 'email', 'one@example.test', 'phone', '+32470000001')
    )
  ))->>'saved')::int,
  1, 'herimport van ongewijzigde data slaagt'
);
select is(
  (select count(*)::int from public.club_players where last_name = 'One'),
  1, 'geen extra club_players-rij na herimport'
);

-- Contactconflict: zelfde speler, ander e-mailadres bij import.
select public.import_roster_rows_merge(
  (select t.id from public.teams t join public.club_teams ct on ct.id = t.club_team_id where ct.name = 'U13B Import'),
  jsonb_build_array(jsonb_build_object('first_name', 'Fresh', 'last_name', 'One', 'date_of_birth', '2013-01-01', 'email', 'changed@example.test', 'phone', null))
);
select is(
  (select email from public.club_players where last_name = 'One'),
  'one@example.test', 'conflicterend e-mailadres bij import overschrijft het bestaande adres niet'
);
select ok(
  exists(select 1 from public.club_player_migration_issues where issue_type = 'conflicting_contact_data'
    and details->>'incoming' = 'changed@example.test'),
  'het conflict wordt gerapporteerd voor manuele review'
);

-- Multi-team-primary: "Fresh One" ook importeren in U13A -> moet secondary worden (U13B is al primary).
select public.import_roster_rows_merge(
  (select t.id from public.teams t join public.club_teams ct on ct.id = t.club_team_id where ct.name = 'U13A Import'),
  jsonb_build_array(jsonb_build_object('first_name', 'Fresh', 'last_name', 'One', 'date_of_birth', '2013-01-01', 'email', null, 'phone', null))
);
select is(
  (select membership_type from public.player_team_memberships ptm
    join public.club_players cp on cp.id = ptm.club_player_id
    join public.teams t on t.id = ptm.team_id join public.club_teams ct on ct.id = t.club_team_id
    where cp.last_name = 'One' and ct.name = 'U13A Import'),
  'secondary', 'tweede team voor dezelfde speler in hetzelfde seizoen wordt automatisch secondary'
);
select is(
  (select count(distinct ptm.club_player_id)::int from public.player_team_memberships ptm
    join public.club_players cp on cp.id = ptm.club_player_id where cp.last_name = 'One'),
  1, 'nog steeds dezelfde club_player_id voor beide teams'
);

-- Kernregressietest: bestaande spelers A (Fresh One) + B (Fresh Two) op U13B, import bevat
-- enkel A -> B moet volledig onaangeroerd blijven.
select public.import_roster_rows_merge(
  (select t.id from public.teams t join public.club_teams ct on ct.id = t.club_team_id where ct.name = 'U13B Import'),
  jsonb_build_array(jsonb_build_object('first_name', 'Fresh', 'last_name', 'One', 'date_of_birth', '2013-01-01', 'email', null, 'phone', null))
);
select ok(
  exists(select 1 from public.club_players where last_name = 'Two'),
  'speler B (niet in de nieuwe import) blijft bestaan als club_player'
);
select ok(
  exists(select 1 from public.player_team_memberships ptm
    join public.club_players cp on cp.id = ptm.club_player_id
    join public.teams t on t.id = ptm.team_id join public.club_teams ct on ct.id = t.club_team_id
    where cp.last_name = 'Two' and ct.name = 'U13B Import' and ptm.status = 'active'),
  'de membership van speler B blijft actief'
);
select ok(
  exists(select 1 from public.players p join public.player_team_memberships ptm on ptm.id = p.membership_id
    join public.club_players cp on cp.id = ptm.club_player_id where cp.last_name = 'Two'),
  'de operationele players-rij van speler B blijft bestaan'
);

-- Batch met 1 ongeldige rij (lege voornaam): overige rij slaagt alsnog.
select is(
  (select r->>'saved' from public.import_roster_rows_merge(
    (select t.id from public.teams t join public.club_teams ct on ct.id = t.club_team_id where ct.name = 'U13B Import'),
    jsonb_build_array(
      jsonb_build_object('first_name', '', 'last_name', 'Invalid', 'date_of_birth', null, 'email', null, 'phone', null),
      jsonb_build_object('first_name', 'Valid', 'last_name', 'Row', 'date_of_birth', null, 'email', null, 'phone', null)
    )
  ) r),
  '1', 'batch met 1 ongeldige rij: de geldige rij slaagt alsnog (savepoint per rij)'
);
select is(
  (select jsonb_array_length(r->'failed') from public.import_roster_rows_merge(
    (select t.id from public.teams t join public.club_teams ct on ct.id = t.club_team_id where ct.name = 'U13B Import'),
    jsonb_build_array(jsonb_build_object('first_name', '', 'last_name', 'Invalid2', 'date_of_birth', null, 'email', null, 'phone', null))
  ) r),
  1, 'de ongeldige rij komt terug in de failed-lijst'
);
select ok(
  exists(select 1 from public.club_players where last_name = 'Row'),
  'de geldige rij uit de gemengde batch is effectief opgeslagen'
);

select throws_ok(
  $$select public.import_roster_rows_merge(
    (select id from public.teams where name = 'Personal Import Team'),
    jsonb_build_array(jsonb_build_object('first_name', 'X', 'last_name', 'Y', 'date_of_birth', null, 'email', null, 'phone', null))
  )$$,
  'P0001', 'TEAM_NOT_A_CLUB_TEAM', 'importeren voor een persoonlijk team wordt geweigerd'
);

-- ---------------------------------------------------------------------------
-- Vertrouwensgrens-regressie: de 4 niet-gegrante functies mogen nooit rechtstreeks vanaf
-- een ingelogde sessie aanroepbaar zijn.
-- ---------------------------------------------------------------------------
set local role authenticated;
select set_config('request.jwt.claims', json_build_object('sub', '30000000-0000-0000-0000-000000000001')::text, true);
select throws_ok(
  $$select public.ensure_active_club_season((select id from public.clubs where name = 'Test Roster Import Club'))$$,
  '42501', null, 'ensure_active_club_season is niet aanroepbaar vanaf een ingelogde sessie'
);
select throws_ok(
  $$select public.import_roster_rows_merge(
    (select t.id from public.teams t join public.club_teams ct on ct.id = t.club_team_id where ct.name = 'U13A Import'),
    '[]'::jsonb
  )$$,
  '42501', null, 'import_roster_rows_merge is niet aanroepbaar vanaf een ingelogde sessie'
);
reset role;

select * from finish();
rollback;
