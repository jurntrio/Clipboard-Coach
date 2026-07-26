-- Run after migrations with: supabase test db
-- Covers 0030_club_player_identity_schema.sql and 0031_backfill_club_player_identity.sql.
begin;
create extension if not exists pgtap;
select plan(44);

-- ---------------------------------------------------------------------------
-- Normalisatie (geen fixtures nodig)
-- ---------------------------------------------------------------------------
select is(public.normalize_person_name('Van den Berg'), public.normalize_person_name('Vandenberg'),
  'Van den Berg en Vandenberg normaliseren gelijk');
select is(public.normalize_person_name(e'D\'Haene'), public.normalize_person_name('Dhaene'),
  'apostrof wordt genegeerd');
select is(public.normalize_person_name(e'Émile'), public.normalize_person_name('Emile'),
  'accenten worden genegeerd');
select is(public.normalize_person_name('De Busschere'), public.normalize_person_name('De-Busschere'),
  'koppelteken en spatie normaliseren gelijk');
select is(public.normalize_person_name('Louis-Jan'), public.normalize_person_name('Louis Jan'),
  'koppelteken vs spatie in voornaam normaliseert gelijk');

-- ---------------------------------------------------------------------------
-- Schema-aanwezigheid
-- ---------------------------------------------------------------------------
select has_table('public', 'club_seasons', 'club_seasons bestaat');
select has_table('public', 'club_players', 'club_players bestaat');
select has_table('public', 'player_team_memberships', 'player_team_memberships bestaat');
select has_table('public', 'club_player_migration_issues', 'club_player_migration_issues bestaat');
select has_column('public', 'players', 'membership_id', 'players.membership_id bestaat');
select has_column('public', 'player_team_memberships', 'updated_at', 'player_team_memberships.updated_at bestaat');

-- Datumconstraints
select throws_ok(
  $$insert into public.club_seasons (club_id, name, starts_on, ends_on)
    values (gen_random_uuid(), 'Bad', '2027-06-30', '2026-07-01')$$,
  '23514', null, 'club_seasons.starts_on <= ends_on wordt afgedwongen'
);

-- ---------------------------------------------------------------------------
-- Fixtures: club, 3 clubteams + operationele teams, 1 persoonlijk team, gebruikers
-- ---------------------------------------------------------------------------
insert into public.clubs (name, rbfa_registration_number) values ('Test Player Identity Club', 'TPI-001');

insert into public.club_teams (club_id, name, trainers_can_edit_roster)
select id, 'U13A Test', true from public.clubs where name = 'Test Player Identity Club';
insert into public.club_teams (club_id, name, trainers_can_edit_roster)
select id, 'U13B Test', true from public.clubs where name = 'Test Player Identity Club';
insert into public.club_teams (club_id, name, trainers_can_edit_roster)
select id, 'U17 Test', true from public.clubs where name = 'Test Player Identity Club';

insert into public.teams (coach_id, name, club_name, club_team_id)
select null, ct.name, c.name, ct.id
from public.club_teams ct join public.clubs c on c.id = ct.club_id
where c.name = 'Test Player Identity Club';

insert into auth.users (id, email, raw_user_meta_data) values
  ('20000000-0000-0000-0000-000000000001', 'admin@tpi.test', '{"full_name":"Admin Tpi"}'),
  ('20000000-0000-0000-0000-000000000002', 'trainer13a@tpi.test', '{"full_name":"Trainer U13A"}');

insert into public.club_memberships (club_id, profile_id, role, status)
select c.id, '20000000-0000-0000-0000-000000000001', 'club_admin', 'active'
from public.clubs c where c.name = 'Test Player Identity Club';

-- Realistische trainer heeft, net als via complete_club_team_onboarding(), zowel een
-- club_memberships-rij (voor clubbrede RLS zoals "clubs bekijken") als een club_trainers/
-- club_trainer_teams-koppeling (voor team-specifieke rechten).
insert into public.club_memberships (club_id, profile_id, role, status)
select c.id, '20000000-0000-0000-0000-000000000002', 'coach', 'active'
from public.clubs c where c.name = 'Test Player Identity Club';

insert into public.club_trainers (club_id, profile_id, display_name, invitation_status)
select c.id, '20000000-0000-0000-0000-000000000002', 'Trainer U13A', 'linked'
from public.clubs c where c.name = 'Test Player Identity Club';

