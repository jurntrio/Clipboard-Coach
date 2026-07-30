create table if not exists public.match_guest_players (
  id uuid primary key default gen_random_uuid(),
  match_id uuid not null references public.matches(id) on delete cascade,
  first_name text not null,
  last_name text not null,
  jersey_number integer check (jersey_number is null or jersey_number between 0 and 99),
  note text,
  created_at timestamptz not null default timezone('utc'::text, now())
);

create index if not exists idx_match_guest_players_match on public.match_guest_players(match_id);
alter table public.match_guest_players enable row level security;
create policy "Club staff can view accessible match guest players"
  on public.match_guest_players for select
  using (public.can_access_club_match(match_id, auth.uid()));
revoke insert, update, delete on public.match_guest_players from authenticated, anon;
