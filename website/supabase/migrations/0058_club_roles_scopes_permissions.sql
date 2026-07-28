-- Club function titles, explicit team scope and granular permissions.
-- `role` remains the technical legacy role; `function_role` is the human club function.

alter table public.club_memberships
  add column if not exists function_role text not null default 'trainer',
  add column if not exists custom_role_name text,
  add column if not exists team_scope text not null default 'assigned'
    check (team_scope in ('none', 'assigned', 'selected', 'all'));

create table if not exists public.club_member_team_access (
  club_id uuid references public.clubs(id) on delete cascade not null,
  profile_id uuid references public.profiles(id) on delete cascade not null,
  club_team_id uuid references public.club_teams(id) on delete cascade not null,
  created_at timestamptz not null default now(),
  primary key (club_id, profile_id, club_team_id)
);

create table if not exists public.club_member_permissions (
  club_id uuid references public.clubs(id) on delete cascade not null,
  profile_id uuid references public.profiles(id) on delete cascade not null,
  permission_key text not null check (permission_key in (
    'teams.view', 'teams.manage', 'teams.import',
    'video.view',
    'games.view', 'games.create', 'games.view_counts', 'games.tag_link.create', 'games.tag',
    'training.view', 'training.manage',
    'intradesk.view', 'intradesk.manage',
    'clips.share'
  )),
  enabled boolean not null default false,
  updated_by uuid references public.profiles(id) on delete set null,
  updated_at timestamptz not null default now(),
  primary key (club_id, profile_id, permission_key)
);

alter table public.club_member_team_access enable row level security;
alter table public.club_member_permissions enable row level security;

create policy "Members read own team access" on public.club_member_team_access for select
using (profile_id = auth.uid() or public.is_active_club_admin(club_id, auth.uid()));

create policy "Members read own permissions" on public.club_member_permissions for select
using (profile_id = auth.uid() or public.is_active_club_admin(club_id, auth.uid()));

update public.club_memberships
set team_scope = case
  when role in ('club_admin', 'club_admin_viewer') then 'all'
  else 'assigned'
end
where team_scope = 'assigned';

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
          membership.team_scope in ('assigned', 'selected')
          and (
            exists (
              select 1 from public.club_member_team_access access
              where access.club_id = target_club_id
                and access.profile_id = target_profile_id
                and access.club_team_id = target_club_team_id
            )
            or (
              membership.team_scope = 'assigned'
              and exists (
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
      )
  );
$$;

grant execute on function public.club_member_can_access_team(uuid, uuid, uuid) to authenticated;