insert into public.club_trainer_teams (trainer_id, club_team_id, status)
select ctr.id, ct.id, 'active'
from public.club_trainers ctr
join public.club_teams ct on ct.club_id = ctr.club_id and ct.name = 'U13A Test'
where ctr.profile_id = '20000000-0000-0000-0000-000000000002';

-- persoonlijk (niet-club) team van dezelfde trainer, om uitsluiting uit de backfill te testen
insert into public.teams (coach_id, name) values ('20000000-0000-0000-0000-000000000002', 'Personal Team Test');

-- ---------------------------------------------------------------------------
-- Testspelers
-- ---------------------------------------------------------------------------
-- Jan Janssens: zelfde kind in U13A + U13B (multi-team), en een naamgenoot in een persoonlijk
-- team die buiten de backfill moet blijven.
insert into public.players (team_id, first_name, last_name, date_of_birth)
select t.id, 'Jan', 'Janssens', '2013-05-01'
from public.teams t join public.club_teams ct on ct.id = t.club_team_id where ct.name = 'U13A Test';
insert into public.players (team_id, first_name, last_name, date_of_birth)
select t.id, 'Jan', 'Janssens', '2013-05-01'
from public.teams t join public.club_teams ct on ct.id = t.club_team_id where ct.name = 'U13B Test';
insert into public.players (team_id, first_name, last_name, date_of_birth)
select id, 'Jan', 'Janssens', '2013-05-01' from public.teams where name = 'Personal Team Test';

-- Piet Pieters: namesaken zonder geboortedatum, mogen niet automatisch samenvallen.
insert into public.players (team_id, first_name, last_name, date_of_birth)
select t.id, 'Piet', 'Pieters', null
from public.teams t join public.club_teams ct on ct.id = t.club_team_id where ct.name = 'U13A Test';
insert into public.players (team_id, first_name, last_name, date_of_birth)
select t.id, 'Piet', 'Pieters', null
from public.teams t join public.club_teams ct on ct.id = t.club_team_id where ct.name = 'U13B Test';

-- Emma Solo: precies 1 team -> ondubbelzinnig, mag automatisch 'primary' worden.
insert into public.players (team_id, first_name, last_name, date_of_birth)
select t.id, 'Emma', 'Solo', '2012-01-01'
from public.teams t join public.club_teams ct on ct.id = t.club_team_id where ct.name = 'U17 Test';

-- Sam Duplicate: 2 legacy players-rijen in HETZELFDE team (data-fout), test de
-- duplicate_membership-veiligheidsklep + issue_key-idempotentie.
insert into public.players (team_id, first_name, last_name, date_of_birth)
select t.id, 'Sam', 'Duplicate', '2013-01-01'
from public.teams t join public.club_teams ct on ct.id = t.club_team_id where ct.name = 'U13A Test';
insert into public.players (team_id, first_name, last_name, date_of_birth)
select t.id, 'Sam', 'Duplicate', '2013-01-01'
from public.teams t join public.club_teams ct on ct.id = t.club_team_id where ct.name = 'U13A Test';

-- Anna Contact: zelfde kind, 2 teams, VERSCHILLEND e-mailadres -> conflicting_contact_data.
insert into public.players (team_id, first_name, last_name, date_of_birth, email)
select t.id, 'Anna', 'Contact', '2013-03-03', 'a@old.test'
from public.teams t join public.club_teams ct on ct.id = t.club_team_id where ct.name = 'U13A Test';
insert into public.players (team_id, first_name, last_name, date_of_birth, email)
select t.id, 'Anna', 'Contact', '2013-03-03', 'a@new.test'
from public.teams t join public.club_teams ct on ct.id = t.club_team_id where ct.name = 'U13B Test';

-- Tom Fillin: zelfde kind, 2 teams, 1 leeg e-mailveld -> mag veilig aangevuld worden.
insert into public.players (team_id, first_name, last_name, date_of_birth, email)
select t.id, 'Tom', 'Fillin', '2013-06-06', null
from public.teams t join public.club_teams ct on ct.id = t.club_team_id where ct.name = 'U13A Test';
insert into public.players (team_id, first_name, last_name, date_of_birth, email)
select t.id, 'Tom', 'Fillin', '2013-06-06', 'tom@example.test'
from public.teams t join public.club_teams ct on ct.id = t.club_team_id where ct.name = 'U13B Test';

