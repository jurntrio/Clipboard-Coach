-- Granular sponsor permissions and commercial club roles. CBCS deliberately
-- stores no sponsor income, invoice, payment or financial contract data.

alter table public.club_member_permissions
  drop constraint if exists club_member_permissions_permission_key_check;
alter table public.club_member_permissions
  add constraint club_member_permissions_permission_key_check check (permission_key in (
    'teams.view', 'teams.view_all', 'teams.manage', 'teams.manage_all', 'teams.import',
    'video.view',
    'games.view', 'games.create', 'games.communication.manage', 'games.planning.manage',
    'games.selection.view', 'games.selection.manage', 'games.report.view', 'games.report.manage',
    'games.scouting.view', 'games.scouting.manage', 'games.view_counts', 'games.tag_link.create', 'games.tag',
    'training.view', 'training.manage', 'intradesk.view', 'intradesk.manage',
    'sponsors.view', 'sponsors.manage', 'sponsors.assets.manage',
    'sponsors.internal.view', 'sponsors.internal.manage',
    'sponsors.scopes.view', 'sponsors.scopes.manage', 'sponsors.assignments.manage',
    'sponsors.teams.manage', 'sponsors.matches.view', 'sponsors.matches.manage',
    'clips.share'
  ));

alter table public.club_role_permission_defaults
  drop constraint if exists club_role_permission_defaults_permission_key_check;
alter table public.club_role_permission_defaults
  add constraint club_role_permission_defaults_permission_key_check check (permission_key in (
    'teams.view', 'teams.view_all', 'teams.manage', 'teams.manage_all', 'teams.import',
    'video.view',
    'games.view', 'games.create', 'games.communication.manage', 'games.planning.manage',
    'games.selection.view', 'games.selection.manage', 'games.report.view', 'games.report.manage',
    'games.scouting.view', 'games.scouting.manage', 'games.view_counts', 'games.tag_link.create', 'games.tag',
    'training.view', 'training.manage', 'intradesk.view', 'intradesk.manage',
    'sponsors.view', 'sponsors.manage', 'sponsors.assets.manage',
    'sponsors.internal.view', 'sponsors.internal.manage',
    'sponsors.scopes.view', 'sponsors.scopes.manage', 'sponsors.assignments.manage',
    'sponsors.teams.manage', 'sponsors.matches.view', 'sponsors.matches.manage',
    'clips.share'
  ));

notify pgrst, 'reload schema';
