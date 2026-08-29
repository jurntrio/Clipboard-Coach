-- Persist the classification on every session. The default safely migrates all
-- existing rows without changing any other training data.
alter table public.team_training_sessions
  add column if not exists season_phase text;

update public.team_training_sessions
set season_phase = 'Competitie'
where season_phase is null;

alter table public.team_training_sessions
  alter column season_phase set default 'Competitie',
  alter column season_phase set not null;

alter table public.team_training_sessions
  drop constraint if exists team_training_sessions_season_phase_check;
alter table public.team_training_sessions
  add constraint team_training_sessions_season_phase_check
  check (season_phase in ('Pre Season', 'Voorbereiding', 'Competitie', 'After Season'));

notify pgrst, 'reload schema';
