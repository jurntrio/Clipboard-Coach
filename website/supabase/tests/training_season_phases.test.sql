begin;
select plan(5);

select has_column('public', 'team_training_sessions', 'season_phase', 'training sessions store a season phase');
select col_not_null('public', 'team_training_sessions', 'season_phase', 'season phase is mandatory');
select col_default_is('public', 'team_training_sessions', 'season_phase', 'Competitie', 'existing and legacy inserts default to Competitie');
select is((select count(*)::integer from public.team_training_sessions where season_phase is null), 0, 'migration leaves no training without a phase');
select is((select count(*)::integer from public.team_training_sessions where season_phase not in ('Pre Season', 'Voorbereiding', 'Competitie', 'After Season')), 0, 'migration preserves valid fixed phase values');

select * from finish();
rollback;
