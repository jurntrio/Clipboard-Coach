-- A solo coach who creates a standalone team today (teams.coach_id, via
-- CreateTeamModal.tsx) lands in the legacy non-club system: no season model, no
-- club_admin, and a second, separately-maintained permission path in
-- website/src/app/api/teams/route.ts. New solo signups should instead get an
-- automatically provisioned, single-member "personal" club, so they run through
-- the same season-aware system as every other club -- just with the club-admin
-- chrome hidden in the UI (see the dashboard/club gating that ships alongside
-- this migration). Existing standalone teams are untouched: this trigger only
-- fires on new `teams` inserts going forward.

alter table public.clubs add column if not exists is_personal boolean not null default false;

create or replace function public.provision_personal_club_for_team()
returns trigger
language plpgsql
security definer
set search_path = public as $$
declare
  v_club_id uuid;
  v_season_id uuid;
  v_club_team_id uuid;
  v_person_id uuid;
  v_club_person_id uuid;
  v_role_assignment_id uuid;
  v_trainer_id uuid;
  v_candidate_person_id uuid;
  v_candidate_count integer := 0;
  trainer_name_value text;
  club_name_value text;
  safe_display_name text;
begin
  select coalesce(nullif(trim(full_name), ''), email, 'Coach') into trainer_name_value
  from public.profiles where id = new.coach_id;
  trainer_name_value := coalesce(trainer_name_value, 'Coach');

  -- Reuse an existing personal club for this coach rather than spawning a new
  -- one per team, so a solo coach with several teams still has just one club.
  select c.id into v_club_id
  from public.club_memberships m
  join public.clubs c on c.id = m.club_id and c.is_personal
  where m.profile_id = new.coach_id and m.role = 'club_admin' and m.status = 'active'
  limit 1;

  if v_club_id is null then
    club_name_value := coalesce(nullif(trim(new.name), ''), trainer_name_value)
      || ' (' || left(new.coach_id::text, 8) || ')';
    insert into public.clubs(name, normalized_name, status, created_by, is_personal)
    values (club_name_value, public.normalize_club_team_name(club_name_value), 'active', new.coach_id, true)
    returning id into v_club_id;
  end if;

  v_season_id := public.ensure_active_club_season(v_club_id);

  insert into public.club_teams(club_id, name, normalized_name, season_id, status, created_by, approved_by, approved_at)
  values (v_club_id, new.name, public.normalize_club_team_name(new.name), v_season_id, 'active', new.coach_id, new.coach_id, now())
  returning id into v_club_team_id;

  update public.teams set club_team_id = v_club_team_id where id = new.id;

  if not exists (select 1 from public.club_memberships where club_id = v_club_id and profile_id = new.coach_id) then
    insert into public.people(first_name, last_name, created_by)
    values (
      coalesce(nullif(split_part(trainer_name_value, ' ', 1), ''), trainer_name_value),
      coalesce(nullif(trim(substr(trainer_name_value, length(split_part(trainer_name_value, ' ', 1)) + 1)), ''), '-'),
      new.coach_id
    ) returning id into v_person_id;
    insert into public.club_people(club_id, person_id, created_by)
    values (v_club_id, v_person_id, new.coach_id) returning id into v_club_person_id;

    select (array_agg(distinct p.id order by p.id))[1], count(distinct p.id)::integer
    into v_candidate_person_id, v_candidate_count
    from public.club_people cp join public.people p on p.id = cp.person_id
    where cp.club_id = v_club_id and p.id <> v_person_id and p.status = 'active'
      and public.normalize_person_name(p.first_name || p.last_name) = public.normalize_person_name(trainer_name_value);
    if v_candidate_count > 0 then
      perform public.create_person_claim_review(
        new.coach_id,
        case when v_candidate_count = 1 then v_candidate_person_id else null end,
        v_club_id,
        case when v_candidate_count = 1 then 'name_match' else 'ambiguous_match' end,
        jsonb_build_object('new_person_id', v_person_id, 'candidate_count', v_candidate_count)
      );
    else
      perform public.link_person_account(v_person_id, new.coach_id, 'self_registration', new.coach_id);
    end if;

    safe_display_name := trainer_name_value;
    insert into public.club_trainers(club_id, profile_id, club_person_id, display_name, invitation_status)
    values (v_club_id, new.coach_id, v_club_person_id, safe_display_name, 'linked')
    returning id into v_trainer_id;

    insert into public.club_role_assignments(club_person_id, role_type, club_team_id, status, created_by)
    values (v_club_person_id, 'trainer', v_club_team_id, 'active', new.coach_id)
    returning id into v_role_assignment_id;

    insert into public.club_trainer_teams(trainer_id, club_team_id, role, status, club_role_assignment_id)
    values (v_trainer_id, v_club_team_id, 'coach', 'active', v_role_assignment_id);

    insert into public.club_memberships(club_id, profile_id, role, status, function_role, team_scope)
    values (v_club_id, new.coach_id, 'club_admin', 'active', 'club_admin', 'all');

    update public.profiles set account_role = 'club_admin' where id = new.coach_id;
  else
    -- Coach already admins this personal club (a second standalone team): just
    -- link the existing trainer identity to the new team.
    select ct.id into v_trainer_id from public.club_trainers ct
    where ct.club_id = v_club_id and ct.profile_id = new.coach_id;
    select cp.id into v_club_person_id from public.club_people cp
    join public.club_trainers ct on ct.club_person_id = cp.id
    where ct.id = v_trainer_id;
    if v_trainer_id is not null then
      insert into public.club_role_assignments(club_person_id, role_type, club_team_id, status, created_by)
      values (v_club_person_id, 'trainer', v_club_team_id, 'active', new.coach_id)
      returning id into v_role_assignment_id;
      insert into public.club_trainer_teams(trainer_id, club_team_id, role, status, club_role_assignment_id)
      values (v_trainer_id, v_club_team_id, 'coach', 'active', v_role_assignment_id);
    end if;
  end if;

  return new;
end;
$$;

revoke all on function public.provision_personal_club_for_team() from public, anon, authenticated;

drop trigger if exists provision_personal_club_trigger on public.teams;
create trigger provision_personal_club_trigger
after insert on public.teams
for each row
when (new.coach_id is not null and new.club_team_id is null)
execute function public.provision_personal_club_for_team();

notify pgrst, 'reload schema';
