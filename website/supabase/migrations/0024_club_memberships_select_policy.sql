-- club_memberships had RLS enabled since 0017 but never got a policy of its
-- own. Any other policy that checks membership with a plain (non
-- security-definer) EXISTS subquery is itself subject to that missing
-- policy and silently sees zero rows -- this broke "Members can view their
-- clubs" / "Members can view club teams" (0021) and "Assigned club users
-- can view operational teams" / roster player visibility (0023) for every
-- direct browser query, even though the underlying membership was correct.
create policy "Users can view own club memberships" on public.club_memberships
  for select using (profile_id = auth.uid());

notify pgrst, 'reload schema';
