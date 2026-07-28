-- Granular club permissions below the Teams module.

alter table public.club_module_entitlements
  drop constraint if exists club_module_entitlements_module_key_check;

alter table public.club_module_entitlements
  add constraint club_module_entitlements_module_key_check check (module_key in (
    'teams', 'video_viewer', 'matches', 'clips', 'training', 'intradesk',
    'attendance', 'club_management', 'teams_manage', 'teams_import'
  ));

insert into public.club_module_entitlements(club_id, module_key, enabled)
select club.id, permission.module_key, true
from public.clubs club
cross join (values ('teams_manage'), ('teams_import')) as permission(module_key)
on conflict (club_id, module_key) do nothing;

create or replace function public.seed_club_modules()
returns trigger language plpgsql security definer set search_path = public as $$
declare module_name text;
begin
  foreach module_name in array array[
    'teams', 'video_viewer', 'matches', 'clips', 'training', 'intradesk',
    'attendance', 'club_management', 'teams_manage', 'teams_import'
  ]
  loop
    insert into public.club_module_entitlements(club_id, module_key, enabled)
    values(new.id, module_name, true)
    on conflict (club_id, module_key) do nothing;
  end loop;
  insert into public.club_training_settings(club_id)
  values(new.id)
  on conflict (club_id) do nothing;
  return new;
end;
$$;

create or replace function public.can_manage_club_roster(target_team_id uuid, target_user_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.teams t
    join public.club_teams ct on ct.id = t.club_team_id
    where t.id = target_team_id
      and not exists (
        select 1 from public.club_module_entitlements permission
        where permission.club_id = ct.club_id
          and permission.module_key = 'teams_manage'
          and permission.enabled = false
      )
      and (
        exists (
          select 1 from public.club_memberships cm
          where cm.club_id = ct.club_id and cm.profile_id = target_user_id
            and cm.role = 'club_admin' and cm.status = 'active'
        )
        or (
          ct.trainers_can_edit_roster
          and exists (
            select 1
            from public.club_trainer_teams ctt
            join public.club_trainers ctr on ctr.id = ctt.trainer_id
            where ctt.club_team_id = ct.id and ctr.profile_id = target_user_id
              and ctt.status = 'active'
          )
        )
      )
  );
$$;
