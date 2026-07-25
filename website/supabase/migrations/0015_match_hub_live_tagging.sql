-- Match hub: pre-match lineups, results, reusable live tag buttons and public tag links.
alter table public.matches
  add column if not exists status text not null default 'scheduled'
    check (status in ('scheduled', 'live', 'finished')),
  add column if not exists score_a integer check (score_a is null or score_a >= 0),
  add column if not exists score_b integer check (score_b is null or score_b >= 0),
  add column if not exists player_ids uuid[] not null default '{}',
  add column if not exists live_tag_names text[] not null default '{}';

create table if not exists public.match_tag_links (
  id uuid default gen_random_uuid() primary key,
  match_id uuid references public.matches(id) on delete cascade not null,
  token uuid default gen_random_uuid() unique not null,
  active boolean not null default true,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null
);

create table if not exists public.live_match_tags (
  id uuid default gen_random_uuid() primary key,
  match_id uuid references public.matches(id) on delete cascade not null,
  link_id uuid references public.match_tag_links(id) on delete set null,
  tag_name text not null check (char_length(tag_name) between 1 and 80),
  player_ids uuid[] not null default '{}',
  tagger_name text,
  occurred_at timestamp with time zone default timezone('utc'::text, now()) not null,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null
);

alter table public.match_tag_links enable row level security;
alter table public.live_match_tags enable row level security;

create policy "Coaches can manage own match tag links" on public.match_tag_links for all
  using (match_id in (select id from public.matches where coach_id = auth.uid()))
  with check (match_id in (select id from public.matches where coach_id = auth.uid()));

create policy "Coaches can view own live match tags" on public.live_match_tags for select
  using (match_id in (select id from public.matches where coach_id = auth.uid()));

create index if not exists idx_match_tag_links_match on public.match_tag_links(match_id);
create index if not exists idx_live_match_tags_match_time on public.live_match_tags(match_id, occurred_at);

-- Make PostgREST pick up the new match fields immediately after this migration.
notify pgrst, 'reload schema';
