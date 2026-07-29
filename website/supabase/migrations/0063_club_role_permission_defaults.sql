-- Club-specific permission templates per human function role.

create table if not exists public.club_role_permission_defaults (
  club_id uuid references public.clubs(id) on delete cascade not null,
  function_role text not null,
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
  updated_at timestamptz not null default timezone('utc'::text, now()),
  primary key (club_id, function_role, permission_key)
);

alter table public.club_role_permission_defaults enable row level security;

create policy "Club members read role permission defaults"
on public.club_role_permission_defaults for select
using (
  exists (
    select 1 from public.club_memberships membership
    where membership.club_id = club_role_permission_defaults.club_id
      and membership.profile_id = auth.uid()
      and membership.status = 'active'
  )
);

create or replace function public.apply_default_club_member_permissions()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  -- A new function role replaces the previous profile completely. Personal
  -- exceptions can be applied again afterwards by the Club Admin.
  if tg_op = 'UPDATE' and new.function_role is distinct from old.function_role then
    delete from public.club_member_permissions
    where club_id = new.club_id
      and profile_id = new.profile_id;
  end if;

  if exists (
    select 1 from public.club_role_permission_defaults defaults
    where defaults.club_id = new.club_id
      and defaults.function_role = new.function_role
  ) then
    insert into public.club_member_permissions
      (club_id, profile_id, permission_key, enabled, updated_at)
    select new.club_id, new.profile_id, defaults.permission_key, defaults.enabled, timezone('utc'::text, now())
    from public.club_role_permission_defaults defaults
    where defaults.club_id = new.club_id
      and defaults.function_role = new.function_role
    on conflict (club_id, profile_id, permission_key)
    do update set enabled = excluded.enabled, updated_at = excluded.updated_at;
  else
    insert into public.club_member_permissions
      (club_id, profile_id, permission_key, enabled, updated_at)
    select new.club_id, new.profile_id, permission_key, true, timezone('utc'::text, now())
    from unnest(
      case
        when new.function_role = 'club_admin' then array[
          'teams.view', 'teams.manage', 'teams.import', 'video.view',
          'games.view', 'games.create', 'games.view_counts', 'games.tag_link.create', 'games.tag',
          'training.view', 'training.manage', 'intradesk.view', 'intradesk.manage', 'clips.share'
        ]::text[]
        when new.function_role = 'club_admin_viewer' then array[
          'teams.view', 'video.view', 'games.view', 'games.view_counts', 'training.view', 'intradesk.view'
        ]::text[]
        when new.function_role in ('trainer', 'goalkeeper_coach') then array[
          'video.view', 'games.view', 'games.tag_link.create', 'games.tag',
          'training.view', 'intradesk.view', 'clips.share'
        ]::text[]
        when new.function_role = 'video_analyst' then array[
          'video.view', 'games.view', 'games.view_counts', 'games.tag', 'intradesk.view', 'clips.share'
        ]::text[]
        else array['intradesk.view']::text[]
      end
    ) as permission_key
    on conflict (club_id, profile_id, permission_key)
    do update set enabled = true, updated_at = excluded.updated_at;
  end if;
  return new;
end;
$$;

drop trigger if exists club_membership_default_permissions on public.club_memberships;
create trigger club_membership_default_permissions
after insert or update of role, status, function_role on public.club_memberships
for each row when (new.status = 'active')
execute function public.apply_default_club_member_permissions();

notify pgrst, 'reload schema';
