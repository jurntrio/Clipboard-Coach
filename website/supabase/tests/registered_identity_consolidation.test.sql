begin;
create extension if not exists pgtap;
select plan(13);

insert into public.clubs(id, name, normalized_name)
values ('a1080000-0000-0000-0000-000000000001', 'Identity Club', 'identity club');
insert into public.club_teams(id, club_id, name)
values ('a1080000-0000-0000-0000-000000000010', 'a1080000-0000-0000-0000-000000000001', 'U15');
insert into auth.users(id, email, raw_user_meta_data) values
  ('a1080000-0000-0000-0000-000000000020', 'admin@identity.test', '{"full_name":"Ada Admin"}'),
  ('a1080000-0000-0000-0000-000000000021', 'coach@identity.test', '{"full_name":"Chris Coach"}');

insert into public.club_memberships(club_id, profile_id, role, status, function_role, team_scope)
values
  ('a1080000-0000-0000-0000-000000000001', 'a1080000-0000-0000-0000-000000000020', 'club_admin', 'active', 'club_admin', 'all'),
  ('a1080000-0000-0000-0000-000000000001', 'a1080000-0000-0000-0000-000000000021', 'trainer', 'active', 'trainer', 'assigned');

select is((select count(*) from public.person_accounts where profile_id in (
  'a1080000-0000-0000-0000-000000000020', 'a1080000-0000-0000-0000-000000000021'
) and status = 'active'), 2::bigint, 'membership creation links every registered profile to one person');
select is((select count(*) from public.club_people where club_id = 'a1080000-0000-0000-0000-000000000001'),
  2::bigint, 'each registered member has one canonical club person');

insert into public.club_trainers(club_id, profile_id, display_name, invitation_status)
values ('a1080000-0000-0000-0000-000000000001', 'a1080000-0000-0000-0000-000000000021', 'Chris Coach', 'linked');
select ok((select club_person_id from public.club_trainers where profile_id = 'a1080000-0000-0000-0000-000000000021') is not null,
  'legacy trainer projection receives the canonical club_person_id');
select is((select count(distinct pa.person_id) from public.person_accounts pa
  join public.club_people cp on cp.person_id = pa.person_id
  join public.club_trainers ct on ct.club_person_id = cp.id
  where pa.profile_id = 'a1080000-0000-0000-0000-000000000021'), 1::bigint,
  'account, club person and trainer projection resolve to the same natural person');

insert into public.club_trainer_teams(trainer_id, club_team_id, role, status)
select id, 'a1080000-0000-0000-0000-000000000010', 'coach', 'active'
from public.club_trainers where profile_id = 'a1080000-0000-0000-0000-000000000021';
select ok((select club_role_assignment_id from public.club_trainer_teams ctt
  join public.club_trainers ct on ct.id = ctt.trainer_id
  where ct.profile_id = 'a1080000-0000-0000-0000-000000000021') is not null,
  'team projection links to a canonical role assignment');
select is((select role_type from public.club_role_assignments role
  join public.club_trainer_teams ctt on ctt.club_role_assignment_id = role.id
  join public.club_trainers ct on ct.id = ctt.trainer_id
  where ct.profile_id = 'a1080000-0000-0000-0000-000000000021'), 'trainer',
  'legacy coach role maps to canonical trainer role');

select is(public.remove_registered_club_identity(
  'a1080000-0000-0000-0000-000000000001',
  'a1080000-0000-0000-0000-000000000021',
  'a1080000-0000-0000-0000-000000000020'
), 'Chris Coach', 'transactional removal returns the canonical person name');
select ok(not exists(select 1 from public.club_memberships where profile_id = 'a1080000-0000-0000-0000-000000000021'),
  'membership projection is removed');
select ok(not exists(select 1 from public.club_trainers where profile_id = 'a1080000-0000-0000-0000-000000000021'),
  'trainer projection is removed');
select is((select status from public.club_people cp join public.person_accounts pa on pa.person_id = cp.person_id
  where pa.profile_id = 'a1080000-0000-0000-0000-000000000021' and cp.club_id = 'a1080000-0000-0000-0000-000000000001'),
  'inactive', 'canonical club person is retained as inactive history');
select is((select status from public.club_role_assignments role join public.club_people cp on cp.id = role.club_person_id
  join public.person_accounts pa on pa.person_id = cp.person_id where pa.profile_id = 'a1080000-0000-0000-0000-000000000021'),
  'ended', 'canonical role is ended rather than deleted');
select is((select status from public.person_accounts where profile_id = 'a1080000-0000-0000-0000-000000000021'),
  'active', 'account-person identity remains available for another club');
select ok(not has_function_privilege('authenticated', 'public.remove_registered_club_identity(uuid,uuid,uuid)', 'EXECUTE'),
  'transactional identity removal is service-role-only');

select * from finish();
rollback;
