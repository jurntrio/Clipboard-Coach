-- Extra groups become the single assignment source for keeper coaches. The
-- goalkeeper function remains a label; it no longer grants team-management rights.

insert into public.player_groups (club_id, name, group_type, description, icon, active, created_by)
select trainer.club_id,
  'Keepers (gemigreerd) · ' || trainer.display_name,
  'goalkeeper_training',
  'Automatisch aangemaakt vanuit de vroegere keeperstoewijzingen.',
  '🥅', true, trainer.profile_id
from public.club_trainers trainer
where exists (select 1 from public.club_trainer_players assignment where assignment.trainer_id = trainer.id)
on conflict (club_id, name) do nothing;

insert into public.player_group_staff (group_id, trainer_id, role_label, added_by)
select group_row.id, trainer.id, 'Keepertrainer', trainer.profile_id
from public.club_trainers trainer
join public.player_groups group_row
  on group_row.club_id = trainer.club_id
 and group_row.name = 'Keepers (gemigreerd) · ' || trainer.display_name
where exists (select 1 from public.club_trainer_players assignment where assignment.trainer_id = trainer.id)
on conflict (group_id, trainer_id) do nothing;

insert into public.player_group_players (group_id, player_id, added_by)
select group_row.id, assignment.player_id, trainer.profile_id
from public.club_trainer_players assignment
join public.club_trainers trainer on trainer.id = assignment.trainer_id
join public.player_groups group_row
  on group_row.club_id = trainer.club_id
 and group_row.name = 'Keepers (gemigreerd) · ' || trainer.display_name
on conflict (group_id, player_id) do nothing;

create or replace function public.is_assigned_goalkeeper(target_player_id uuid, target_user_id uuid)
returns boolean
language sql stable security definer set search_path = public as $$
  select exists (
    select 1
    from public.player_group_players member
    join public.player_groups group_row on group_row.id = member.group_id and group_row.active
    join public.player_group_staff staff on staff.group_id = group_row.id
    join public.club_trainers trainer on trainer.id = staff.trainer_id
    where member.player_id = target_player_id
      and trainer.profile_id = target_user_id
  );
$$;

insert into public.club_role_permission_defaults
  (club_id, function_role, permission_key, enabled, updated_at)
select club.id, 'goalkeeper_coach', 'teams.manage', false, timezone('utc'::text, now())
from public.clubs club
on conflict (club_id, function_role, permission_key)
do update set enabled = false, updated_at = excluded.updated_at;

update public.club_role_permission_defaults
set enabled = permission_key in ('training.view', 'intradesk.view'),
    updated_at = timezone('utc'::text, now())
where function_role = 'goalkeeper_coach';

insert into public.club_role_permission_defaults
  (club_id, function_role, permission_key, enabled, updated_at)
select club.id, 'goalkeeper_coach', permission.key, true, timezone('utc'::text, now())
from public.clubs club
cross join (values ('training.view'), ('intradesk.view')) as permission(key)
on conflict (club_id, function_role, permission_key)
do update set enabled = true, updated_at = excluded.updated_at;

insert into public.club_role_permission_defaults
  (club_id, function_role, permission_key, enabled, updated_at)
select club.id, role.key, 'training.manage', true, timezone('utc'::text, now())
from public.clubs club
cross join (values ('youth_coordinator'), ('head_youth_development')) as role(key)
on conflict (club_id, function_role, permission_key)
do update set enabled = true, updated_at = excluded.updated_at;

comment on table public.club_trainer_players is
  'Deprecated read-only fallback. Keeper assignments were copied to player_group_players/player_group_staff in 0114; application code no longer reads or writes this table.';

revoke insert, update, delete on public.club_trainer_players from anon, authenticated;

notify pgrst, 'reload schema';
