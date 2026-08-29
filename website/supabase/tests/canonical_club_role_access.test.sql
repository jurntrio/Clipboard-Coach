begin;
select plan(6);

insert into public.clubs(id, name, normalized_name)
values ('81000000-0000-0000-0000-000000000001', 'Canonical Roles Test', 'canonical roles test');

insert into auth.users(id, email, raw_user_meta_data)
values (
  '81000000-0000-0000-0000-000000000010',
  'canonical-role@example.test',
  '{"full_name":"Canonical Trainer"}'::jsonb
);

insert into public.club_teams(id, club_id, name)
values ('81000000-0000-0000-0000-000000000020', '81000000-0000-0000-0000-000000000001', 'U15');

insert into public.club_memberships(club_id, profile_id, role, status, function_role, team_scope)
values (
  '81000000-0000-0000-0000-000000000001',
  '81000000-0000-0000-0000-000000000010',
  'trainer', 'active', 'trainer', 'assigned'
);

select ok(exists(
  select 1 from public.person_accounts
  where profile_id = '81000000-0000-0000-0000-000000000010'
    and status = 'active' and revoked_at is null
), 'actief lid krijgt een canonieke person-accountkoppeling');

select ok(exists(
  select 1
  from public.club_role_assignments role
  join public.club_people cp on cp.id = role.club_person_id
  join public.person_accounts pa on pa.person_id = cp.person_id
  where pa.profile_id = '81000000-0000-0000-0000-000000000010'
    and cp.club_id = '81000000-0000-0000-0000-000000000001'
    and role.role_type = 'trainer' and role.club_team_id is null
    and role.team_scope = 'assigned' and role.status = 'active'
), 'actief lid krijgt een canonieke basisrol');

insert into public.club_member_team_access(club_id, profile_id, club_team_id)
values (
  '81000000-0000-0000-0000-000000000001',
  '81000000-0000-0000-0000-000000000010',
  '81000000-0000-0000-0000-000000000020'
);

select ok(exists(
  select 1
  from public.club_role_assignments role
  join public.club_people cp on cp.id = role.club_person_id
  join public.person_accounts pa on pa.person_id = cp.person_id
  where pa.profile_id = '81000000-0000-0000-0000-000000000010'
    and role.club_team_id = '81000000-0000-0000-0000-000000000020'
    and role.status = 'active'
), 'legacy teamtoegang projecteert naar canonieke teamtoegang');

update public.club_memberships
set role = 'analyst', function_role = 'video_analyst'
where club_id = '81000000-0000-0000-0000-000000000001'
  and profile_id = '81000000-0000-0000-0000-000000000010';

select is((
  select role.role_type
  from public.club_role_assignments role
  join public.club_people cp on cp.id = role.club_person_id
  join public.person_accounts pa on pa.person_id = cp.person_id
  where pa.profile_id = '81000000-0000-0000-0000-000000000010'
    and role.club_team_id is null and role.status = 'active'
), 'video_analyst', 'functiewijziging past de canonieke basisrol aan');

select is((
  select action_required from public.club_role_migration_audit
  where profile_id = '81000000-0000-0000-0000-000000000010'
    and club_id = '81000000-0000-0000-0000-000000000001'
), 'unchanged', 'audit markeert gesynchroniseerde persoon als ongewijzigd');

delete from public.club_member_team_access
where club_id = '81000000-0000-0000-0000-000000000001'
  and profile_id = '81000000-0000-0000-0000-000000000010'
  and club_team_id = '81000000-0000-0000-0000-000000000020';

select ok(not exists(
  select 1
  from public.club_role_assignments role
  join public.club_people cp on cp.id = role.club_person_id
  join public.person_accounts pa on pa.person_id = cp.person_id
  where pa.profile_id = '81000000-0000-0000-0000-000000000010'
    and role.club_team_id = '81000000-0000-0000-0000-000000000020'
    and role.status = 'active'
), 'verwijderde teamtoegang beëindigt de canonieke teamrol');

select * from finish();
rollback;
