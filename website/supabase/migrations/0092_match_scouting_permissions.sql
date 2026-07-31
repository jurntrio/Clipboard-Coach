alter table public.club_member_permissions drop constraint if exists club_member_permissions_permission_key_check;
alter table public.club_member_permissions add constraint club_member_permissions_permission_key_check check (permission_key in (
  'teams.view_all', 'teams.manage_all', 'teams.view', 'teams.manage', 'teams.import', 'video.view',
  'games.view', 'games.create', 'games.communication.manage', 'games.planning.manage',
  'games.selection.view', 'games.selection.manage', 'games.scouting.view', 'games.scouting.manage',
  'games.view_counts', 'games.tag_link.create', 'games.tag',
  'training.view', 'training.manage', 'intradesk.view', 'intradesk.manage', 'clips.share'
));

alter table public.club_role_permission_defaults drop constraint if exists club_role_permission_defaults_permission_key_check;
alter table public.club_role_permission_defaults add constraint club_role_permission_defaults_permission_key_check check (permission_key in (
  'teams.view_all', 'teams.manage_all', 'teams.view', 'teams.manage', 'teams.import', 'video.view',
  'games.view', 'games.create', 'games.communication.manage', 'games.planning.manage',
  'games.selection.view', 'games.selection.manage', 'games.scouting.view', 'games.scouting.manage',
  'games.view_counts', 'games.tag_link.create', 'games.tag',
  'training.view', 'training.manage', 'intradesk.view', 'intradesk.manage', 'clips.share'
));

notify pgrst, 'reload schema';
