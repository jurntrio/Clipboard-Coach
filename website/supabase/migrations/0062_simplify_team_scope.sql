-- Keep one predictable team model:
-- none, own/assigned teams (plus explicit extras), or every club team.

update public.club_memberships
set team_scope = 'assigned'
where team_scope = 'selected';

alter table public.club_memberships
  drop constraint if exists club_memberships_team_scope_check;

alter table public.club_memberships
  add constraint club_memberships_team_scope_check
  check (team_scope in ('none', 'assigned', 'all'));

create or replace function public.club_member_can_access_team(
  target_club_id uuid, target_profile_id uuid, target_club_team_id uuid
) returns boolean
language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from public.club_memberships membership
    where membership.club_id = target_club_id
      and membership.profile_id = target_profile_id
      and membership.status = 'active'
      and (
        membership.role in ('club_admin', 'club_admin_viewer')
        or membership.team_scope = 'all'
        or (
          membership.team_scope = 'assigned'
          and (
            exists (
              select 1 from public.club_member_team_access access
              where access.club_id = target_club_id
                and access.profile_id = target_profile_id
                and access.club_team_id = target_club_team_id
            )
            or exists (
              select 1
              from public.club_trainers trainer
              join public.club_trainer_teams assignment on assignment.trainer_id = trainer.id
              where trainer.club_id = target_club_id
                and trainer.profile_id = target_profile_id
                and assignment.club_team_id = target_club_team_id
                and assignment.status = 'active'
            )
          )
        )
      )
  );
$$;

grant execute on function public.club_member_can_access_team(uuid, uuid, uuid) to authenticated;

notify pgrst, 'reload schema';
