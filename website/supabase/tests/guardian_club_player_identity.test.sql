-- Run after migrations with: supabase test db
-- Covers 0034_guardian_club_player_identity.sql (Fase 3: player_invites/player_guardians op
-- club_player_id, access_scope-venster, guardian_dashboard_players()). No prior test file
-- covered player_guardians/player_invites at all, so this is new ground, not a regression suite.
begin;
create extension if not exists pgtap;
select plan(25);

-- ---------------------------------------------------------------------------
-- Schema-aanwezigheid
-- ---------------------------------------------------------------------------
select has_function('public', 'guardian_operational_player_ids', array['uuid'], 'guardian_operational_player_ids bestaat');
select has_function('public', 'guardian_club_player_ids', array['uuid'], 'guardian_club_player_ids bestaat');
select has_function('public', 'guardian_dashboard_players', array[]::text[], 'guardian_dashboard_players bestaat');
select has_function('public', 'guardian_team_ids', array['uuid'], 'guardian_team_ids bestaat (0027, hergebruikt de nieuwe helper)');

-- ---------------------------------------------------------------------------
-- Fixtures: 1 persoonlijk (niet-club) team + 1 clubteam met 2 seizoenen (1 actief, 1 verlopen).
-- ---------------------------------------------------------------------------
insert into auth.users (id, email, raw_user_meta_data) values
  ('50000000-0000-0000-0000-000000000002', 'personalcoach@tgc.test', '{"full_name":"Personal Coach"}');
insert into public.teams (coach_id, name) values
  ('50000000-0000-0000-0000-000000000002', 'Personal Guardian Team');
insert into public.players (team_id, first_name, last_name, role)
select id, 'Solo', 'Kid', 'player' from public.teams where name = 'Personal Guardian Team';

insert into public.clubs (name, rbfa_registration_number) values ('Test Guardian Club', 'TGC-001');
insert into public.club_teams (club_id, name, trainers_can_edit_roster)
select id, 'Guardian A', true from public.clubs where name = 'Test Guardian Club';
insert into public.teams (coach_id, name, club_name, club_team_id)
select null, ct.name, c.name, ct.id
from public.club_teams ct join public.clubs c on c.id = ct.club_id
where c.name = 'Test Guardian Club';
insert into public.club_seasons (club_id, name, starts_on, ends_on, is_active)
select id, 'Current Season', (current_date - interval '2 months')::date, (current_date + interval '10 months')::date, true
from public.clubs where name = 'Test Guardian Club';
insert into public.club_seasons (club_id, name, starts_on, ends_on, is_active)
select id, 'Past Season', (current_date - interval '14 months')::date, (current_date - interval '2 months')::date, false
from public.clubs where name = 'Test Guardian Club';

select set_config('test.guardian_a_team_id',
  (select t.id::text from public.teams t join public.club_teams ct on ct.id = t.club_team_id where ct.name = 'Guardian A'), true);

-- "Current Kid": lid van Guardian A in het actieve seizoen (via de bestaande importfunctie,
-- die zelf ensure_active_club_season gebruikt en dus in "Current Season" landt).
select public.import_roster_rows_merge(
  current_setting('test.guardian_a_team_id')::uuid,
  jsonb_build_array(jsonb_build_object('first_name', 'Current', 'last_name', 'Kid', 'date_of_birth', '2013-01-01', 'email', null, 'phone', null))
);
select set_config('test.current_kid_club_player_id',
  (select id::text from public.club_players where first_name = 'Current' and last_name = 'Kid'), true);

-- "Past Kid": lid van Guardian A, maar enkel in het VERLOPEN seizoen -- manueel opgezet, want
-- import_roster_rows_merge kiest altijd het actieve seizoen.
insert into public.club_players (club_id, first_name, last_name, date_of_birth)
select id, 'Past', 'Kid', '2012-01-01' from public.clubs where name = 'Test Guardian Club';
select set_config('test.past_kid_club_player_id',
  (select id::text from public.club_players where first_name = 'Past' and last_name = 'Kid'), true);
insert into public.player_team_memberships (club_player_id, team_id, season_id, membership_type)
values (
  current_setting('test.past_kid_club_player_id')::uuid,
  current_setting('test.guardian_a_team_id')::uuid,
  (select id from public.club_seasons where club_id = (select id from public.clubs where name = 'Test Guardian Club') and name = 'Past Season'),
  'primary'
);
insert into public.players (team_id, first_name, last_name, date_of_birth, role, membership_id)
select current_setting('test.guardian_a_team_id')::uuid, 'Past', 'Kid', '2012-01-01', 'player',
  (select id from public.player_team_memberships where club_player_id = current_setting('test.past_kid_club_player_id')::uuid);

