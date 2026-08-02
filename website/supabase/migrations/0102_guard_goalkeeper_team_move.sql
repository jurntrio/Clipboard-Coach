-- Apply the goalkeeper assignment check to both the current and proposed team
-- during direct player updates. This prevents an assigned goalkeeper from being
-- moved to a team outside the coach's scope through the Data API.

create or replace function public.can_manage_player_in_team(
  target_player_id uuid,
  target_team_id uuid,
  target_user_id uuid
)
returns boolean
language sql stable security definer set search_path = public as $$
  select public.can_manage_club_roster(target_team_id, target_user_id)
    and (
      not public.is_goalkeeper_coach_for_team(target_team_id, target_user_id)
      or public.is_assigned_goalkeeper(target_player_id, target_user_id)
    );
$$;

drop policy if exists "Authorized club users can update roster players" on public.players;
create policy "Authorized club users can update roster players" on public.players for update
  using (public.can_manage_player_in_team(id, team_id, auth.uid()))
  with check (public.can_manage_player_in_team(id, team_id, auth.uid()));

notify pgrst, 'reload schema';
