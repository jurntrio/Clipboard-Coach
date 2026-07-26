-- 1. A club-assigned trainer/coach should also show up as team staff, same
-- as the existing personal-team staff mechanism. Backfill everyone already
-- actively assigned via club_trainer_teams (going forward the API keeps
-- this in sync on every assign/unassign).
insert into public.team_staff_members (team_id, user_id, added_by)
select t.id, ctr.profile_id, ctr.profile_id
from public.club_trainer_teams ctt
join public.club_trainers ctr on ctr.id = ctt.trainer_id
join public.teams t on t.club_team_id = ctt.club_team_id
where ctt.status = 'active' and ctr.profile_id is not null
on conflict (team_id, user_id) do nothing;

-- 2. infer_match_club() only matched club_team_id by fuzzy-matching
-- team_a_name against club_teams.name, with no status filter -- if two
-- club_teams shared a name (e.g. one merged into another), it could pick
-- the wrong (stale/merged) one. team_a_id -> teams.club_team_id is now the
-- authoritative, unambiguous link (added in 0023), so prefer that; only
-- fall back to name-matching among active teams for legacy/personal cases.
create or replace function public.infer_match_club()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare inferred_club_id uuid;
begin
  if new.club_id is null then
    select (array_agg(distinct cm.club_id))[1]
    into inferred_club_id
    from public.club_memberships cm
    where cm.profile_id = new.coach_id
    having count(distinct cm.club_id) = 1;
    new.club_id := inferred_club_id;
  end if;

  if new.club_team_id is null and new.team_a_id is not null then
    select t.club_team_id into new.club_team_id
    from public.teams t
    where t.id = new.team_a_id and t.club_team_id is not null;
  end if;

  if new.club_id is not null and new.club_team_id is null then
    select ct.id into new.club_team_id
    from public.club_teams ct
    where ct.club_id = new.club_id
      and ct.status = 'active'
      and lower(replace(ct.name, ' ', '')) = lower(replace(new.team_a_name, ' ', ''))
    limit 1;
  end if;
  return new;
end;
$$;

drop trigger if exists infer_match_club_trigger on public.matches;
create trigger infer_match_club_trigger
before insert or update of coach_id, team_a_name, team_a_id, club_id on public.matches
for each row execute function public.infer_match_club();

-- Re-derive club_team_id for existing matches now that the authoritative
-- team_a_id link is available; this corrects rows that picked a stale
-- (merged) club_teams row under the old name-matching-only logic.
update public.matches m
set club_team_id = t.club_team_id
from public.teams t
where t.id = m.team_a_id and t.club_team_id is not null and m.club_team_id is distinct from t.club_team_id;

notify pgrst, 'reload schema';
