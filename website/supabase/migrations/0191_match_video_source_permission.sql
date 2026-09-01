-- Manage match recordings independently from creating or editing matches.

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
    'clips.share', 'injuries.view', 'injuries.manage'
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
    'clips.share', 'injuries.view', 'injuries.manage'
  ));

-- Existing club profiles get the requested checked default. Clubs can disable it
-- afterwards from their role-permission matrix.
insert into public.club_role_permission_defaults
  (club_id, function_role, permission_key, enabled, updated_at)
select club.id, role.function_role, 'games.video_sources.manage', true, timezone('utc', now())
from public.clubs club
cross join (values ('trainer'), ('assistant_trainer'), ('video_analyst')) as role(function_role)
where exists (
  select 1 from public.club_role_permission_defaults configured
  where configured.club_id = club.id and configured.function_role = role.function_role
)
on conflict (club_id, function_role, permission_key)
do nothing;

notify pgrst, 'reload schema';
