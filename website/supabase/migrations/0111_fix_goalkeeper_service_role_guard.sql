create or replace function public.guard_goalkeeper_status_change()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.is_goalkeeper is distinct from old.is_goalkeeper
    and coalesce(auth.role(), '') <> 'service_role'
    and not exists (
      select 1
      from public.teams team
      join public.club_teams club_team on club_team.id = team.club_team_id
      join public.club_memberships membership on membership.club_id = club_team.club_id
      where team.id = old.team_id
        and membership.profile_id = auth.uid()
        and membership.status = 'active'
        and (
          membership.role = 'club_admin'
          or membership.function_role in ('youth_coordinator', 'head_youth_development')
        )
    )
  then
    raise exception 'Alleen een Club Admin of jeugdcoördinator kan de doelmanstatus wijzigen.';
  end if;
  return new;
end;
$$;

notify pgrst, 'reload schema';
