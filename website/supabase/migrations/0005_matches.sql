-- A match groups any number of ordered local or uploaded video blocks.
create table if not exists public.matches (
  id uuid default gen_random_uuid() primary key,
  coach_id uuid references public.profiles(id) on delete cascade not null,
  team_a_id uuid references public.teams(id) on delete set null,
  team_b_id uuid references public.teams(id) on delete set null,
  team_a_name text not null default '',
  team_b_name text not null default '',
  match_date date,
  start_time time,
  last_opened_at timestamp with time zone default timezone('utc'::text, now()) not null,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null,
  updated_at timestamp with time zone default timezone('utc'::text, now()) not null
);

create table if not exists public.match_videos (
  id uuid default gen_random_uuid() primary key,
  match_id uuid references public.matches(id) on delete cascade not null,
  video_id uuid references public.videos(id) on delete cascade not null,
  sequence_order integer not null,
  label text not null,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null,
  unique(match_id, sequence_order),
  unique(match_id, video_id)
);

alter table public.matches enable row level security;
alter table public.match_videos enable row level security;

drop policy if exists "Coaches can CRUD own matches" on public.matches;
create policy "Coaches can CRUD own matches" on public.matches for all
  using (coach_id = auth.uid())
  with check (coach_id = auth.uid());

drop policy if exists "Coaches can CRUD own match videos" on public.match_videos;
create policy "Coaches can CRUD own match videos" on public.match_videos for all
  using (match_id in (select id from public.matches where coach_id = auth.uid()))
  with check (match_id in (select id from public.matches where coach_id = auth.uid()));

create index if not exists idx_matches_coach_recent on public.matches(coach_id, last_opened_at desc);
create index if not exists idx_match_videos_match_order on public.match_videos(match_id, sequence_order);
