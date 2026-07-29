-- Calendar training sessions are deliberately separate from training plans:
-- a plan describes content, a session describes when and where a team trains.

create table if not exists public.team_training_sessions (
  id uuid default gen_random_uuid() primary key,
  club_id uuid references public.clubs(id) on delete cascade not null,
  club_team_id uuid references public.club_teams(id) on delete cascade not null,
  training_date date not null,
  start_time time without time zone not null,
  field_option_id uuid references public.club_match_options(id) on delete set null,
  locker_room_option_id uuid references public.club_match_options(id) on delete set null,
  staff_ids uuid[] not null default '{}',
  series_id uuid,
  created_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default timezone('utc'::text, now()),
  updated_at timestamptz not null default timezone('utc'::text, now()),
  unique (club_team_id, training_date, start_time)
);

create index if not exists idx_team_training_sessions_club_date
  on public.team_training_sessions(club_id, training_date);
create index if not exists idx_team_training_sessions_team_date
  on public.team_training_sessions(club_team_id, training_date);

alter table public.team_training_sessions enable row level security;

create policy "Club members view accessible training sessions"
on public.team_training_sessions for select
using (
  exists (
    select 1 from public.club_memberships membership
    where membership.club_id = team_training_sessions.club_id
      and membership.profile_id = auth.uid()
      and membership.status = 'active'
  )
);

-- Mutations run through the authorized server route, keeping recurring
-- creation and validation atomic from the browser's point of view.
revoke insert, update, delete on public.team_training_sessions from authenticated, anon;

notify pgrst, 'reload schema';
