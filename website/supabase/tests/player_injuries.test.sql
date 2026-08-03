begin;
select plan(15);
select has_table('public', 'player_injuries', 'Injury periods exist');
select has_table('public', 'player_injury_history', 'Append-only injury history exists');
select has_column('public', 'player_injuries', 'expected_end_date', 'Expected end date is optional metadata');
select has_column('public', 'player_injuries', 'ended_at', 'Actual recovery time is stored separately');
select has_column('public', 'player_injury_history', 'old_status', 'Old status is retained');
select has_column('public', 'player_injury_history', 'new_status', 'New status is retained');
select has_column('public', 'player_injury_history', 'message', 'Every change has a message');
select has_index('public', 'player_injuries', 'player_injuries_one_active_idx', 'Only one active injury is indexed');
select col_is_fk('public', 'player_injuries', 'club_id', 'Injury is club-bound');
select col_is_fk('public', 'player_injuries', 'player_id', 'Injury is player-bound');
select col_is_fk('public', 'player_injury_history', 'injury_id', 'History belongs to an injury period');
select policies_are('public', 'player_injuries', array['Authorized staff read player injuries','Medical staff create player injuries','Medical staff update player injuries'], 'Injury period RLS is explicit');
select policies_are('public', 'player_injury_history', array['Authorized staff read injury history','Medical staff append injury history'], 'History RLS is explicit');
select function_returns('public', 'can_read_player_injury', array['uuid','uuid','uuid'], 'boolean', 'Read authorization helper exists');
select function_returns('public', 'can_manage_player_injury', array['uuid','uuid','uuid'], 'boolean', 'Medical authorization helper exists');
select * from finish();
rollback;


