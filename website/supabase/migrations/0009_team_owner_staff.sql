-- Team owners are permanent staff members of every team they create.

insert into public.team_staff_members (team_id, user_id, added_by)
select id, coach_id, coach_id from public.teams
on conflict (team_id, user_id) do nothing;

create or replace function public.add_team_owner_as_staff()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.team_staff_members (team_id, user_id, added_by)
  values (new.id, new.coach_id, new.coach_id)
  on conflict (team_id, user_id) do nothing;
  return new;
end;
$$;

drop trigger if exists on_team_created_add_owner_staff on public.teams;
create trigger on_team_created_add_owner_staff
  after insert on public.teams
  for each row execute function public.add_team_owner_as_staff();

drop policy if exists "Team owners can remove staff memberships" on public.team_staff_members;
create policy "Team owners can remove non-owner staff memberships"
  on public.team_staff_members for delete
  using (
    team_id in (select id from public.teams where coach_id = auth.uid())
    and user_id <> (select owner.coach_id from public.teams as owner where owner.id = team_staff_members.team_id)
  );
