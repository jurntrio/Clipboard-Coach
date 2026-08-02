-- Run after migrations with: supabase test db
-- Covers 0036_guardian_contact_invites.sql: contact_label/contact_phone op player_invites, en
-- dat handle_new_user() een club_players-adres/e-mail/telefoon enkel invult als het nog leeg
-- is, nooit een reeds ingevulde (clubadmin- of eerder-ouder-)waarde overschrijft.
begin;
create extension if not exists pgtap;
select plan(8);

select has_column('public', 'player_invites', 'contact_label', 'player_invites heeft contact_label');
select has_column('public', 'player_invites', 'contact_phone', 'player_invites heeft contact_phone');

insert into auth.users (id, email, raw_user_meta_data) values
  ('60000000-0000-0000-0000-000000000001', 'contactcoach@tgc.test', '{"full_name":"Contact Coach"}');
insert into public.clubs (name, rbfa_registration_number) values ('Test Contact Club', 'TCC-001');
insert into public.club_teams (club_id, name, trainers_can_edit_roster)
select id, 'Contact Team', true from public.clubs where name = 'Test Contact Club';
insert into public.teams (coach_id, name, club_name, club_team_id)
select null, ct.name, c.name, ct.id
from public.club_teams ct join public.clubs c on c.id = ct.club_id
where c.name = 'Test Contact Club';
select set_config('test.contact_team_id',
  (select t.id::text from public.teams t join public.club_teams ct on ct.id = t.club_team_id where ct.name = 'Contact Team'), true);

-- "Filled Kid": clubadmin vulde het adres al in vóór er een ouder registreert.
select public.import_roster_rows_merge(
  current_setting('test.contact_team_id')::uuid,
  jsonb_build_array(jsonb_build_object('first_name', 'Filled', 'last_name', 'Kid', 'date_of_birth', '2014-01-01', 'email', null, 'phone', null))
);
select set_config('test.filled_kid_id', (select id::text from public.club_players where first_name = 'Filled' and last_name = 'Kid'), true);
update public.club_players set address = 'Kerkstraat 1', postal_code = '8820', city = 'Torhout'
where id = current_setting('test.filled_kid_id')::uuid;

-- "Empty Kid": nog geen enkel contactveld ingevuld.
select public.import_roster_rows_merge(
  current_setting('test.contact_team_id')::uuid,
  jsonb_build_array(jsonb_build_object('first_name', 'Empty', 'last_name', 'Kid', 'date_of_birth', '2014-06-01', 'email', null, 'phone', null))
);
select set_config('test.empty_kid_id', (select id::text from public.club_players where first_name = 'Empty' and last_name = 'Kid'), true);

insert into public.player_invites (club_player_id, created_by, contact_label, contact_phone, token_hash)
select current_setting('test.filled_kid_id')::uuid, '60000000-0000-0000-0000-000000000001', 'Mama', '0470111111',
  extensions.digest('60000000-0000-0000-0000-000000000050', 'sha256');
select is(
  (select contact_label from public.player_invites where club_player_id = current_setting('test.filled_kid_id')::uuid),
  'Mama', 'contact_label wordt opgeslagen op de uitnodiging'
);
select is(
  (select contact_phone from public.player_invites where club_player_id = current_setting('test.filled_kid_id')::uuid),
  '0470111111', 'contact_phone wordt opgeslagen op de uitnodiging'
);
select set_config('test.filled_kid_invite_token',
  '60000000-0000-0000-0000-000000000050', true);

insert into public.player_invites (club_player_id, created_by, token_hash)
select current_setting('test.empty_kid_id')::uuid, '60000000-0000-0000-0000-000000000001',
  extensions.digest('60000000-0000-0000-0000-000000000051', 'sha256');
select set_config('test.empty_kid_invite_token',
  '60000000-0000-0000-0000-000000000051', true);

-- Mama van "Filled Kid" registreert en probeert een ANDER adres mee te geven -- moet genegeerd worden.
insert into auth.users (id, email, raw_user_meta_data)
values ('60000000-0000-0000-0000-000000000002', 'mamafilled@tgc.test', jsonb_build_object(
  'full_name', 'Mama Filled', 'player_invite_token', current_setting('test.filled_kid_invite_token'),
  'child_address', 'Nieuwstraat 99', 'child_postal_code', '9000', 'child_city', 'Gent'
));
select is(
  (select address from public.club_players where id = current_setting('test.filled_kid_id')::uuid),
  'Kerkstraat 1', 'een reeds ingevuld adres wordt nooit overschreven door een nieuwe ouder'
);
select is(
  (select city from public.club_players where id = current_setting('test.filled_kid_id')::uuid),
  'Torhout', 'een reeds ingevulde gemeente wordt nooit overschreven'
);

-- Papa van "Empty Kid" registreert en vult het (nog lege) adres wel aan.
insert into auth.users (id, email, raw_user_meta_data)
values ('60000000-0000-0000-0000-000000000003', 'papaempty@tgc.test', jsonb_build_object(
  'full_name', 'Papa Empty', 'player_invite_token', current_setting('test.empty_kid_invite_token'),
  'child_address', 'Dorpsplein 5', 'child_postal_code', '8800', 'child_city', 'Roeselare'
));
select is(
  (select address from public.club_players where id = current_setting('test.empty_kid_id')::uuid),
  'Dorpsplein 5', 'een leeg adres wordt door de eerst-registrerende ouder ingevuld'
);
select is(
  (select city from public.club_players where id = current_setting('test.empty_kid_id')::uuid),
  'Roeselare', 'een lege gemeente wordt door de eerst-registrerende ouder ingevuld'
);

select * from finish();
rollback;