-- ---------------------------------------------------------------------------
-- End-to-end via handle_new_user: persoonlijk-teampad (player_id) en clubbreed pad (club_player_id).
-- ---------------------------------------------------------------------------
insert into public.player_invites (player_id, created_by)
select p.id, '50000000-0000-0000-0000-000000000002' from public.players p where p.first_name = 'Solo' and p.last_name = 'Kid';
select set_config('test.solo_invite_token',
  (select token::text from public.player_invites pi join public.players p on p.id = pi.player_id where p.first_name = 'Solo'), true);

insert into public.player_invites (club_player_id, created_by)
select cp.id, '50000000-0000-0000-0000-000000000002' from public.club_players cp where cp.first_name = 'Current' and cp.last_name = 'Kid';
select set_config('test.current_kid_invite_token',
  (select token::text from public.player_invites where club_player_id = current_setting('test.current_kid_club_player_id')::uuid), true);

insert into auth.users (id, email, raw_user_meta_data)
values ('50000000-0000-0000-0000-000000000003', 'guardiana@tgc.test',
  jsonb_build_object('full_name', 'Guardian A', 'player_invite_token', current_setting('test.solo_invite_token')));
insert into auth.users (id, email, raw_user_meta_data)
values ('50000000-0000-0000-0000-000000000004', 'guardianb@tgc.test',
  jsonb_build_object('full_name', 'Guardian B', 'player_invite_token', current_setting('test.current_kid_invite_token')));

select ok(
  exists(select 1 from public.player_guardians where profile_id = '50000000-0000-0000-0000-000000000003'
    and player_id = (select id from public.players where first_name = 'Solo') and club_player_id is null),
  'persoonlijk-team-uitnodiging maakt een player_id-gebaseerde guardian-link'
);
select is(
  (select account_role from public.profiles where id = '50000000-0000-0000-0000-000000000003'),
  'player_parent', 'account_role wordt player_parent na aanvaarding'
);
select is(
  (select access_scope from public.player_guardians where profile_id = '50000000-0000-0000-0000-000000000003'),
  'from_acceptance', 'standaard access_scope is from_acceptance'
);
select ok(
  (select used_at from public.player_invites where token = current_setting('test.solo_invite_token')::uuid) is not null,
  'de persoonlijke uitnodiging is gemarkeerd als gebruikt'
);
select ok(
  exists(select 1 from public.player_guardians where profile_id = '50000000-0000-0000-0000-000000000004'
    and club_player_id = current_setting('test.current_kid_club_player_id')::uuid and player_id is null),
  'clubbrede uitnodiging maakt een club_player_id-gebaseerde guardian-link'
);

-- ---------------------------------------------------------------------------
-- guardian_operational_player_ids / guardian_club_player_ids / guardian_dashboard_players
-- ---------------------------------------------------------------------------
select is(
  (select count(*)::int from public.guardian_operational_player_ids('50000000-0000-0000-0000-000000000004'::uuid)),
  1, 'guardian B ziet exact 1 operationele players-rij (Current Kid, actief seizoen)'
);
select is(
  (select count(*)::int from public.guardian_club_player_ids('50000000-0000-0000-0000-000000000004'::uuid)),
  1, 'guardian_club_player_ids geeft de gekoppelde club_player_id terug voor guardian B'
);

set local role authenticated;
select set_config('request.jwt.claims', json_build_object('sub', '50000000-0000-0000-0000-000000000004')::text, true);
select is((select count(*)::int from public.guardian_dashboard_players()), 1, 'guardian_dashboard_players geeft 1 rij terug voor guardian B');
select is((select team_name from public.guardian_dashboard_players() limit 1), 'Guardian A', 'de rij bevat de juiste teamnaam');
select is((select count(*)::int from public.players where first_name = 'Current' and last_name = 'Kid'), 1, 'RLS laat guardian B de gekoppelde speler zien');
select is((select count(*)::int from public.players where first_name = 'Solo'), 0, 'RLS verbergt een niet-gekoppelde speler voor guardian B');
reset role;

