create table if not exists public.training_availability_notifications (
  id uuid primary key default gen_random_uuid(),
  training_session_id uuid not null references public.team_training_sessions(id) on delete cascade,
  player_id uuid not null references public.players(id) on delete cascade,
  contact_profile_id uuid not null references public.profiles(id) on delete cascade,
  attendance_status text not null check (attendance_status in ('present', 'absent')),
  created_at timestamptz not null default timezone('utc'::text, now()),
  read_at timestamptz
);

create index if not exists training_availability_notifications_session_unread
  on public.training_availability_notifications(training_session_id, created_at desc) where read_at is null;

alter table public.training_availability_notifications enable row level security;
revoke all on public.training_availability_notifications from authenticated, anon;
notify pgrst, 'reload schema';
