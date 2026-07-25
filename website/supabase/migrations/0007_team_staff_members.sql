-- Registered users can be linked to a team as read-only staff without exposing a user directory.
create table if not exists public.team_staff_members (
  id uuid default gen_random_uuid() primary key,
  team_id uuid references public.teams(id) on delete cascade not null,
  user_id uuid references public.profiles(id) on delete cascade not null,
  added_by uuid references public.profiles(id) on delete cascade not null,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null,
  unique(team_id, user_id)
);

create index if not exists idx_team_staff_members_user on public.team_staff_members(user_id);
create index if not exists idx_team_staff_members_team on public.team_staff_members(team_id);
alter table public.team_staff_members enable row level security;

create policy "Members can view their own membership" on public.team_staff_members for select
  using (user_id = auth.uid() or added_by = auth.uid());
create policy "Team owners can add staff memberships" on public.team_staff_members for insert
  with check (added_by = auth.uid() and team_id in (select id from public.teams where coach_id = auth.uid()));
create policy "Team owners can remove staff memberships" on public.team_staff_members for delete
  using (team_id in (select id from public.teams where coach_id = auth.uid()));

create policy "Staff can view assigned teams" on public.teams for select
  using (id in (select team_id from public.team_staff_members where user_id = auth.uid()));
create policy "Staff can view players in assigned teams" on public.players for select
  using (team_id in (select team_id from public.team_staff_members where user_id = auth.uid()));
create policy "Staff can view team clips" on public.clips for select
  using (team_id in (select team_id from public.team_staff_members where user_id = auth.uid()));
create policy "Staff can view segments of team clips" on public.clip_segments for select
  using (clip_id in (select id from public.clips where team_id in (select team_id from public.team_staff_members where user_id = auth.uid())));
create policy "Staff can view tags used by team clips" on public.tags for select
  using (id in (select tag_id from public.clip_segments where clip_id in (select id from public.clips where team_id in (select team_id from public.team_staff_members where user_id = auth.uid()))));
create policy "Staff can view assigned matches" on public.matches for select
  using (team_a_id in (select team_id from public.team_staff_members where user_id = auth.uid()) or team_b_id in (select team_id from public.team_staff_members where user_id = auth.uid()));
create policy "Staff can view assigned match links" on public.match_videos for select
  using (match_id in (select id from public.matches where team_a_id in (select team_id from public.team_staff_members where user_id = auth.uid()) or team_b_id in (select team_id from public.team_staff_members where user_id = auth.uid())));