-- ---------------------------------------------------------------------------
-- access_scope-venster: current_season / from_acceptance (default) / all_history, getest tegen
-- "Past Kid" (enkel lid in het verlopen seizoen).
-- ---------------------------------------------------------------------------
insert into auth.users (id, email, raw_user_meta_data) values
  ('50000000-0000-0000-0000-000000000005', 'guardianc@tgc.test', '{"full_name":"Guardian C"}'),
  ('50000000-0000-0000-0000-000000000006', 'guardiand@tgc.test', '{"full_name":"Guardian D"}'),
  ('50000000-0000-0000-0000-000000000007', 'outsider@tgc.test', '{"full_name":"Outsider"}'),
  ('50000000-0000-0000-0000-000000000008', 'guardiane@tgc.test', '{"full_name":"Guardian E"}');

insert into public.player_guardians (club_player_id, profile_id, access_scope)
values (current_setting('test.past_kid_club_player_id')::uuid, '50000000-0000-0000-0000-000000000005', 'current_season');
insert into public.player_guardians (club_player_id, profile_id, access_scope)
values (current_setting('test.past_kid_club_player_id')::uuid, '50000000-0000-0000-0000-000000000006', 'all_history');
-- Guardian E laat access_scope op de standaardwaarde (from_acceptance, valid_from = nu).
insert into public.player_guardians (club_player_id, profile_id)
values (current_setting('test.past_kid_club_player_id')::uuid, '50000000-0000-0000-0000-000000000008');

select is(
  (select count(*)::int from public.guardian_operational_player_ids('50000000-0000-0000-0000-000000000005'::uuid)),
  0, 'current_season verbergt een lidmaatschap in een niet-actief, verlopen seizoen'
);
select is(
  (select count(*)::int from public.guardian_operational_player_ids('50000000-0000-0000-0000-000000000006'::uuid)),
  1, 'all_history toont het lidmaatschap uit het verlopen seizoen wel'
);
select is(
  (select count(*)::int from public.guardian_operational_player_ids('50000000-0000-0000-0000-000000000008'::uuid)),
  0, 'from_acceptance (standaard) verbergt een seizoen dat al eindigde vóór de aanvaarding'
);

update public.player_guardians set revoked_at = now() where profile_id = '50000000-0000-0000-0000-000000000006';
select is(
  (select count(*)::int from public.guardian_operational_player_ids('50000000-0000-0000-0000-000000000006'::uuid)),
  0, 'revoked_at sluit toegang af, zelfs met all_history'
);

set local role authenticated;
select set_config('request.jwt.claims', json_build_object('sub', '50000000-0000-0000-0000-000000000007')::text, true);
select is(
  (select count(*)::int from public.players where first_name = 'Current' and last_name = 'Kid'),
  0, 'een niet-gekoppelde buitenstaander ziet geen enkele gekoppelde speler via RLS'
);
reset role;

-- ---------------------------------------------------------------------------
-- Constraints: exact 1 van player_id/club_player_id, en een geldige access_scope-waarde.
-- ---------------------------------------------------------------------------
select throws_ok(
  $$insert into public.player_guardians (player_id, club_player_id, profile_id) values (
    (select id from public.players where first_name = 'Solo'),
    current_setting('test.past_kid_club_player_id')::uuid,
    '50000000-0000-0000-0000-000000000007'
  )$$, '23514', null, 'player_guardians weigert een rij met zowel player_id als club_player_id'
);
select throws_ok(
  $$insert into public.player_guardians (profile_id) values ('50000000-0000-0000-0000-000000000007')$$,
  '23514', null, 'player_guardians weigert een rij zonder player_id of club_player_id'
);
select throws_ok(
  $$insert into public.player_guardians (club_player_id, profile_id, access_scope) values (
    current_setting('test.past_kid_club_player_id')::uuid, '50000000-0000-0000-0000-000000000007', 'bogus'
  )$$, '23514', null, 'access_scope is beperkt tot de 3 gekende waarden'
);
select throws_ok(
  $$insert into public.player_invites (player_id, club_player_id, created_by) values (
    (select id from public.players where first_name = 'Solo'),
    current_setting('test.past_kid_club_player_id')::uuid,
    '50000000-0000-0000-0000-000000000002'
  )$$, '23514', null, 'player_invites weigert een rij met zowel player_id als club_player_id'
);

-- ---------------------------------------------------------------------------
-- Vertrouwensgrens: guardian_dashboard_players mag niet als anon aanroepbaar zijn.
-- ---------------------------------------------------------------------------
set local role anon;
select throws_ok(
  $$select * from public.guardian_dashboard_players()$$,
  '42501', null, 'guardian_dashboard_players is niet aanroepbaar als anon'
);
reset role;

select * from finish();
rollback;
