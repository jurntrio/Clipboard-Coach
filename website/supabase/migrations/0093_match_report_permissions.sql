alter table public.club_member_permissions drop constraint if exists club_member_permissions_permission_key_check;
alter table public.club_member_permissions add constraint club_member_permissions_permission_key_check check (permission_key in (
  'teams.view_all', 'teams.manage_all', 'teams.view', 'teams.manage', 'teams.import', 'video.view',
  'games.view', 'games.create', 'games.communication.manage', 'games.planning.manage',
  'games.selection.view', 'games.selection.manage', 'games.report.view', 'games.report.manage',
  'games.scouting.view', 'games.scouting.manage', 'games.view_counts', 'games.tag_link.create', 'games.tag',
  'training.view', 'training.manage', 'intradesk.view', 'intradesk.manage', 'clips.share'
));

alter table public.club_role_permission_defaults drop constraint if exists club_role_permission_defaults_permission_key_check;
alter table public.club_role_permission_defaults add constraint club_role_permission_defaults_permission_key_check check (permission_key in (
  'teams.view_all', 'teams.manage_all', 'teams.view', 'teams.manage', 'teams.import', 'video.view',
  'games.view', 'games.create', 'games.communication.manage', 'games.planning.manage',
  'games.selection.view', 'games.selection.manage', 'games.report.view', 'games.report.manage',
  'games.scouting.view', 'games.scouting.manage', 'games.view_counts', 'games.tag_link.create', 'games.tag',
  'training.view', 'training.manage', 'intradesk.view', 'intradesk.manage', 'clips.share'
));

create or replace function public.can_view_match_report(target_match_id uuid, target_user_id uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (
    select 1
    from public.matches match
    join public.club_memberships membership on membership.club_id = match.club_id
    where match.id = target_match_id
      and membership.profile_id = target_user_id
      and membership.status = 'active'
      and (
        membership.role in ('club_admin', 'club_admin_viewer')
        or exists (
          select 1 from public.club_member_permissions permission
          where permission.club_id = match.club_id
            and permission.profile_id = target_user_id
            and permission.permission_key = 'games.report.view'
            and permission.enabled = true
        )
      )
  );
$$;

grant execute on function public.can_view_match_report(uuid, uuid) to authenticated;

drop policy if exists "Club staff can view accessible match dossiers" on public.match_dossiers;
create policy "Authorized club staff can view match dossiers"
  on public.match_dossiers for select
  using (public.can_access_club_match(match_id, auth.uid()) and public.can_view_match_report(match_id, auth.uid()));

notify pgrst, 'reload schema';
