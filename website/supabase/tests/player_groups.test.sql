begin;
create extension if not exists pgtap;
select plan(15);

select has_table('public', 'player_groups', 'generic Extra groups table exists');
select has_table('public', 'player_group_players', 'group-player junction exists');
select has_table('public', 'player_group_staff', 'group-staff junction exists');
select has_table('public', 'player_group_evaluation_criteria', 'generic group criteria exist');
select has_table('public', 'player_group_evaluations', 'generic player evaluation history exists');
select has_column('public', 'player_groups', 'group_type', 'groups have a reusable type');
select has_column('public', 'player_groups', 'active', 'groups can be activated and deactivated');
select has_column('public', 'player_groups', 'age_category', 'groups may describe an age category');
select has_column('public', 'player_groups', 'icon', 'groups may have a visual marker');
select has_column('public', 'team_training_sessions', 'player_group_id', 'training sessions can target an Extra group');
select col_is_null('public', 'team_training_sessions', 'club_team_id', 'team target is nullable for group sessions');
select has_index('public', 'player_group_players', 'player_group_players_pkey', 'a player is linked once per group');
select has_index('public', 'player_group_staff', 'player_group_staff_pkey', 'a trainer is linked once per group');
select has_check('public', 'team_training_sessions', 'team_training_sessions_single_target_check', 'a training has exactly one target');
select has_check('public', 'player_group_evaluations', 'player_group_evaluations_score_check', 'evaluation scores are constrained');

select * from finish();
rollback;
