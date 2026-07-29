begin;
select plan(5);

insert into public.clubs (id, name, normalized_name)
values ('58000000-0000-0000-0000-000000000001', 'Scope Test Club', 'scope test club');

insert into public.profiles (id, email, account_role)
values
  ('58000000-0000-0000-0000-000000000010', 'delegate@example.test', 'team_manager'),
  ('58000000-0000-0000-0000-000000000011', 'viewer@example.test', 'club_admin_viewer');

insert into public.club_teams (id, club_id, name)
values
  ('58000000-0000-0000-0000-000000000020', '58000000-0000-0000-0000-000000000001', 'U12'),
  ('58000000-0000-0000-0000-000000000021', '58000000-0000-0000-0000-000000000001', 'U14');

insert into public.club_memberships (club_id, profile_id, role, status, function_role, team_scope)
values
  ('58000000-0000-0000-0000-000000000001', '58000000-0000-0000-000000000010', 'team_manager', 'active', 'team_manager', 'assigned'),
  ('58000000-0000-0000-0000-000000000001', '58000000-0000-0000-0000-000000000011', 'club_admin_viewer', 'active', 'club_admin_viewer', 'all');

insert into public.club_member_team_access (club_id, profile_id, club_team_id)
values ('58000000-0000-0000-0000-000000000001', '58000000-0000-0000-0000-000000000010', '58000000-0000-0000-0000-000000000020');

select ok(public.club_member_can_access_team(
  '58000000-0000-0000-0000-000000000001', '58000000-0000-0000-0000-000000000010', '58000000-0000-0000-0000-000000000020'
), 'U12-afgevaardigde ziet U12');

select ok(not public.club_member_can_access_team(
  '58000000-0000-0000-0000-000000000001', '58000000-0000-0000-0000-000000000010', '58000000-0000-0000-0000-000000000021'
), 'U12-afgevaardigde ziet U14 niet');

select ok(public.club_member_can_access_team(
  '58000000-0000-0000-0000-000000000001', '58000000-0000-0000-0000-000000000011', '58000000-0000-0000-0000-000000000020'
), 'Club Admin Viewer ziet U12');

select ok(public.club_member_can_access_team(
  '58000000-0000-0000-0000-000000000001', '58000000-0000-0000-0000-000000000011', '58000000-0000-0000-0000-000000000021'
), 'Club Admin Viewer ziet U14');

select is(
  (select team_scope from public.club_memberships where profile_id = '58000000-0000-0000-0000-000000000010'),
  'assigned', 'teamscope wordt afzonderlijk van functierol opgeslagen'
);

select * from finish();
rollback;