-- ---------------------------------------------------------------------------
-- Backfill: eerste run
-- ---------------------------------------------------------------------------
select public.backfill_club_players_from_players();

select is(
  (select count(*)::int from public.club_players cp join public.clubs c on c.id = cp.club_id
    where c.name = 'Test Player Identity Club'),
  7, 'exact 7 club_players-rijen: Janssens(1) + Pieters(2) + Solo(1) + Duplicate(1) + Contact(1) + Fillin(1)'
);

select is(
  (select count(distinct ptm.club_player_id)::int from public.player_team_memberships ptm
    join public.club_players cp on cp.id = ptm.club_player_id where cp.last_name = 'Janssens'),
  1, 'beide Janssens-teamrijen wijzen naar dezelfde club_player_id'
);
select is(
  (select count(*)::int from public.player_team_memberships ptm
    join public.club_players cp on cp.id = ptm.club_player_id where cp.last_name = 'Janssens'),
  2, 'Janssens heeft 2 memberships (U13A + U13B)'
);
select is(
  (select count(*)::int from public.player_team_memberships ptm
    join public.club_players cp on cp.id = ptm.club_player_id
    where cp.last_name = 'Janssens' and ptm.membership_type = 'primary'),
  0, 'geen enkele Janssens-membership wordt gegokt als primary'
);
select ok(
  exists(select 1 from public.club_player_migration_issues
    where issue_type = 'unassigned_primary_team'
      and candidate_club_player_id = (select id from public.club_players where last_name = 'Janssens')),
  'unassigned_primary_team reviewrij staat klaar voor Janssens'
);

select is(
  (select membership_type from public.player_team_memberships ptm
    join public.club_players cp on cp.id = ptm.club_player_id where cp.last_name = 'Solo'),
  'primary', 'eenmalig teamlid (Solo) wordt automatisch primary'
);

select ok(
  (select membership_id from public.players
    where team_id = (select id from public.teams where name = 'Personal Team Test')) is null,
  'speler van een persoonlijk team blijft ongekoppeld'
);

select is(
  (select count(*)::int from public.club_players where last_name = 'Pieters'
    and club_id = (select id from public.clubs where name = 'Test Player Identity Club')),
  2, 'namesaken zonder geboortedatum worden niet automatisch samengevoegd'
);

select is(
  (select count(*)::int from public.club_players where last_name = 'Duplicate'),
  1, 'de 2 legacy Duplicate-rijen matchen wel op dezelfde club_player (identieke naam+DOB)'
);
select ok(
  exists(select 1 from public.club_player_migration_issues where issue_type = 'duplicate_membership'),
  'de 2e Duplicate-rij wordt gerapporteerd i.p.v. de players_membership_unique_idx te laten crashen'
);
select is(
  (select count(*)::int from public.players p
    join public.club_players cp on cp.first_name = 'Sam' and cp.last_name = 'Duplicate'
    where p.first_name = 'Sam' and p.last_name = 'Duplicate' and p.membership_id is not null),
  1, 'maar 1 van de 2 Duplicate legacy-rijen krijgt effectief een membership_id'
);

select ok(
  (select email from public.club_players where last_name = 'Contact') in ('a@old.test', 'a@new.test'),
  'conflicterend e-mailadres: bestaande waarde blijft één van beide, nooit een derde/lege waarde'
);
select is(
  (select count(*)::int from public.club_player_migration_issues where issue_type = 'conflicting_contact_data'),
  1, 'conflicterend e-mailadres wordt exact 1 keer gerapporteerd'
);

select is(
  (select email from public.club_players where last_name = 'Fillin'),
  'tom@example.test', 'een leeg importveld vult aan zonder de bestaande waarde te wissen'
);

-- ---------------------------------------------------------------------------
-- Idempotentie: tweede run mag niets dupliceren
-- ---------------------------------------------------------------------------
select public.backfill_club_players_from_players();

