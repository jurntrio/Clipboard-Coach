alter table public.club_teams
  add column if not exists trainers_can_manage_matches boolean not null default false;

create table if not exists public.club_team_calendar_feeds (
  id uuid default gen_random_uuid() primary key,
  club_team_id uuid references public.club_teams(id) on delete cascade not null unique,
  provider text not null default 'foot24' check (provider in ('foot24')),
  feed_url text not null,
  enabled boolean not null default false,
  last_synced_at timestamp with time zone,
  last_sync_status text,
  last_sync_message text,
  last_etag text,
  last_modified text,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null,
  updated_at timestamp with time zone default timezone('utc'::text, now()) not null
);

alter table public.club_team_calendar_feeds enable row level security;

-- Feed URLs may contain subscription keys. They are only accessed through
-- explicitly authorized server routes and the service-role worker.
revoke all on public.club_team_calendar_feeds from anon, authenticated;

create index if not exists idx_club_team_calendar_feeds_enabled
  on public.club_team_calendar_feeds(enabled, last_synced_at);

notify pgrst, 'reload schema';
