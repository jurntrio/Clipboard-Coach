-- A team created by an active admin of its own club belongs to that club
-- immediately. Only teams requested by people who are still joining the club
-- should enter the approval queue.
create or replace function public.auto_approve_admin_created_club_team()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.created_by is not null and exists (
    select 1
    from public.club_memberships membership
    where membership.club_id = new.club_id
      and membership.profile_id = new.created_by
      and membership.status = 'active'
      and membership.role = 'club_admin'
  ) then
    new.status := case when new.status = 'pending' then 'active' else new.status end;
    if new.status = 'active' then
      new.approved_by := coalesce(new.approved_by, new.created_by);
      new.approved_at := coalesce(new.approved_at, timezone('utc', now()));
    end if;
  end if;
  return new;
end;
$$;

drop trigger if exists auto_approve_admin_created_club_team_trigger on public.club_teams;
create trigger auto_approve_admin_created_club_team_trigger
before insert or update of status, created_by, club_id on public.club_teams
for each row execute function public.auto_approve_admin_created_club_team();

-- Repair older rows that entered the queue even though their creator was
-- already an active administrator of the same club.
update public.club_teams team
set status = 'active',
    approved_by = coalesce(team.approved_by, team.created_by),
    approved_at = coalesce(team.approved_at, timezone('utc', now()))
where team.status = 'pending'
  and team.created_by is not null
  and exists (
    select 1
    from public.club_memberships membership
    where membership.club_id = team.club_id
      and membership.profile_id = team.created_by
      and membership.status = 'active'
      and membership.role = 'club_admin'
  );

notify pgrst, 'reload schema';
