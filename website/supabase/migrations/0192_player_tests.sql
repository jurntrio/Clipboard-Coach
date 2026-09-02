-- Extensible per-player physical test log (starts with height/weight; new test
-- types are added via the app-side registry, not a migration).

alter table public.club_member_permissions
  drop constraint if exists club_member_permissions_permission_key_check;
alter table public.club_member_permissions
  add constraint club_member_permissions_permission_key_check check (permission_key in (
    'teams.view', 'teams.view_all', 'teams.manage', 'teams.manage_all', 'teams.import',
    'video.view',
    'games.view', 'games.create', 'games.video_sources.manage', 'games.communication.manage', 'games.planning.manage',
    'games.selection.view', 'games.selection.manage', 'games.report.view', 'games.report.manage',
    'games.scouting.view', 'games.scouting.manage', 'games.view_counts', 'games.tag_link.create', 'games.tag',
    'training.view', 'training.manage', 'intradesk.view', 'intradesk.manage',
    'sponsors.view', 'sponsors.manage', 'sponsors.assets.manage',
    'sponsors.internal.view', 'sponsors.internal.manage',
    'sponsors.scopes.view', 'sponsors.scopes.manage', 'sponsors.assignments.manage',
    'sponsors.teams.manage', 'sponsors.matches.view', 'sponsors.matches.manage',
    'clips.share', 'injuries.view', 'injuries.manage', 'tests.view', 'tests.manage'
  ));

alter table public.club_role_permission_defaults
  drop constraint if exists club_role_permission_defaults_permission_key_check;
alter table public.club_role_permission_defaults
  add constraint club_role_permission_defaults_permission_key_check check (permission_key in (
    'teams.view', 'teams.view_all', 'teams.manage', 'teams.manage_all', 'teams.import',
    'video.view',
    'games.view', 'games.create', 'games.video_sources.manage', 'games.communication.manage', 'games.planning.manage',
    'games.selection.view', 'games.selection.manage', 'games.report.view', 'games.report.manage',
    'games.scouting.view', 'games.scouting.manage', 'games.view_counts', 'games.tag_link.create', 'games.tag',
    'training.view', 'training.manage', 'intradesk.view', 'intradesk.manage',
    'sponsors.view', 'sponsors.manage', 'sponsors.assets.manage',
    'sponsors.internal.view', 'sponsors.internal.manage',
    'sponsors.scopes.view', 'sponsors.scopes.manage', 'sponsors.assignments.manage',
    'sponsors.teams.manage', 'sponsors.matches.view', 'sponsors.matches.manage',
    'clips.share', 'injuries.view', 'injuries.manage', 'tests.view', 'tests.manage'
  ));

create table public.player_tests (
  id uuid primary key default gen_random_uuid(),
  club_id uuid not null references public.clubs(id) on delete restrict,
  player_id uuid not null references public.players(id) on delete restrict,
  test_type text not null check (char_length(test_type) between 1 and 60),
  tested_on date not null,
  results jsonb not null default '{}'::jsonb,
  note text check (note is null or char_length(note) <= 500),
  created_by uuid not null references public.profiles(id) on delete restrict,
  created_at timestamptz not null default timezone('utc', now())
);

create index player_tests_club_player_idx on public.player_tests(club_id, player_id, test_type, tested_on desc);

create or replace function public.can_read_player_test(target_club_id uuid, target_player_id uuid, target_user_id uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from public.players p
    join public.teams t on t.id = p.team_id
    join public.club_teams ct on ct.id = t.club_team_id
    join public.club_memberships cm on cm.club_id = ct.club_id and cm.profile_id = target_user_id
    where p.id = target_player_id and ct.club_id = target_club_id and cm.status = 'active'
      and (
        cm.role in ('club_admin', 'club_admin_viewer')
        or cm.team_scope = 'all'
        or exists (select 1 from public.club_member_team_access a where a.club_id = ct.club_id and a.profile_id = target_user_id and a.club_team_id = ct.id)
        or exists (select 1 from public.club_trainers tr join public.club_trainer_teams tt on tt.trainer_id = tr.id where tr.profile_id = target_user_id and tr.club_id = ct.club_id and tt.club_team_id = ct.id and tt.status = 'active')
      )
      and (cm.role in ('club_admin','club_admin_viewer') or coalesce(cm.function_role, cm.role) in ('trainer','assistant_trainer','team_manager','youth_coordinator','head_youth_development','technical_director','doctor','physiotherapist','physical_coach','performance_coach'))
  );
$$;

create or replace function public.can_manage_player_test(target_club_id uuid, target_player_id uuid, target_user_id uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select public.can_read_player_test(target_club_id, target_player_id, target_user_id)
    and exists (
      select 1 from public.club_memberships cm
      where cm.club_id = target_club_id
        and cm.profile_id = target_user_id
        and cm.status = 'active'
        and (
          cm.role = 'club_admin'
          or cm.function_role in (
            'trainer', 'assistant_trainer', 'physical_coach', 'performance_coach',
            'doctor', 'physiotherapist', 'youth_coordinator',
            'head_youth_development', 'technical_director'
          )
        )
    );
$$;

alter table public.player_tests enable row level security;
create policy "Authorized staff read player tests" on public.player_tests for select using (public.can_read_player_test(club_id, player_id, auth.uid()));
create policy "Authorized staff create player tests" on public.player_tests for insert with check (public.can_manage_player_test(club_id, player_id, auth.uid()) and created_by = auth.uid());
create policy "Authorized staff delete player tests" on public.player_tests for delete using (public.can_manage_player_test(club_id, player_id, auth.uid()));

revoke all on public.player_tests from anon, authenticated;
grant select, insert, delete on public.player_tests to authenticated;
notify pgrst, 'reload schema';
