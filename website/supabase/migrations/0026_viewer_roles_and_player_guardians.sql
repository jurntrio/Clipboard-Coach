-- Viewer roles (Club Admin viewer, Admin viewer) and a Player/Parent role
-- that links one guardian account to exactly the players a coach or club
-- admin has invited them for.

-- 1. Allow the new club-level and account-level role values.
alter table public.club_memberships drop constraint if exists club_memberships_role_check;
alter table public.club_memberships add constraint club_memberships_role_check
  check (role in ('club_admin', 'club_admin_viewer', 'coach', 'assistant_coach', 'team_manager', 'analyst', 'trainer'));

alter table public.profiles drop constraint if exists profiles_account_role_check;
alter table public.profiles add constraint profiles_account_role_check
  check (account_role in ('coach', 'club_admin', 'club_admin_viewer', 'assistant_coach', 'team_manager', 'analyst', 'platform_admin', 'admin_viewer', 'player_parent'));

-- 2. club_admin_viewer sees everything a club_admin sees; it must never be
-- accepted by the mutate-only checks (can_manage_club_roster,
-- is_club_admin_for_match), only by view checks.
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
        cm.role in ('club_admin', 'club_admin_viewer', 'analyst')
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

drop policy if exists "Assigned club users can view operational teams" on public.teams;
create policy "Assigned club users can view operational teams" on public.teams for select
using (
  club_team_id is not null and exists (
    select 1
    from public.club_teams ct
    where ct.id = teams.club_team_id and (
      exists (
        select 1 from public.club_memberships cm
        where cm.club_id = ct.club_id and cm.profile_id = auth.uid()
          and cm.role in ('club_admin', 'club_admin_viewer') and cm.status = 'active'
      )
      or exists (
        select 1 from public.club_trainer_teams ctt
        join public.club_trainers ctr on ctr.id = ctt.trainer_id
        where ctt.club_team_id = ct.id and ctr.profile_id = auth.uid()
          and ctt.status = 'active'
      )
    )
  )
);

drop policy if exists "Club admin viewers can view roster players" on public.players;
create policy "Club admin viewers can view roster players" on public.players for select
using (
  team_id in (
    select t.id from public.teams t
    join public.club_teams ct on ct.id = t.club_team_id
    join public.club_memberships cm on cm.club_id = ct.club_id
    where cm.profile_id = auth.uid() and cm.role = 'club_admin_viewer' and cm.status = 'active'
  )
);

-- 3. Player/Parent: one guardian account can be linked to one or more
-- players. Links are only ever created server-side (invite acceptance),
-- so there is deliberately no insert/update/delete policy for regular users.
create table if not exists public.player_guardians (
  id uuid default gen_random_uuid() primary key,
  player_id uuid references public.players(id) on delete cascade not null,
  profile_id uuid references public.profiles(id) on delete cascade not null,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null,
  unique(player_id, profile_id)
);
alter table public.player_guardians enable row level security;
create policy "Guardians can view their own links" on public.player_guardians for select
  using (profile_id = auth.uid());

create table if not exists public.player_invites (
  id uuid default gen_random_uuid() primary key,
  token uuid default gen_random_uuid() not null unique,
  player_id uuid references public.players(id) on delete cascade not null,
  created_by uuid references public.profiles(id) on delete cascade not null,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null,
  expires_at timestamp with time zone not null default (timezone('utc'::text, now()) + interval '14 days'),
  used_at timestamp with time zone,
  used_by uuid references public.profiles(id) on delete set null
);
alter table public.player_invites enable row level security;
create policy "Creators can view their player invites" on public.player_invites for select
  using (created_by = auth.uid());

create or replace function public.can_guardian_view_clip(target_clip_id uuid, target_user_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.clips c
    join public.player_guardians pg on pg.profile_id = target_user_id
    join public.players p on p.id = pg.player_id
    where c.id = target_clip_id
      and (
        c.audience_player_ids @> array[p.id]
        or (c.team_id = p.team_id and c.audience_type = 'full_team')
        or exists (
          select 1 from public.clip_segments cs
          join public.tags t on t.id = cs.tag_id
          where cs.clip_id = c.id and t.player_ids @> array[p.id]
        )
      )
  );
$$;
grant execute on function public.can_guardian_view_clip(uuid, uuid) to authenticated;

create or replace function public.can_guardian_view_match(target_match_id uuid, target_user_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.matches m
    join public.player_guardians pg on pg.profile_id = target_user_id
    where m.id = target_match_id and pg.player_id = any(m.player_ids)
  );
$$;
grant execute on function public.can_guardian_view_match(uuid, uuid) to authenticated;

