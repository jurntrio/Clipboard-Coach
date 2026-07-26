-- 0026's "Guardians can view their player's team" policy queried
-- public.players directly inside a public.teams policy. Since players'
-- own policies query back into teams (e.g. "team_id in (select id from
-- teams where coach_id = auth.uid())"), this created a policy evaluation
-- cycle: teams -> players -> teams -> ... ("infinite recursion detected
-- in policy for relation players"). Move the players lookup into a
-- security-definer function, which (like can_manage_club_roster and
-- can_access_club_match elsewhere) bypasses RLS internally and breaks
-- the cycle.
create or replace function public.guardian_team_ids(target_user_id uuid)
returns setof uuid
language sql
stable
security definer
set search_path = public
as $$
  select p.team_id
  from public.player_guardians pg
  join public.players p on p.id = pg.player_id
  where pg.profile_id = target_user_id;
$$;
grant execute on function public.guardian_team_ids(uuid) to authenticated;

drop policy if exists "Guardians can view their player's team" on public.teams;
create policy "Guardians can view their player's team" on public.teams for select
  using (id in (select public.guardian_team_ids(auth.uid())));

notify pgrst, 'reload schema';
