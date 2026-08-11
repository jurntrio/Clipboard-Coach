-- Run after migrations with: supabase test db
begin;
create extension if not exists pgtap;
select plan(18);

select is(public.normalize_club_team_name('  K.M. Tórhout  '), 'k m torhout', 'club names are normalized');

insert into auth.users(id, email, raw_user_meta_data)
values (
  '10000000-0000-0000-0000-000000000001', 'creator@example.test',
  '{"full_name":"Club Creator","club_onboarding":{"club_mode":"new","club_name":"Test Racing Club","registration_number":"TEST-991","team_mode":"new","team_name":"U13 IP","age_category":"U13","level_or_competition":"IP","team_role":"coach"}}'
);
select ok(exists(select 1 from public.clubs where rbfa_registration_number = 'TEST-991'), 'new club is registered');
select ok(exists(select 1 from public.club_teams where name = 'U13 IP' and status = 'active'), 'first team is active');
select ok(exists(
  select 1 from public.club_memberships
  where profile_id = '10000000-0000-0000-0000-000000000001'
    and role = 'club_admin' and status = 'active'
    and function_role = 'club_admin' and team_scope = 'all'
), 'new club creator becomes the active club admin');
select is(
  (select account_role from public.profiles where id = '10000000-0000-0000-0000-000000000001'),
  'club_admin',
  'new club creator receives the matching account role'
);

insert into auth.users(id, email, raw_user_meta_data)
select '10000000-0000-0000-0000-000000000002', 'coach@example.test',
  jsonb_build_object('full_name','Existing Coach','club_onboarding',jsonb_build_object(
    'club_mode','existing','club_id',c.id,'team_mode','existing','team_id',t.id,'team_role','coach'
  ))
from public.clubs c join public.club_teams t on t.club_id = c.id
where c.rbfa_registration_number = 'TEST-991' and t.name = 'U13 IP';
select ok(exists(select 1 from public.club_trainers where profile_id = '10000000-0000-0000-0000-000000000002'), 'existing team user is linked');
select ok(exists(
  select 1 from public.club_memberships
  where profile_id = '10000000-0000-0000-0000-000000000002'
    and role = 'trainer' and status = 'pending'
), 'joining an existing club remains a pending trainer request');

insert into auth.users(id, email, raw_user_meta_data)
select '10000000-0000-0000-0000-000000000003', 'assistant@example.test',
  jsonb_build_object('full_name','Assistant','club_onboarding',jsonb_build_object(
    'club_mode','existing','club_id',c.id,'team_mode','new','team_name','U15 Gewestelijk','age_category','U15','team_role','assistant_coach'
  ))
from public.clubs c where c.rbfa_registration_number = 'TEST-991';
select ok(exists(select 1 from public.club_teams where name = 'U15 Gewestelijk' and status = 'pending'), 'user-created team is pending');
select ok(not exists(select 1 from public.club_memberships where profile_id = '10000000-0000-0000-0000-000000000003' and role = 'club_admin'), 'team requester is not club admin');

select throws_ok(
  $$insert into public.clubs(name, normalized_name, rbfa_registration_number) values ('Other Test Club','other test club','TEST-991')$$,
  '23505', null, 'duplicate registration number is blocked'
);
select throws_ok(
  $$insert into public.club_teams(club_id,name,normalized_name) select id,'u13 ip','u13 ip' from public.clubs where rbfa_registration_number='TEST-991'$$,
  '23505', null, 'duplicate team name in the same season is blocked'
);

select throws_ok(
  $$select public.complete_club_team_onboarding('10000000-0000-0000-0000-000000000002','coach@example.test','Coach','{"club_mode":"new","club_name":"Race Duplicate","registration_number":"TEST-991","team_mode":"new","team_name":"U17"}')$$,
  'P0001', 'DUPLICATE_REGISTRATION_USE_EXISTING', 'transactional onboarding blocks the same registration number'
);

insert into public.club_teams(club_id,name,normalized_name,status,created_by)
select id,'U13 Provincial','u13 provincial','active','10000000-0000-0000-0000-000000000001'
from public.clubs where rbfa_registration_number='TEST-991';
update public.club_memberships
set role = 'club_admin', status = 'active'
where profile_id = '10000000-0000-0000-0000-000000000001'
  and club_id = (select id from public.clubs where rbfa_registration_number='TEST-991');
select lives_ok(
  $$select public.merge_club_teams(
    (select id from public.club_teams where name='U13 Provincial'),
    (select id from public.club_teams where name='U13 IP'),
    '10000000-0000-0000-0000-000000000001', false
  )$$, 'approved club admin can merge teams'
);
select ok(exists(select 1 from public.club_teams where name='U13 Provincial' and status='merged'), 'source team is retained as merged');
select ok(exists(
  select 1 from public.club_trainer_teams ctt
  join public.club_trainers ct on ct.id=ctt.trainer_id
  join public.club_teams t on t.id=ctt.club_team_id
  where ct.profile_id='10000000-0000-0000-0000-000000000002' and t.name='U13 IP'
), 'team merge preserves user links');

insert into auth.users(id,email,raw_user_meta_data) values
('10000000-0000-0000-0000-000000000004','outsider@example.test','{"full_name":"Outsider"}');
select throws_ok(
  $$select public.merge_club_teams(
    (select id from public.club_teams where name='U15 Gewestelijk'),
    (select id from public.club_teams where name='U13 IP'),
    '10000000-0000-0000-0000-000000000004', false
  )$$,
  'P0001', 'MERGE_FORBIDDEN', 'another club user cannot manage teams'
);

update public.club_teams set status='inactive' where name='U13 IP';
select ok(exists(select 1 from public.club_teams where name='U13 IP' and status='inactive'), 'teams are soft-disabled rather than deleted');
select is((select count(*)::integer from public.club_trainer_teams ctt join public.club_teams t on t.id=ctt.club_team_id where t.name='U13 IP'), 2, 'inactive team retains user links');

select * from finish();
rollback;
