begin;
select plan(10);

select has_column('public', 'player_group_players', 'valid_from', 'Extra-group membership has a start date');
select has_column('public', 'player_group_players', 'valid_until', 'Extra-group membership has an end date');
select col_not_null('public', 'player_group_players', 'valid_from', 'Extra-group start date is required');
select has_check('public', 'player_group_players', 'player_group_players_valid_period_check', 'Extra-group membership period is valid');
select has_check('public', 'team_training_attendance', 'team_training_attendance_attendance_status_check', 'Attendance has a constrained status');
select has_index('public', 'team_training_attendance', 'team_training_attendance_session_status_idx', 'Attendance matrix lookup is indexed');
select has_index('public', 'player_group_players', 'player_group_players_group_period_idx', 'Group period lookup is indexed');
select throws_ok($$insert into public.team_training_attendance(training_session_id, player_id, attendance_status) values (gen_random_uuid(), gen_random_uuid(), 'unknown')$$, null, null, 'Unknown is no longer a valid attendance status');
select throws_ok($$insert into public.team_training_attendance(training_session_id, player_id, attendance_status) values (gen_random_uuid(), gen_random_uuid(), 'sick')$$, null, null, 'Additional absence reasons are not statuses');
select throws_ok($$update public.player_group_players set valid_until = valid_from - 1$$, null, null, 'Membership cannot end before it begins');

select * from finish();
rollback;
