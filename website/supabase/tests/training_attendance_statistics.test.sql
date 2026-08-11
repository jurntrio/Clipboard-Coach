begin;
select plan(9);

select has_column('public', 'player_group_players', 'valid_from', 'Extra-group membership has a start date');
select has_column('public', 'player_group_players', 'valid_until', 'Extra-group membership has an end date');
select col_not_null('public', 'player_group_players', 'valid_from', 'Extra-group start date is required');
select ok(exists(select 1 from pg_constraint where conrelid = 'public.player_group_players'::regclass and conname = 'player_group_players_valid_period_check' and contype = 'c'), 'Extra-group membership period is valid');
select ok(exists(select 1 from pg_constraint where conrelid = 'public.team_training_attendance'::regclass and conname = 'team_training_attendance_attendance_status_check' and contype = 'c'), 'Attendance has a constrained status');
select has_index('public', 'team_training_attendance', 'team_training_attendance_session_status_idx', 'Attendance matrix lookup is indexed');
select has_index('public', 'player_group_players', 'player_group_players_group_period_idx', 'Group period lookup is indexed');
select throws_ok($$insert into public.team_training_attendance(training_session_id, player_id, attendance_status) values (gen_random_uuid(), gen_random_uuid(), 'unknown')$$, null, null, 'Unknown is no longer a valid attendance status');
select throws_ok($$insert into public.team_training_attendance(training_session_id, player_id, attendance_status) values (gen_random_uuid(), gen_random_uuid(), 'sick')$$, null, null, 'Additional absence reasons are not statuses');

select * from finish();
rollback;
