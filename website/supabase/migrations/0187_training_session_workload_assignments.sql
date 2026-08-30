-- Keep generated calendar sessions independent from the workload templates they use.
-- A club can replace a planning UI without changing attendance or training content.
create table if not exists public.team_training_session_workloads (
  training_session_id uuid primary key references public.team_training_sessions(id) on delete cascade,
  workload_scheme_id uuid not null references public.club_workload_schemes(id) on delete restrict,
  scheme_version_id uuid not null references public.club_workload_scheme_versions(id) on delete restrict,
  scheme_session_id uuid references public.club_workload_scheme_sessions(id) on delete restrict,
  sequence_number integer not null check (sequence_number > 0),
  created_at timestamptz not null default now()
);

create index if not exists team_training_session_workloads_scheme_idx
  on public.team_training_session_workloads(workload_scheme_id, sequence_number);

create or replace function public.validate_training_session_workload() returns trigger language plpgsql as $$
declare training_club uuid; scheme_club uuid; version_scheme uuid; session_version uuid;
begin
  select club_id into training_club from public.team_training_sessions where id=new.training_session_id;
  select club_id into scheme_club from public.club_workload_schemes where id=new.workload_scheme_id;
  select scheme_id into version_scheme from public.club_workload_scheme_versions where id=new.scheme_version_id;
  if new.scheme_session_id is not null then
    select phase.scheme_version_id into session_version
    from public.club_workload_scheme_sessions session
    join public.club_workload_scheme_phases phase on phase.id=session.scheme_phase_id
    where session.id=new.scheme_session_id;
  end if;
  if training_club is null or scheme_club is null or training_club<>scheme_club then raise exception 'TRAINING_WORKLOAD_CLUB_MISMATCH'; end if;
  if version_scheme<>new.workload_scheme_id then raise exception 'TRAINING_WORKLOAD_VERSION_MISMATCH'; end if;
  if new.scheme_session_id is not null and session_version<>new.scheme_version_id then raise exception 'TRAINING_WORKLOAD_SESSION_MISMATCH'; end if;
  return new;
end; $$;

create trigger validate_training_session_workload_trigger before insert or update on public.team_training_session_workloads
for each row execute function public.validate_training_session_workload();

alter table public.team_training_session_workloads enable row level security;
create policy "Members read assigned training workloads" on public.team_training_session_workloads for select using (
  exists (
    select 1 from public.team_training_sessions training
    join public.club_memberships membership on membership.club_id=training.club_id
    where training.id=team_training_session_workloads.training_session_id
      and membership.profile_id=auth.uid() and membership.status='active'
  )
);
revoke insert,update,delete on public.team_training_session_workloads from authenticated,anon;
notify pgrst, 'reload schema';