select is(
  (select count(*)::int from public.club_players cp join public.clubs c on c.id = cp.club_id
    where c.name = 'Test Player Identity Club'),
  7, 'herhaald draaien creëert geen extra club_players-rijen'
);
select is(
  (select count(*)::int from public.player_team_memberships ptm
    join public.club_players cp on cp.id = ptm.club_player_id
    join public.clubs c on c.id = cp.club_id where c.name = 'Test Player Identity Club'),
  10, 'herhaald draaien creëert geen extra memberships (Janssens 2 + Pieters 2 + Solo 1 + Duplicate 1 + Contact 2 + Fillin 2)'
);
select is(
  (select count(*)::int from public.club_player_migration_issues where club_id =
    (select id from public.clubs where name = 'Test Player Identity Club')),
  7, 'herhaald draaien dupliceert geen reviewrijen (unassigned_primary_team x3: Janssens/Contact/Fillin, duplicate_membership x1, conflicting_contact_data x1, missing_date_of_birth x2)'
);

-- ---------------------------------------------------------------------------
-- Clubgrenzen: seizoen en team moeten bij dezelfde club horen
-- ---------------------------------------------------------------------------
insert into public.clubs (name) values ('Other Test Club For Season');
insert into public.club_teams (club_id, name)
select id, 'Other Team' from public.clubs where name = 'Other Test Club For Season';
insert into public.teams (coach_id, name, club_team_id)
select null, ct.name, ct.id from public.club_teams ct
join public.clubs c on c.id = ct.club_id where c.name = 'Other Test Club For Season';
insert into public.club_seasons (club_id, name, starts_on, ends_on)
select id, 'Other-Season', '2026-07-01', '2027-06-30' from public.clubs where name = 'Other Test Club For Season';

select throws_ok(
  $$insert into public.player_team_memberships (club_player_id, team_id, season_id)
    values (
      (select id from public.club_players where last_name = 'Solo'),
      (select t.id from public.teams t join public.club_teams ct on ct.id = t.club_team_id where ct.name = 'Other Team'),
      (select id from public.club_seasons where club_id =
        (select id from public.clubs where name = 'Test Player Identity Club') and is_active)
    )$$,
  'P0001', 'MEMBERSHIP_CLUB_MISMATCH', 'team van een andere club wordt geweigerd'
);
select throws_ok(
  $$insert into public.player_team_memberships (club_player_id, team_id, season_id)
    values (
      (select id from public.club_players where last_name = 'Solo'),
      (select t.id from public.teams t join public.club_teams ct on ct.id = t.club_team_id where ct.name = 'U17 Test'),
      (select id from public.club_seasons where name = 'Other-Season')
    )$$,
  'P0001', 'MEMBERSHIP_SEASON_CLUB_MISMATCH', 'seizoen van een andere club wordt geweigerd'
);

select throws_ok(
  $$update public.players set membership_id = (select membership_id from public.players where last_name = 'Solo')
    where id = (select id from public.players where last_name = 'Duplicate' and membership_id is null limit 1)$$,
  '23505', null, 'players_membership_unique_idx voorkomt 2 operationele rijen op dezelfde membership'
);

-- ---------------------------------------------------------------------------
-- set_active_club_season: transactioneel en club-gescoped
-- ---------------------------------------------------------------------------
insert into public.club_seasons (club_id, name, starts_on, ends_on, is_active)
select id, '2099-2100', '2099-07-01', '2100-06-30', false
from public.clubs where name = 'Test Player Identity Club';

select lives_ok(
  $$select public.set_active_club_season(
    (select id from public.clubs where name = 'Test Player Identity Club'),
    (select id from public.club_seasons where name = '2099-2100')
  )$$,
  'set_active_club_season activeert een geldig seizoen van de juiste club'
);
select is(
  (select count(*)::int from public.club_seasons where club_id =
    (select id from public.clubs where name = 'Test Player Identity Club') and is_active),
  1, 'nog steeds maar 1 actief seizoen na de omschakeling'
);
select throws_ok(
  $$select public.set_active_club_season(
    (select id from public.clubs where name = 'Test Player Identity Club'),
    (select id from public.club_seasons where name = 'Other-Season')
  )$$,
  'P0001', 'SEASON_NOT_FOUND_FOR_CLUB', 'activeren van andermans seizoen wordt geblokkeerd'
);

-- ---------------------------------------------------------------------------
-- merge_club_players: club-admin-only, auth.uid()-gebaseerd, blokkeert op overlap
-- ---------------------------------------------------------------------------
select set_config('request.jwt.claims',
  json_build_object('sub', '20000000-0000-0000-0000-000000000002')::text, true);
