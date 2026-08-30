alter table public.club_workload_scheme_phases
  add column if not exists trainings_per_week integer not null default 0
  check (trainings_per_week between 0 and 14);

update public.club_workload_scheme_phases phase
set trainings_per_week = coalesce(source.maximum, 0)
from (
  select scheme_phase_id, max(session_number)::integer as maximum
  from public.club_workload_scheme_sessions
  group by scheme_phase_id
) source
where source.scheme_phase_id = phase.id and phase.trainings_per_week = 0;

notify pgrst, 'reload schema';
