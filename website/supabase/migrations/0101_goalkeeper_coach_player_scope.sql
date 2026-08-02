-- Keeperstrainers are technical staff: they can see the complete squad names and
-- all team footage, while private player rows and mutations remain limited to
-- their explicitly assigned goalkeepers. Complete squad names are exposed by the
-- server-side team endpoint, not by direct table access.

create or replace function public.is_goalkeeper_coach_for_team(target_team_id uuid, target_user_id uuid)
returns boolean
language sql stable security definer set search_path = public as $$
  select exists (
    select 1
    from public.teams team
    join public.club_teams club_team on club_team.id = team.club_team_id
    join public.club_memberships membership on membership.club_id = club_team.club_id
    where team.id = target_team_id
      and membership.profile_id = target_user_id
      and membership.status = 'active'
      and membership.function_role = 'goalkeeper_coach'
  );
$$;

create or replace function public.is_assigned_goalkeeper(target_player_id uuid, target_user_id uuid)
returns boolean
language sql stable security definer set search_path = public as $$
  select exists (
    select 1
    from public.club_trainer_players assignment
    join public.club_trainers trainer on trainer.id = assignment.trainer_id
    where assignment.player_id = target_player_id
      and trainer.profile_id = target_user_id
  );
$$;

create or replace function public.can_view_player_private_details(target_player_id uuid, target_user_id uuid)
returns boolean
language plpgsql stable security definer set search_path = public as $$
declare
  target_team_id uuid;
begin
  select team_id into target_team_id from public.players where id = target_player_id;
  return target_team_id is not null
    and public.can_view_team_membership(target_team_id, target_user_id)
    and (
      not public.is_goalkeeper_coach_for_team(target_team_id, target_user_id)
      or public.is_assigned_goalkeeper(target_player_id, target_user_id)
    );
end;
$$;

create or replace function public.can_manage_player_record(target_player_id uuid, target_user_id uuid)
returns boolean
language plpgsql stable security definer set search_path = public as $$
declare
  target_team_id uuid;
begin
  select team_id into target_team_id from public.players where id = target_player_id;
  return target_team_id is not null
    and public.can_manage_club_roster(target_team_id, target_user_id)
    and (
      not public.is_goalkeeper_coach_for_team(target_team_id, target_user_id)
      or public.is_assigned_goalkeeper(target_player_id, target_user_id)
    );
end;
$$;

-- Team-level creation/import remains unavailable to a keeperstrainer because a
-- new player cannot be assigned safely until an admin has marked and assigned them.
create or replace function public.can_manage_team_membership(target_team_id uuid, target_user_id uuid)
returns boolean
language sql stable as $$
  select public.can_manage_club_roster(target_team_id, target_user_id)
    and not public.is_goalkeeper_coach_for_team(target_team_id, target_user_id);
$$;

drop policy if exists "Assigned club users can view roster players" on public.players;
create policy "Assigned club users can view roster players" on public.players for select
  using (public.can_view_player_private_details(id, auth.uid()));

drop policy if exists "Authorized club users can insert roster players" on public.players;
create policy "Authorized club users can insert roster players" on public.players for insert
  with check (public.can_manage_team_membership(team_id, auth.uid()));

drop policy if exists "Authorized club users can update roster players" on public.players;
create policy "Authorized club users can update roster players" on public.players for update
  using (public.can_manage_player_record(id, auth.uid()))
  with check (public.can_manage_player_record(id, auth.uid()));

drop policy if exists "Authorized club users can delete roster players" on public.players;
create policy "Authorized club users can delete roster players" on public.players for delete
  using (public.can_manage_player_record(id, auth.uid()));

drop policy if exists "Club admins and sharing trainers can view club players" on public.club_players;
create policy "Club admins and sharing trainers can view club players" on public.club_players for select
  using (
    public.is_active_club_admin(club_players.club_id, auth.uid())
    or exists (
      select 1
      from public.player_team_memberships membership
      join public.players player on player.membership_id = membership.id
      where membership.club_player_id = club_players.id
        and public.can_view_player_private_details(player.id, auth.uid())
    )
  );

drop policy if exists "Assigned club users can view memberships" on public.player_team_memberships;
create policy "Assigned club users can view memberships" on public.player_team_memberships for select
  using (
    public.can_view_team_membership(team_id, auth.uid())
    and (
      not public.is_goalkeeper_coach_for_team(team_id, auth.uid())
      or exists (
        select 1 from public.players player
        where player.membership_id = player_team_memberships.id
          and public.is_assigned_goalkeeper(player.id, auth.uid())
      )
    )
  );

insert into public.club_role_permission_defaults
  (club_id, function_role, permission_key, enabled, updated_at)
select club.id, 'goalkeeper_coach', 'teams.manage', true, timezone('utc'::text, now())
from public.clubs club
on conflict (club_id, function_role, permission_key)
do update set enabled = true, updated_at = excluded.updated_at;

notify pgrst, 'reload schema';
