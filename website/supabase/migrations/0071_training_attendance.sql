create table if not exists public.team_training_attendance (
  training_session_id uuid references public.team_training_sessions(id) on delete cascade not null,
  player_id uuid references public.players(id) on delete cascade not null,
  attendance_status text not null default 'unknown'
    check (attendance_status in ('unknown', 'present', 'absent')),
  absence_reason_id uuid references public.club_match_options(id) on delete set null,
  note text,
  updated_by uuid references public.profiles(id) on delete set null,
  updated_at timestamptz not null default timezone('utc'::text, now()),
  primary key (training_session_id, player_id)
);

create index if not exists idx_team_training_attendance_session
  on public.team_training_attendance(training_session_id);

alter table public.team_training_attendance enable row level security;

create policy "Club members view training attendance"
on public.team_training_attendance for select
using (
  exists (
    select 1
    from public.team_training_sessions session
    join public.club_memberships membership on membership.club_id = session.club_id
    where session.id = team_training_attendance.training_session_id
      and membership.profile_id = auth.uid()
      and membership.status = 'active'
  )
);

revoke insert, update, delete on public.team_training_attendance from authenticated, anon;

notify pgrst, 'reload schema';
