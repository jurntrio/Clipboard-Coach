begin;
select plan(17);

select has_column('public','club_seasons','status','Season has a lifecycle status');
select has_column('public','club_teams','season_id','Teams are season-bound');
select has_column('public','club_trainer_teams','season_id','Team staff is season-bound');
select has_column('public','player_groups','season_id','Extra groups are season-bound');
select has_column('public','team_training_sessions','season_id','Trainings retain their season');
select has_column('public','matches','season_id','Matches retain their season');
select has_table('public','season_player_decisions','Advancement decisions exist');
select has_table('public','season_team_pathways','Recommended pathways are configurable');
select has_table('public','season_transition_reservations','Activation reservations exist');
select has_function('public','seed_season_player_decisions',array['uuid','uuid','uuid'],'Player decisions can be seeded idempotently');
select has_function('public','advance_season_players',array['uuid','uuid','uuid[]','text','uuid'],'Players can be advanced in bulk');
select has_function('public','activate_club_season',array['uuid','uuid','text'],'Activation has one transactional entry point');
select has_function('public','set_season_team_staff',array['uuid','uuid','uuid','uuid[]','text'],'Future team staff is managed transactionally');
select has_function('public','set_season_group_composition',array['uuid','uuid','uuid','uuid[]','uuid[]'],'Future Extra-group composition is managed transactionally');
select has_function('public','reserve_season_transition',array['uuid','uuid','uuid'],'Activation slots can be reserved atomically');
select has_function('public','cancel_season_transition',array['uuid','uuid'],'A reservation can be cancelled before its deadline');
select has_function('public','execute_due_season_transitions',array['integer'],'The service worker can claim due transitions');

select * from finish();
rollback;
