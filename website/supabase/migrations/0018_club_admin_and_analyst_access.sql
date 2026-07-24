-- Platform-managed clubs and a read/analyse-only club-wide Analyst role.
alter table public.profiles drop constraint if exists profiles_account_role_check;
alter table public.profiles add constraint profiles_account_role_check
  check (account_role in ('coach', 'club_admin', 'analyst'));

alter table public.club_memberships drop constraint if exists club_memberships_role_check;
alter table public.club_memberships add constraint club_memberships_role_check
  check (role in ('trainer', 'club_admin', 'analyst'));

create or replace function public.can_access_club_match(target_match_id uuid, target_user_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.matches m
    join public.club_memberships cm on cm.club_id = m.club_id
    where m.id = target_match_id
      and cm.profile_id = target_user_id
      and (
        cm.role in ('club_admin', 'analyst')
        or exists (
          select 1
          from public.club_trainers ct
          join public.club_match_assignments cma on cma.trainer_id = ct.id
          where ct.club_id = m.club_id
            and ct.profile_id = target_user_id
            and cma.match_id = m.id
            and cma.visible = true
        )
      )
  );
$$;

grant execute on function public.can_access_club_match(uuid, uuid) to authenticated;

create or replace function public.is_club_admin_for_match(target_match_id uuid, target_user_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.matches m
    join public.club_memberships cm on cm.club_id = m.club_id
    where m.id = target_match_id
      and cm.profile_id = target_user_id
      and cm.role = 'club_admin'
  );
$$;

grant execute on function public.is_club_admin_for_match(uuid, uuid) to authenticated;

create or replace function public.infer_match_club()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare inferred_club_id uuid;
begin
  if new.club_id is null then
    select (array_agg(distinct cm.club_id))[1]
    into inferred_club_id
    from public.club_memberships cm
    where cm.profile_id = new.coach_id
    having count(distinct cm.club_id) = 1;
    new.club_id := inferred_club_id;
  end if;
  if new.club_id is not null and new.club_team_id is null then
    select ct.id into new.club_team_id
    from public.club_teams ct
    where ct.club_id = new.club_id
      and lower(replace(ct.name, ' ', '')) = lower(replace(new.team_a_name, ' ', ''))
    limit 1;
  end if;
  return new;
end;
$$;

drop trigger if exists infer_match_club_trigger on public.matches;
create trigger infer_match_club_trigger
before insert or update of coach_id, team_a_name, club_id on public.matches
for each row execute function public.infer_match_club();

with single_club_coaches as (
  select profile_id, (array_agg(distinct club_id))[1] as club_id
  from public.club_memberships
  group by profile_id
  having count(distinct club_id) = 1
)
update public.matches m
set club_id = scc.club_id
from single_club_coaches scc
where m.coach_id = scc.profile_id and m.club_id is null;

update public.matches m
set club_team_id = ct.id
from public.club_teams ct
where m.club_id = ct.club_id
  and m.club_team_id is null
  and lower(replace(ct.name, ' ', '')) = lower(replace(m.team_a_name, ' ', ''));

drop policy if exists "Club members can view accessible matches" on public.matches;
create policy "Club members can view accessible matches" on public.matches for select
  using (public.can_access_club_match(id, auth.uid()));

drop policy if exists "Club admins can update club matches" on public.matches;
create policy "Club admins can update club matches" on public.matches for update
  using (public.is_club_admin_for_match(id, auth.uid()))
  with check (public.is_club_admin_for_match(id, auth.uid()));

drop policy if exists "Club members can view accessible match videos" on public.match_videos;
create policy "Club members can view accessible match videos" on public.match_videos for select
  using (public.can_access_club_match(match_id, auth.uid()));

drop policy if exists "Club members can view accessible videos" on public.videos;
create policy "Club members can view accessible videos" on public.videos for select
  using (exists (
    select 1 from public.match_videos mv
    where mv.video_id = videos.id
      and public.can_access_club_match(mv.match_id, auth.uid())
  ));

drop policy if exists "Club analysts can manage accessible tags" on public.tags;
create policy "Club analysts can manage accessible tags" on public.tags for all
  using (exists (
    select 1 from public.match_videos mv
    where mv.video_id = tags.video_id
      and public.can_access_club_match(mv.match_id, auth.uid())
  ))
  with check (exists (
    select 1 from public.match_videos mv
    where mv.video_id = tags.video_id
      and public.can_access_club_match(mv.match_id, auth.uid())
  ));

drop policy if exists "Club members can view match players" on public.players;
create policy "Club members can view match players" on public.players for select
  using (exists (
    select 1 from public.matches m
    where players.id = any(m.player_ids)
      and public.can_access_club_match(m.id, auth.uid())
  ));

drop policy if exists "Club members can view match teams" on public.teams;
create policy "Club members can view match teams" on public.teams for select
  using (exists (
    select 1 from public.matches m
    where (m.team_a_id = teams.id or m.team_b_id = teams.id)
      and public.can_access_club_match(m.id, auth.uid())
  ));

notify pgrst, 'reload schema';
