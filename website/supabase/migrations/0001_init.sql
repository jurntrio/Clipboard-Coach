-- Clipboard Coach Studio - initial web schema
-- Run this in the Supabase SQL Editor (or via `supabase db push`).

-- Profiles table (extends auth.users)
create table profiles (
  id uuid references auth.users on delete cascade primary key,
  email text not null,
  full_name text,
  created_at timestamp with time zone default timezone('utc'::text, now()),
  updated_at timestamp with time zone default timezone('utc'::text, now())
);

-- Teams table
create table teams (
  id uuid default gen_random_uuid() primary key,
  coach_id uuid references profiles(id) on delete cascade not null,
  name text not null,
  age_group text,
  club_name text,
  created_at timestamp with time zone default timezone('utc'::text, now()),
  updated_at timestamp with time zone default timezone('utc'::text, now())
);

-- Players table
create table players (
  id uuid default gen_random_uuid() primary key,
  team_id uuid references teams(id) on delete cascade not null,
  first_name text not null,
  last_name text not null,
  initials text generated always as (
    upper(substring(first_name from 1 for 1) || substring(last_name from 1 for 1))
  ) stored,
  position text,
  email text,
  jersey_number int,
  role text default 'player' check (role in ('player', 'staff')),
  created_at timestamp with time zone default timezone('utc'::text, now())
);

-- Videos table
create table videos (
  id uuid default gen_random_uuid() primary key,
  coach_id uuid references profiles(id) on delete cascade not null,
  team_id uuid references teams(id) on delete set null,
  title text,
  home_team text,
  away_team text,
  match_date date,
  video_url text not null,          -- R2 public URL for playback
  video_key text not null,          -- R2 object key
  duration int,                      -- duration in seconds
  file_size bigint,                  -- file size in bytes
  active_player_ids uuid[] default '{}',  -- players currently "on" for this video, used to auto-link new tags
  status text default 'active' check (status in ('active', 'deleted')),
  created_at timestamp with time zone default timezone('utc'::text, now())
);

-- Tags table (timestamped moments within a video)
create table tags (
  id uuid default gen_random_uuid() primary key,
  video_id uuid references videos(id) on delete cascade not null,
  name text not null,
  start_time numeric not null,       -- seconds
  end_time numeric not null,         -- seconds
  color text not null,               -- hex color, derived from name hash
  player_ids uuid[] default '{}',
  created_at timestamp with time zone default timezone('utc'::text, now())
);

-- Standard tags (per coach quick-tag presets, e.g. Start / Goal)
create table standard_tags (
  id uuid default gen_random_uuid() primary key,
  coach_id uuid references profiles(id) on delete cascade not null,
  name text not null,
  is_protected boolean default false,
  created_at timestamp with time zone default timezone('utc'::text, now()),
  unique(coach_id, name)
);

-- Clips table
create table clips (
  id uuid default gen_random_uuid() primary key,
  coach_id uuid references profiles(id) on delete cascade not null,
  video_id uuid references videos(id) on delete cascade not null,
  team_id uuid references teams(id) on delete set null,
  name text not null,
  audience_type text default 'full_team' check (audience_type in ('full_team', 'selected_players', 'specific_players')),
  audience_player_ids uuid[] default '{}',
  created_at timestamp with time zone default timezone('utc'::text, now())
);

-- Clip segments (ordered tag references that make up a clip's playback sequence)
create table clip_segments (
  id uuid default gen_random_uuid() primary key,
  clip_id uuid references clips(id) on delete cascade not null,
  tag_id uuid references tags(id) on delete cascade not null,
  sequence_order int not null,
  created_at timestamp with time zone default timezone('utc'::text, now())
);

-- Share links (public access tokens for a clip)
create table share_links (
  id uuid default gen_random_uuid() primary key,
  clip_id uuid references clips(id) on delete cascade not null,
  token text unique not null default gen_random_uuid()::text,
  view_count int default 0,
  expires_at timestamp with time zone,
  created_at timestamp with time zone default timezone('utc'::text, now())
);

-- Row Level Security
alter table profiles enable row level security;
create policy "Users can view own profile" on profiles for select using (auth.uid() = id);
create policy "Users can update own profile" on profiles for update using (auth.uid() = id);

alter table teams enable row level security;
create policy "Coaches can CRUD own teams" on teams for all using (coach_id = auth.uid());

alter table players enable row level security;
create policy "Coaches can CRUD own players" on players for all
  using (team_id in (select id from teams where coach_id = auth.uid()));

alter table videos enable row level security;
create policy "Coaches can CRUD own videos" on videos for all using (coach_id = auth.uid());

alter table tags enable row level security;
create policy "Coaches can CRUD own tags" on tags for all
  using (video_id in (select id from videos where coach_id = auth.uid()));

alter table standard_tags enable row level security;
create policy "Coaches can CRUD own standard tags" on standard_tags for all using (coach_id = auth.uid());

alter table clips enable row level security;
create policy "Coaches can CRUD own clips" on clips for all using (coach_id = auth.uid());

alter table clip_segments enable row level security;
create policy "Coaches can CRUD own clip segments" on clip_segments for all
  using (clip_id in (select id from clips where coach_id = auth.uid()));

alter table share_links enable row level security;
create policy "Anyone can view share links" on share_links for select to anon, authenticated using (true);
create policy "Anyone can increment view count" on share_links for update to anon, authenticated using (true);
create policy "Coaches can manage own share links" on share_links for all
  using (clip_id in (select id from clips where coach_id = auth.uid()));

-- New user setup: create a profile row + default standard tags
create or replace function public.handle_new_user()
returns trigger as $$
begin
  insert into public.profiles (id, email, full_name)
  values (new.id, new.email, new.raw_user_meta_data->>'full_name');

  insert into public.standard_tags (coach_id, name, is_protected)
  values
    (new.id, 'Start', true),
    (new.id, 'Goal', true);

  return new;
end;
$$ language plpgsql security definer;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute procedure public.handle_new_user();

-- Indexes
create index idx_videos_coach_id on videos(coach_id);
create index idx_videos_team_id on videos(team_id);
create index idx_tags_video_id on tags(video_id);
create index idx_players_team_id on players(team_id);
create index idx_clips_coach_id on clips(coach_id);
create index idx_clips_video_id on clips(video_id);
create index idx_clip_segments_clip_id on clip_segments(clip_id);
create index idx_share_links_token on share_links(token);
