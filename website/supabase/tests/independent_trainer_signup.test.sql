begin;
create extension if not exists pgtap;
select plan(6);

insert into auth.users(id, email, raw_user_meta_data) values
  ('31000000-0000-0000-0000-000000000001', 'bjorn@example.test',
   '{"full_name":"Bjorn","club_onboarding":{"request_kind":"personal_trainer","club_mode":"personal","club_name":"Olympic Ledegem","team_mode":"new","team_name":"U17","age_category":"U17"}}'),
  ('31000000-0000-0000-0000-000000000002', 'steven@example.test',
   '{"full_name":"Steven","club_onboarding":{"request_kind":"personal_trainer","club_mode":"personal","club_name":"Olympic Ledegem","team_mode":"new","team_name":"U17","age_category":"U17"}}');

select is((select count(*)::integer from public.clubs where name='Olympic Ledegem' and is_personal), 2,
  'trainers may enter the same personal club name');
select is((select count(*)::integer from public.club_teams where name='U17' and club_id in
  (select id from public.clubs where name='Olympic Ledegem' and is_personal)), 2,
  'each trainer gets a separate team tenant');
select is((select count(*)::integer from public.club_registration_requests where profile_id in
  ('31000000-0000-0000-0000-000000000001','31000000-0000-0000-0000-000000000002')), 0,
  'personal registration creates no club approval request');
select ok(not exists(
  select 1 from public.club_memberships a join public.club_memberships b on a.club_id=b.club_id
  where a.profile_id='31000000-0000-0000-0000-000000000001'
    and b.profile_id='31000000-0000-0000-0000-000000000002'),
  'the trainer accounts share no club tenant');
select is((select account_role from public.profiles where id='31000000-0000-0000-0000-000000000001'), 'coach',
  'the public account role remains coach');
select ok(exists(select 1 from public.teams where coach_id='31000000-0000-0000-0000-000000000001'
  and name='U17' and club_name='Olympic Ledegem'),
  'the operational team is ready immediately');

select * from finish();
rollback;
