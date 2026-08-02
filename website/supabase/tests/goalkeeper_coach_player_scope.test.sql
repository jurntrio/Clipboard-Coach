begin;
create extension if not exists pgtap;
select plan(8);

insert into public.clubs (id, name, normalized_name)
values ('a1010000-0000-0000-0000-000000000001', 'Keeper Scope Club', 'keeper scope club');

insert into auth.users (id, email, raw_user_meta_data)
values ('a1010000-0000-0000-0000-000000000002', 'keeper-coach@example.test', '{"full_name":"Keeper Coach"}');

insert into public.club_teams (id, club_id, name, trainers_can_edit_roster)
values ('a1010000-0000-0000-0000-000000000010', 'a1010000-0000-0000-0000-000000000001', 'U15', true);

insert into public.teams (id, coach_id, name, club_team_id)
values ('a1010000-0000-0000-0000-000000000011', null, 'U15', 'a1010000-0000-0000-0000-000000000010');

insert into public.players (id, team_id, first_name, last_name, is_goalkeeper)
values
  ('a1010000-0000-0000-0000-000000000020', 'a1010000-0000-0000-0000-000000000011', 'Assigned', 'Keeper', true),
  ('a1010000-0000-0000-0000-000000000021', 'a1010000-0000-0000-0000-000000000011', 'Other', 'Player', false);

insert into public.club_memberships (club_id, profile_id, role, status, function_role, team_scope)
values ('a1010000-0000-0000-0000-000000000001', 'a1010000-0000-0000-0000-000000000002', 'trainer', 'active', 'goalkeeper_coach', 'assigned');

insert into public.club_trainers (id, club_id, profile_id, display_name, invitation_status)
values ('a1010000-0000-0000-0000-000000000030', 'a1010000-0000-0000-0000-000000000001', 'a1010000-0000-0000-0000-000000000002', 'Keeper Coach', 'linked');

insert into public.club_trainer_teams (trainer_id, club_team_id, role, status)
values ('a1010000-0000-0000-0000-000000000030', 'a1010000-0000-0000-0000-000000000010', 'coach', 'active');

insert into public.club_trainer_players (trainer_id, player_id)
values ('a1010000-0000-0000-0000-000000000030', 'a1010000-0000-0000-0000-000000000020');

select ok(public.can_view_team_membership('a1010000-0000-0000-0000-000000000011', 'a1010000-0000-0000-0000-000000000002'), 'keeper coach can view the assigned team');
select ok(public.can_view_player_private_details('a1010000-0000-0000-0000-000000000020', 'a1010000-0000-0000-0000-000000000002'), 'assigned goalkeeper private row is visible');
select ok(not public.can_view_player_private_details('a1010000-0000-0000-0000-000000000021', 'a1010000-0000-0000-0000-000000000002'), 'other player private row is hidden');
select ok(public.can_manage_player_record('a1010000-0000-0000-0000-000000000020', 'a1010000-0000-0000-0000-000000000002'), 'assigned goalkeeper can be managed');
select ok(not public.can_manage_player_record('a1010000-0000-0000-0000-000000000021', 'a1010000-0000-0000-0000-000000000002'), 'other player cannot be managed');
select ok(not public.can_manage_team_membership('a1010000-0000-0000-0000-000000000011', 'a1010000-0000-0000-0000-000000000002'), 'keeper coach cannot add or import arbitrary players');
select ok(not public.can_manage_player_in_team('a1010000-0000-0000-0000-000000000020', gen_random_uuid(), 'a1010000-0000-0000-0000-000000000002'), 'assigned goalkeeper cannot be moved outside the coach team scope');

set local role authenticated;
set local request.jwt.claim.sub = 'a1010000-0000-0000-0000-000000000002';
select is((select count(*)::integer from public.players where team_id = 'a1010000-0000-0000-0000-000000000011'), 1, 'RLS exposes only the assigned goalkeeper private row');
reset role;

select * from finish();
rollback;