create policy "Guardians can view their player" on public.players for select
  using (exists (select 1 from public.player_guardians pg where pg.profile_id = auth.uid() and pg.player_id = players.id));
create policy "Guardians can view their player's team" on public.teams for select
  using (exists (
    select 1 from public.player_guardians pg join public.players p on p.id = pg.player_id
    where pg.profile_id = auth.uid() and p.team_id = teams.id
  ));
create policy "Guardians can view relevant matches" on public.matches for select
  using (public.can_guardian_view_match(matches.id, auth.uid()));
create policy "Guardians can view relevant match videos" on public.match_videos for select
  using (exists (select 1 from public.matches m where m.id = match_videos.match_id and public.can_guardian_view_match(m.id, auth.uid())));
create policy "Guardians can view relevant clips" on public.clips for select
  using (public.can_guardian_view_clip(clips.id, auth.uid()));
create policy "Guardians can view relevant clip segments" on public.clip_segments for select
  using (public.can_guardian_view_clip(clip_segments.clip_id, auth.uid()));
create policy "Guardians can view relevant tags" on public.tags for select
  using (exists (select 1 from public.clip_segments cs where cs.tag_id = tags.id and public.can_guardian_view_clip(cs.clip_id, auth.uid())));
create policy "Guardians can view relevant videos" on public.videos for select
  using (exists (select 1 from public.clips c where c.video_id = videos.id and public.can_guardian_view_clip(c.id, auth.uid())));
create policy "Guardians can view relevant player stats" on public.player_stat_events for select
  using (exists (select 1 from public.player_guardians pg where pg.profile_id = auth.uid() and pg.player_id = player_stat_events.player_id));

-- 4. handle_new_user: 0022 accidentally dropped the club_onboarding handling
-- that 0021 added (it replaced the whole function without carrying that
-- branch forward), which silently broke "join/register a club" signups.
-- Restore it here, and add player-invite-token acceptance alongside it.
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  accepted_at_value timestamp with time zone;
  invite public.player_invites;
begin
  insert into public.profiles (id, email, full_name)
  values (new.id, new.email, new.raw_user_meta_data->>'full_name');

  insert into public.standard_tags
    (coach_id, name, is_protected, start_offset_seconds, end_offset_seconds)
  values
    (new.id, 'Start', true, 0, 0),
    (new.id, 'Goal', true, -10, 3),
    (new.id, 'Kans', false, -10, 3),
    (new.id, 'Opbouw', false, -5, 10),
    (new.id, 'Positiespel', false, -10, 5),
    (new.id, 'Hoekschop', false, -3, 10),
    (new.id, 'Vrije trap', false, -3, 10);

  if coalesce(new.raw_user_meta_data->>'legal_accepted', 'false') = 'true'
    and new.raw_user_meta_data->>'terms_version' is not null
    and new.raw_user_meta_data->>'privacy_version' is not null
    and new.raw_user_meta_data->>'legal_statement_version' is not null then
    begin
      accepted_at_value := (new.raw_user_meta_data->>'legal_accepted_at')::timestamp with time zone;
    exception when others then
      accepted_at_value := timezone('utc'::text, now());
    end;
    insert into public.legal_acceptances
      (user_id, terms_version, privacy_version, statement_version, locale, accepted_at)
    values
      (new.id, new.raw_user_meta_data->>'terms_version',
       new.raw_user_meta_data->>'privacy_version',
       new.raw_user_meta_data->>'legal_statement_version',
       case when new.raw_user_meta_data->>'legal_locale' = 'en' then 'en' else 'nl' end,
       accepted_at_value);
  end if;

  if new.raw_user_meta_data ? 'club_onboarding' then
    perform public.complete_club_team_onboarding(
      new.id, new.email, new.raw_user_meta_data->>'full_name',
      new.raw_user_meta_data->'club_onboarding'
    );
  end if;

  if new.raw_user_meta_data ? 'player_invite_token' then
    select * into invite from public.player_invites
    where token = nullif(new.raw_user_meta_data->>'player_invite_token', '')::uuid
      and used_at is null and expires_at > timezone('utc'::text, now());
    if invite.id is null then raise exception 'PLAYER_INVITE_INVALID'; end if;
    update public.profiles set account_role = 'player_parent' where id = new.id;
    insert into public.player_guardians (player_id, profile_id) values (invite.player_id, new.id);
    update public.player_invites set used_at = timezone('utc'::text, now()), used_by = new.id where id = invite.id;
  end if;

  return new;
end;
$$;

notify pgrst, 'reload schema';
