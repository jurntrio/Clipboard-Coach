begin;
select plan(8);

select has_table('public', 'club_registration_requests', 'Registration requests are stored separately from granted access');
select has_column('public', 'club_registration_requests', 'request_kind', 'Request kind distinguishes staff and contacts');
select has_column('public', 'club_registration_requests', 'requested_function_role', 'A requested function can be recorded');
select has_column('public', 'club_registration_requests', 'requested_custom_role', 'A free-text requested function can be recorded');
select has_column('public', 'club_registration_requests', 'requested_team_id', 'An optional requested team can be recorded');
select has_column('public', 'club_registration_requests', 'player_first_name', 'A contact request records the player first name');
select has_column('public', 'club_registration_requests', 'player_date_of_birth', 'A contact request records the player birth date');
select function_privs_are('public', 'complete_club_team_onboarding', array['uuid','text','text','jsonb'], 'service_role', array['EXECUTE'], 'Only the signup service can complete onboarding');

select * from finish();
rollback;