select throws_ok(
  $$select public.merge_club_players(
    (select id from public.club_players where last_name = 'Pieters' limit 1),
    (select id from public.club_players where last_name = 'Pieters' offset 1 limit 1)
  )$$,
  'P0001', 'MERGE_FORBIDDEN', 'een trainer mag nooit samenvoegen, ook niet met rosterrechten'
);

select set_config('request.jwt.claims',
  json_build_object('sub', '20000000-0000-0000-0000-000000000001')::text, true);
select lives_ok(
  $$select public.merge_club_players(
    (select id from public.club_players where last_name = 'Pieters' limit 1),
    (select id from public.club_players where last_name = 'Pieters' offset 1 limit 1)
  )$$,
  'club-admin mag niet-overlappende club_players samenvoegen'
);
select is(
  (select count(*)::int from public.club_players where last_name = 'Pieters'),
  1, 'na de merge is er nog maar 1 Pieters-rij'
);
select is(
  (select count(*)::int from public.player_team_memberships ptm
    join public.club_players cp on cp.id = ptm.club_player_id where cp.last_name = 'Pieters'),
  2, 'de samengevoegde speler heeft nu 2 memberships (U13A + U13B)'
);

-- Overlap-scenario: 2 losse club_players met een membership voor HETZELFDE team+seizoen.
insert into public.club_players (club_id, first_name, last_name, date_of_birth) values
  ((select id from public.clubs where name = 'Test Player Identity Club'), 'Overlap', 'Case', '2013-09-09'),
  ((select id from public.clubs where name = 'Test Player Identity Club'), 'Overlap', 'Case', '2013-09-10');
insert into public.player_team_memberships (club_player_id, team_id, season_id, membership_type)
select (select id from public.club_players where first_name = 'Overlap' and date_of_birth = '2013-09-09'),
  (select t.id from public.teams t join public.club_teams ct on ct.id = t.club_team_id where ct.name = 'U13A Test'),
  (select id from public.club_seasons where club_id = (select id from public.clubs where name = 'Test Player Identity Club') limit 1),
  'secondary';
insert into public.player_team_memberships (club_player_id, team_id, season_id, membership_type)
select (select id from public.club_players where first_name = 'Overlap' and date_of_birth = '2013-09-10'),
  (select t.id from public.teams t join public.club_teams ct on ct.id = t.club_team_id where ct.name = 'U13A Test'),
  (select id from public.club_seasons where club_id = (select id from public.clubs where name = 'Test Player Identity Club') limit 1),
  'secondary';

-- geen exacte message meegeven: de echte foutmelding bevat een dynamisch aantal
-- ("... : 1 overlappende memberships"), throws_ok vereist een exacte match.
select throws_ok(
  $$select public.merge_club_players(
    (select id from public.club_players where first_name = 'Overlap' and date_of_birth = '2013-09-09'),
    (select id from public.club_players where first_name = 'Overlap' and date_of_birth = '2013-09-10')
  )$$,
  'P0001', null,
  'merge met een echte membership-overlap wordt volledig geblokkeerd, niet stilzwijgend opgelost'
);
select is(
  (select count(*)::int from public.club_players where first_name = 'Overlap'),
  2, 'beide Overlap-rijen blijven bestaan na de geblokkeerde merge'
);

-- ---------------------------------------------------------------------------
-- RLS: kijken (club-scoped) vs. beheren (club-admin-only voor identiteit)
-- ---------------------------------------------------------------------------
set local role authenticated;
select set_config('request.jwt.claims',
  json_build_object('sub', '20000000-0000-0000-0000-000000000002')::text, true);

select is(
  (select count(*)::int from public.club_players where last_name = 'Solo'),
  0, 'U13A-trainer ziet geen club_players buiten zijn eigen team (Solo speelt enkel U17)'
);
select ok(
  exists(select 1 from public.club_players where last_name = 'Janssens'),
  'U13A-trainer ziet zijn eigen teamspelers wel'
);
select throws_ok(
  $$insert into public.club_players (club_id, first_name, last_name)
    values ((select id from public.clubs where name = 'Test Player Identity Club'), 'New', 'Direct')$$,
  '42501', null, 'een trainer mag nooit rechtstreeks een club_players-rij invoegen, ook niet voor zijn eigen team'
);

reset role;

select * from finish();
rollback;
